import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalRecord } from '../lib/record-contract.mjs';

export async function validateCurrentSnapshots() {
  const report=JSON.parse(await readFile('data/current-catalogue.json','utf8'));
  const errors=[];
  if(new Set(report.datasets.map(d=>d.key)).size!==report.authorizedRoutes) errors.push('Current authorized-route count does not reconcile');
  const files=(await readdir('data/current-snapshots')).filter(f=>f.endsWith('.json'));
  for(const file of files) {
    const data=JSON.parse(await readFile(`data/current-snapshots/${file}`,'utf8'));
    const key=file.slice(0,-5), rows=data.records, meta=data.responseMetadata;
    const item=report.datasets.find(d=>d.key===key);
    if(!item) { errors.push(`${key}: no current catalogue entry`); continue; }
    if(!Array.isArray(rows)) {errors.push(`${key}: records absent`);continue;}
    if(meta.tableKey!==key || meta.returnedRecordCount!==rows.length || meta.totalRecordCount!==rows.length || meta.hasNextPage!==false || meta.nextPageToken!==null) errors.push(`${key}: response metadata mismatch`);
    const hash=createHash('sha256').update(rows.map(canonicalRecord).sort().join('\n')).digest('hex');
    if(item.contentHash!==hash || item.retainedRows!==rows.length) errors.push(`${key}: staged content differs from sync manifest`);
    if(Object.keys(data.requestEcho?.filters??{}).length) errors.push(`${key}: unexpected staged geographic or period filter`);
  }
  for(const item of report.datasets.filter(d=>d.status==='retained' && d.evidencePath?.startsWith('data/current-snapshots/'))) if(!files.includes(`${item.key}.json`)) errors.push(`${item.key}: retained file missing`);
  return {errors,count:files.length};
}
