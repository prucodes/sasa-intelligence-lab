/** Undated register associations across every completed retained activity month. */
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sourceNumber,uniqueSourceRecords} from '../lib/record-contract.mjs';
const root=resolve('data/large-snapshots'),text=v=>String(v??'').trim(),read=async p=>JSON.parse(await readFile(p,'utf8'));
const registerSource='sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api_27_aug_2026';
const envelope=await read(resolve(root,registerSource+'.json'));
const registerGroups=new Map();
for(const r of envelope.records){const id=text(r.GRAM_PANCHAYAT_ID);if(id){const rows=registerGroups.get(id)??[];rows.push(r);registerGroups.set(id,rows);}}
const register=new Map();let disputed=0;
for(const [id,rows] of registerGroups){if(new Set(rows.map(r=>`${text(r.GP_HAVING_SWPC).toLowerCase()}|${text(r.WORKING_CONDITION).toLowerCase()}`)).size>1){disputed++;continue;}const r=rows[0],presence=text(r.GP_HAVING_SWPC).toLowerCase();register.set(id,{presence:presence==='yes'?'with-centre':presence==='no'?'without-centre':'not-stated',condition:text(r.WORKING_CONDITION)||'Not stated'});}
const found=new Map();
for(const name of await readdir(root)){const match=/__(?=.*MONTH_ID-(\d+))(?=.*YEAR-(\d+))/.exec(name);if(!match)continue;let manifest;try{manifest=await read(resolve(root,name,'manifest.json'));}catch{continue;}const period=`${match[2]}-${match[1].padStart(2,'0')}`,parts=found.get(period)??[];parts.push({name,manifest});found.set(period,parts);}
const months=[];
for(const [period,parts] of [...found].sort()){
 const raw=[];for(const part of parts)for(const file of (await readdir(resolve(root,part.name))).filter(f=>f.startsWith('page-')).sort())raw.push(...(await read(resolve(root,part.name,file))).records);
 const expected=parts.reduce((s,p)=>s+p.manifest.retainedRows,0);if(raw.length!==expected)throw Error(`${period}: raw total mismatch`);
 const {records,quality}=uniqueSourceRecords(raw,r=>text(r.GRAM_PANCHAYAT_ID)&&text(r.COLLECTION_DATE)?`${text(r.GRAM_PANCHAYAT_ID)}|${text(r.COLLECTION_DATE)}`:null);
 const rows=records.map(r=>{const value=text(r.IS_COLLECTED).toLowerCase();return {id:text(r.GRAM_PANCHAYAT_ID),date:text(r.COLLECTION_DATE),district:text(r.DISTRICT_NAME),valid:['yes','no'].includes(value),yes:value==='yes',seg:sourceNumber(r.SEGREGATED_WASTE_HOUSEHOLDS)};});
 if(rows.some(r=>!r.date.startsWith(period)))throw Error(`${period}: unexpected date`);
 months.push({period,rows,quality,source:parts.map(p=>({directory:p.name,...p.manifest}))});console.log(`${period}: ${raw.length} raw → ${rows.length} distinct`);
}
const lastDay=Math.min(...months.map(m=>m.rows.reduce((max,r)=>Math.max(max,Number(r.date.slice(8,10))),0)));
const key=r=>`${r.id}|${r.date.slice(8,10)}`;
const keys=months.map(m=>new Set(m.rows.filter(r=>r.valid&&register.has(r.id)&&Number(r.date.slice(8,10))<=lastDay).map(key)));
const common=new Set([...keys[0]].filter(k=>keys.every(set=>set.has(k))));
const summarize=rows=>{const valid=rows.filter(r=>r.valid),yes=valid.filter(r=>r.yes).length,seg=rows.filter(r=>r.seg!==null);return {panchayats:new Set(rows.map(r=>r.id)).size,observations:rows.length,valid:valid.length,yes,missing:rows.length-valid.length,rate:valid.length?yes/valid.length:null,segregationValid:seg.length,segregated:seg.reduce((s,r)=>s+r.seg,0)};};
const partition=rows=>['with-centre','without-centre','not-stated'].map(id=>({id,...summarize(rows.filter(r=>register.get(r.id).presence===id))}));
const series=months.map(m=>{const matched=m.rows.filter(r=>register.has(r.id)),comparable=matched.filter(r=>common.has(key(r))),days=[...new Set(m.rows.map(r=>r.date))].sort().map(date=>({date,...summarize(m.rows.filter(r=>r.date===date))})),lowDays=days.filter(d=>d.rate!==null&&d.rate<.2).map(d=>d.date);return {period:m.period,quality:m.quality,sources:m.source.map(p=>({directory:p.directory,rows:p.retainedRows,pages:p.pages,retrievedAt:p.retrievedAt})),days,lowDays,matchedPanchayats:new Set(matched.map(r=>r.id)).size,unmatchedObservations:m.rows.length-matched.length,full:partition(matched),comparable:partition(comparable),sensitivity:partition(matched.filter(r=>!lowDays.includes(r.date))),byCondition:[...new Set([...register.values()].filter(r=>r.presence==='with-centre').map(r=>r.condition))].sort().map(condition=>({condition,...summarize(matched.filter(r=>register.get(r.id).presence==='with-centre'&&register.get(r.id).condition===condition))})),byDistrict:[...new Set(matched.map(r=>r.district))].sort().map(district=>({district,groups:partition(matched.filter(r=>r.district===district))}))};});
const generatedFrom=Object.fromEntries(months.map(m=>[m.period,{generatedAt:m.source.map(p=>p.retrievedAt).sort().at(-1),rows:m.quality.rawRows,pages:m.source.reduce((n,p)=>n+p.pages,0)}]));generatedFrom[registerSource]={generatedAt:envelope.responseMetadata.generatedAt,rows:envelope.records.length,responseId:envelope.responseMetadata.responseId};
const out={version:1,generatedFrom,grain:'Gram panchayat · day',register:{source:registerSource,generatedAt:envelope.responseMetadata.generatedAt,rows:envelope.records.length,eligible:register.size,disputed,effectiveDate:null},windowDays:lastDay,commonObservations:common.size,series,boundary:'Undated register categories are held fixed across months. First-week comparisons use one common valid GP/day-of-month cohort. Full-period context and low-reporting-day sensitivity use different populations. Associations do not establish historical infrastructure status, programme effects or outages.'};
await writeFile('data/aggregates/infrastructure-series.json',JSON.stringify(out)+'\n');console.log(`Common registered cohort: ${common.size}; ${lastDay} days per month`);
