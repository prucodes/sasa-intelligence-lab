/** Read-only derivation from the two completed urban pulls; never changes raw exports. */
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {sourceNumber, sourceText, uniqueSourceRecords} from '../lib/record-contract.mjs';

export const serviceSources = ['msw_door_to_door_collection_api', 'waste_egregation_api'];
const identityFields = ['district_code','district_name','ulb_code','ulb_name'];
const mappingFields = ['api_lgd_dist_code','api_lgd_mandal_code'];
const signature = (row, fields) => JSON.stringify(fields.map(field => sourceText(row[field])));
const assert = (condition, message) => { if (!condition) throw new Error(`ULB snapshot withheld: ${message}`); };

export function buildUlbServiceSnapshot(collection, segregation, day = '2026-08-12') {
  const prepare = (rows, measure) => uniqueSourceRecords(rows.filter(r => r.date1 === day), r => sourceText(r.sachivalayam_code),
    r => signature(r, [...identityFields,...mappingFields,'total_households',measure]));
  const left = prepare(collection,'collected_households'), right = prepare(segregation,'garbage_segregation');
  for (const source of [left,right]) assert(!source.quality.conflictingKeys && !source.quality.missingKeyRows, 'conflicting or missing secretariat identities');
  assert(left.records.length > 0 && left.records.length === right.records.length, 'source populations do not match');
  const rightByCode = new Map(right.records.map(r => [sourceText(r.sachivalayam_code),r]));
  const groups = new Map(), points = [];
  for (const row of left.records) {
    const code = sourceText(row.sachivalayam_code), peer = rightByCode.get(code);
    assert(peer && signature(row,identityFields) === signature(peer,identityFields), `unmatched or disagreeing native identity ${code}`);
    const ulbCode = sourceText(row.ulb_code), name = sourceText(row.ulb_name), district = sourceText(row.district_name);
    assert(ulbCode && name && district, `incomplete ULB identity ${code}`);
    const households = sourceNumber(row.total_households), collected = sourceNumber(row.collected_households), segregated = sourceNumber(peer.garbage_segregation);
    assert(households !== null && collected !== null && segregated !== null && households === sourceNumber(peer.total_households), `missing or conflicting measures ${code}`);
    assert(segregated <= collected && collected <= households, `measure containment breach ${code}`);
    const mappingReview = [row,peer].some(r => !sourceText(r.district_code) || !sourceText(r.api_lgd_dist_code) || !sourceText(r.api_lgd_mandal_code) || sourceText(r.district_code) !== sourceText(r.api_lgd_dist_code) || sourceText(r.ulb_code) !== sourceText(r.api_lgd_mandal_code));
    if (!groups.has(ulbCode)) groups.set(ulbCode,{code:ulbCode,name,district,nativeDistrictCode:sourceText(row.district_code),households:0,collected:0,segregated:0,secretariats:0,positiveHouseholdSecretariats:0,mappingReviewSecretariats:0});
    const group = groups.get(ulbCode);
    assert(group.name === name && group.district === district && group.nativeDistrictCode === sourceText(row.district_code), `ULB code ${ulbCode} has conflicting labels`);
    group.households += households; group.collected += collected; group.segregated += segregated;
    group.secretariats++; group.positiveHouseholdSecretariats += Number(households > 0); group.mappingReviewSecretariats += Number(mappingReview);
    points.push([code,ulbCode,households,collected,segregated,Number(mappingReview)]);
  }
  const ulbs = [...groups.values()].sort((a,b) => a.name.localeCompare(b.name));
  const totals = Object.fromEntries(['households','collected','segregated'].map(field => [field,ulbs.reduce((n,r) => n+r[field],0)]));
  return {version:1,day,grain:'ULB · Day',identityKey:'native ulb_code; paired on sachivalayam_code + date1',
    recordQuality:{collection:left.quality,segregation:right.quality},totals,
    pointFields:['secretariatCode','ulbCode','households','collected','segregated','mappingReview'],
    points:points.sort((a,b) => a[0].localeCompare(b[0])),ulbs,
    boundary:'One source-reported day, not a sustained or overall performance rating. Whole ULBs with native/enriched code differences are held out; matching codes are not external master certification. Benchmarks are draft analytical references, not departmental targets.'};
}

async function main() {
  const sources = await Promise.all(serviceSources.map(async key => {
    const dir = resolve('data/large-snapshots',key), manifest = JSON.parse(await readFile(resolve(dir,'manifest.json'),'utf8'));
    const files = (await readdir(dir)).filter(f => /^page-.*\.json$/.test(f)).sort(), rows = [], hash = createHash('sha256');
    for (const file of files) { const text = await readFile(resolve(dir,file),'utf8'); hash.update(file).update(text); rows.push(...JSON.parse(text).records); }
    assert(files.length === manifest.pages && rows.length === manifest.retainedRows && manifest.countsAgree === true, `${key} retention manifest does not reconcile`);
    return {key,rows,provenance:{generatedAt:manifest.retrievedAt,rows:rows.length,pages:files.length,sha256:hash.digest('hex')}};
  }));
  const data = buildUlbServiceSnapshot(sources[0].rows,sources[1].rows);
  data.generatedFrom = Object.fromEntries(sources.map(s => [s.key,s.provenance]));
  await writeFile(resolve('data/aggregates/ulb-service-snapshot.json'),JSON.stringify(data)+'\n');
  console.log(JSON.stringify({day:data.day,ulbs:data.ulbs.length,plotted:data.ulbs.filter(u => u.collected>0 && !u.mappingReviewSecretariats).length,totals:data.totals}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
