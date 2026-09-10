/** Offline inventory only; never promotes partial or historical responses as fresh. */
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {canonicalRecord} from '../lib/record-contract.mjs';
import {createHash} from 'node:crypto';
const read=async p=>{try{return JSON.parse(await readFile(p,'utf8'));}catch{return null;}},files=async p=>{try{return await readdir(p);}catch{return [];}};
const catalogue=await read('data/current-catalogue.json'),hash=rows=>createHash('sha256').update(rows.map(canonicalRecord).sort().join('\n')).digest('hex');
const routes=[];
for(const item of catalogue.datasets){
 const current=await read(`data/current-snapshots/${item.key}.json`),historical=await read(`data/full-snapshots/${item.key}.json`),dir=`data/large-snapshots/current/${item.key}`,manifest=await read(`${dir}/manifest.json`),complete=await read(`${dir}/complete.json`);
 const retained=current??complete,meta=retained?.responseMetadata,valid=!!retained&&meta.returnedRecordCount===retained.records.length&&meta.totalRecordCount===retained.records.length&&meta.hasNextPage===false&&meta.nextPageToken===null;
 let cachedRows=0,expected=null;for(const f of (await files(dir)).filter(f=>/^page-\d+\.json$/.test(f))){const page=await read(`${dir}/${f}`);cachedRows+=page?.records?.length??0;expected??=page?.responseMetadata?.totalRecordCount??null;}
 routes.push({key:item.key,currentState:valid?'complete retained response':cachedRows?'incomplete current cache':'no current export',currentRows:retained?.records?.length??0,hashMatches:valid&&item.contentHash?hash(retained.records)===item.contentHash:null,cachedRows,expectedRows:expected,historicalRows:historical?.records?.length??0,historicalDate:historical?.responseMetadata?.generatedAt??null,catalogueStatus:item.status,manifestPresent:!!manifest});
}
const monthly=await read('data/aggregates/month-series.json');
const report={auditedAt:new Date().toISOString(),catalogueCheckedAt:catalogue.checkedAt,authorizedRoutes:routes.length,completedCurrent:routes.filter(r=>r.currentState==='complete retained response').length,partialCurrent:routes.filter(r=>r.currentState==='incomplete current cache'),noCurrentExport:routes.filter(r=>r.currentState==='no current export').map(r=>r.key),monthly:{periods:monthly.periods,rawRows:Object.values(monthly.recordQuality).reduce((n,q)=>n+q.rawRows,0),distinctGpDays:Object.values(monthly.recordQuality).reduce((n,q)=>n+q.uniqueRows,0),commonObservations:monthly.cohort.pairs},routes,boundary:'Offline retained-file audit. Catalogue may have changed since its checked date. Older large exports and historical files are not certified fresh by this audit.'};
await mkdir('artifacts/ingestion',{recursive:true});await writeFile('artifacts/ingestion/audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({routes:report.authorizedRoutes,completedCurrent:report.completedCurrent,partial:report.partialCurrent.map(r=>({key:r.key,rows:r.cachedRows,total:r.expectedRows})),withoutCurrent:report.noCurrentExport,monthly:report.monthly},null,2));
