/** Reconcile the authorized catalogue and retain complete current responses.
 * node scripts/sync-datalake.mjs --token-file /path/to/short-lived-token [--small-only|--large-only]
 * Coordinate exclusive session ownership before running. This script never refreshes authentication.
 * Credentials are never copied into evidence, application code or logs.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalRecord } from '../lib/record-contract.mjs';

const args = process.argv.slice(2);
const tokenFile = args[args.indexOf('--token-file') + 1];
if (!args.includes('--token-file') || !tokenFile) throw new Error('A local short-lived --token-file is required.');
const BASE = 'https://datalakes.ailivinglabs.ap.gov.in/api/v1';
const CURRENT = resolve('data/current-snapshots');
const CACHE = resolve('data/large-snapshots/current');
const reportPath = resolve('data/current-catalogue.json');
const smallOnly = args.includes('--small-only');
const largeOnly = args.includes('--large-only');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const rowHash = (rows) => createHash('sha256').update(rows.map(canonicalRecord).sort().join('\n')).digest('hex');

async function request(path, body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = (await readFile(tokenFile, 'utf8')).trim();
    const response = await fetch(`${BASE}${path}`, {
      method:body ? 'POST' : 'GET',
      headers:{ Authorization:`Bearer ${token}`, ...(body ? {'Content-Type':'application/json'} : {}) },
      ...(body ? {body:JSON.stringify(body)} : {}),
      signal:AbortSignal.timeout(240000),
    });
    if (response.ok) return response.json();
    if (response.status === 401) throw new Error('Session expired. Coordinate exclusive token ownership before restarting.');
    if (![429,500,502,503,504].includes(response.status) || attempt === 4) {
      const detail=await response.json().catch(()=>({}));
      throw new Error(`HTTP ${response.status} for ${path}: ${String(detail.error??detail.detail??detail.message??'').slice(0,250)}`);
    }
    await sleep((attempt + 1) * 1500);
  }
  throw new Error(`Request could not complete: ${path}`);
}

// Use the same configured purpose as the existing SASA ingestion and platform example.
const body = (pageToken) => ({departmentId:'DEPT-AILABS',purpose:process.env.AILAB_QUERY_PURPOSE??'BENEFIT_DISBURSEMENT',filters:{},responseFormat:'JSON',...(pageToken ? {pageToken} : {})});
await mkdir(CURRENT,{recursive:true});
await mkdir(CACHE,{recursive:true});
const cataloguePayload = await request('/datasets');
const catalogue = Array.isArray(cataloguePayload.data) ? cataloguePayload.data : cataloguePayload.datasets;
if (!Array.isArray(catalogue) || !catalogue.length) throw new Error('No authorized catalogue returned.');
let prior;
try { prior=JSON.parse(await readFile(reportPath,'utf8')); } catch { prior={datasets:[]}; }
const report={version:1,checkedAt:new Date().toISOString(),source:`${BASE}/datasets`,authorizedRoutes:catalogue.length,datasets:catalogue.map((item)=>({...(prior.datasets.find(d=>d.key===item.key)||{}),...item,key:item.key,status:prior.datasets.find(d=>d.key===item.key)?.status??'pending'}))};
const persist=()=>writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
await persist();
console.log(`Current catalogue: ${catalogue.length} authorized routes.`);

if (args.includes('--probe-export')) {
  const key=args[args.indexOf('--probe-export')+1];
  const start=Date.now();
  const result=await request(`/datasets/${key}/export?format=json`,body());
  await writeFile(resolve(CACHE,`${key}-export-probe.json`),JSON.stringify(result));
  console.log(JSON.stringify({key,seconds:(Date.now()-start)/1000,rows:result.records?.length,metadata:result.responseMetadata}));
  process.exit(0);
}

async function retain(item) {
  const key=item.key;
  const dir=resolve(CACHE,key);
  await mkdir(dir,{recursive:true});
  const first=await request(`/datasets/${key}/query`,body());
  const total=first.responseMetadata?.totalRecordCount;
  if (!Number.isInteger(total)) throw new Error(`${key}: missing total record count`);
  Object.assign(item,{liveRows:total,upstreamTableKey:first.responseMetadata.tableKey,columns:Object.keys(first.records?.[0]??{}),queriedAt:new Date().toISOString(),filtersApplied:first.requestEcho?.filters??{}});
  if(Object.keys(item.filtersApplied).length) throw new Error(`${key}: source unexpectedly applied filters`);
  if((smallOnly && total>2000)||(largeOnly && total<=2000)){item.status=total>2000?'large-pull-pending':item.retainedRows===total?'retained':'small-pull-pending';await persist();return;}
  let pages=1,records=[...(first.records??[])],next=first.responseMetadata.nextPageToken;
  await writeFile(resolve(dir,'page-00000000.json'),JSON.stringify(first));
  const seen=new Set();
  while(first.responseMetadata.hasNextPage && next){
    if(seen.has(next)) throw new Error(`${key}: repeated pagination token`);
    seen.add(next);
    const path=resolve(dir,`page-${String(records.length).padStart(8,'0')}.json`);
    let page;
    // Never mix cached pages from a previous pass with a new live first page.
    page=await request(`/datasets/${key}/query`,body(next));
    await writeFile(path,JSON.stringify(page));
    if(page.responseMetadata?.totalRecordCount!==total) throw new Error(`${key}: total changed during pagination`);
    if(!page.records?.length) throw new Error(`${key}: empty page before completion`);
    records.push(...page.records);pages++;
    if(records.length>total) throw new Error(`${key}: more rows returned than advertised`);
    next=page.responseMetadata.hasNextPage?page.responseMetadata.nextPageToken:null;
    if(pages%100===0){console.log(`${key}: ${records.length}/${total} rows`);Object.assign(item,{status:'in-progress',retainedRows:records.length,pages});await persist();}
  }
  if(records.length!==total) throw new Error(`${key}: incomplete ${records.length}/${total}`);
  const envelope={...first,requestEcho:{...first.requestEcho,tableKey:key,filters:{}},responseMetadata:{...first.responseMetadata,upstreamTableKey:first.responseMetadata.tableKey,tableKey:key,returnedRecordCount:records.length,hasNextPage:false,nextPageToken:null},records};
  const destination=total>2000?resolve(dir,'complete.json'):resolve(CURRENT,`${key}.json`);
  await writeFile(destination,JSON.stringify(envelope)+'\n');
  delete item.error;
  Object.assign(item,{rawCountReconciled:true,distinctCompleteness:'unproven',status:'retained',retainedRows:records.length,retainedAt:new Date().toISOString(),pages,contentHash:rowHash(records),evidencePath:destination.replace(process.cwd()+'/',''),scope:'Returned raw count reconciled · no filters · distinct completeness unproven'});
  await writeFile(resolve(dir,'manifest.json'),JSON.stringify(item,null,2)+'\n');
  await persist();
  console.log(`Retained ${key}: ${records.length} rows / ${pages} pages.`);
}

// Independent datasets run concurrently; each follows the source's returned page token.
let index=0;
const requestedKeys=args.includes('--key')?new Set(args[args.indexOf('--key')+1].split(',')):null;
const work=requestedKeys?report.datasets.filter(d=>requestedKeys.has(d.key)):report.datasets;
if(requestedKeys&&work.length!==requestedKeys.size)throw new Error('One or more requested routes are absent from the authorized catalogue.');
await Promise.all(Array.from({length:3},async()=>{while(index<work.length){const item=work[index++];try{await retain(item);}catch(error){item.status='failed';item.error=error.message;await persist();console.error(`${item.key}: ${error.message}`);}}}));
const files=(await readdir(CURRENT)).filter(f=>f.endsWith('.json')).sort();
await writeFile(resolve('lib/current-snapshots.ts'),files.map((file,i)=>`import snapshot${i} from '@/data/current-snapshots/${file}';`).join('\n')+`\nexport const currentSnapshots = [${files.map((_,i)=>`snapshot${i}`).join(',')}];\n`);
report.completedAt=new Date().toISOString();await persist();
console.log(`Sync pass finished: ${report.datasets.filter(d=>d.status==='retained').length}/${report.authorizedRoutes} routes retained.`);
if(work.some(d=>d.status==='failed'))process.exitCode=1;
