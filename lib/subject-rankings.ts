import {getCollectionProcurementSummary,getIHHLFunnel,getLegacyWasteSummary} from './analytics';
import {serviceSnapshot} from './ulb-service';
import {sourceCandidateKey} from './snapshots';
import {comparisonDiagnosticKey} from './ulb-diagnostics-link';
import type {ReviewIssueId} from './overview';

export type RankingSubject='reach'|'segregation'|'toilets'|'vehicles'|'legacy';
export interface RankingInput {key:string;name:string;district:string;top:number|null;bottom:number|null;reasons:string[];identity:string|null;candidate:string|null}
export interface RankedRow extends RankingInput {rate:number;rank:number;tied:number}
export interface RankingDefinition {id:RankingSubject;label:string;topLabel:string;bottomLabel:string;period:string;source:string;boundary:string;inputs:RankingInput[];programme?:ReviewIssueId}
export const rankingSubjects:{id:RankingSubject;label:string}[]=[{id:'reach',label:'Waste collection reach'},{id:'segregation',label:'Waste segregation'},{id:'toilets',label:'Household toilet delivery'},{id:'vehicles',label:'Vehicle supply fulfilment'},{id:'legacy',label:'Legacy waste clearance'}];
export const rankPrecision=(rate:number)=>Math.round(rate*1e6);
export function rankSubject(inputs:RankingInput[],district=''){
  const scoped=inputs.filter(r=>!district||r.district===district);
  const excluded:RankingInput[]=[];
  const eligible:Omit<RankedRow,'rank'|'tied'>[]=[];
  for(const row of scoped){
    const reasons=[...row.reasons];
    if(row.top===null||row.bottom===null||!Number.isFinite(row.top)||!Number.isFinite(row.bottom))reasons.push('Required measurement missing or invalid');
    else if(row.top<0||row.bottom<0)reasons.push('Negative source measurement');
    else if(row.bottom===0)reasons.push('Zero denominator; rate undefined');
    else if(row.top>row.bottom)reasons.push('Reported numerator exceeds denominator');
    if(reasons.length)excluded.push({...row,reasons:[...new Set(reasons)]});
    else eligible.push({...row,rate:row.top!/row.bottom!*100});
  }
  eligible.sort((a,b)=>rankPrecision(b.rate)-rankPrecision(a.rate)||a.name.localeCompare(b.name)||a.key.localeCompare(b.key));
  const first=new Map<number,number>(),counts=new Map<number,number>();
  eligible.forEach((r,i)=>{const rate=rankPrecision(r.rate);if(!first.has(rate))first.set(rate,i+1);counts.set(rate,(counts.get(rate)??0)+1);});
  const rows:RankedRow[]=eligible.map(r=>({...r,rank:first.get(rankPrecision(r.rate))!,tied:counts.get(rankPrecision(r.rate))!}));
  return {rows,excluded,population:scoped.length,district};
}

export function getRankingDefinition(id:RankingSubject):RankingDefinition {
  const label=rankingSubjects.find(s=>s.id===id)!.label;
  if(id==='reach'||id==='segregation')return {id,label,period:serviceSnapshot.day,source:'Paired urban collection and segregation exports',
    topLabel:id==='reach'?'Collected households':'Segregating households',bottomLabel:id==='reach'?'Total households':'Collected households',
    boundary:'One reported day; not a typical-day or sustained service rating. Native source ULB codes link these two measures. Whole ULBs with geographic-code differences are held out. The segregation field is interpreted as households, pending departmental definition confirmation.',
    inputs:serviceSnapshot.ulbs.map(u=>({key:`urban:${u.code}`,name:u.name,district:u.district,top:id==='reach'?u.collected:u.segregated,bottom:id==='reach'?u.households:u.collected,
      identity:`urban:${u.code}`,candidate:sourceCandidateKey({ulb_name:u.name,district_name:u.district}),reasons:u.mappingReviewSecretariats?['Native / enriched geographic codes need review']:[]}))};
  const programme:ReviewIssueId=id==='toilets'?'sanitation':id==='vehicles'?'collection':'processing';
  const raw=id==='toilets'?getIHHLFunnel().rows.map(r=>({...r,top:r.completed,bottom:r.approved,check:null})):
    id==='vehicles'?getCollectionProcurementSummary().rows.map(r=>({...r,top:r.supplied,bottom:r.workOrders,check:null})):
    getLegacyWasteSummary().rows.map(r=>({...r,top:r.achievement,bottom:r.target,check:r.balanceCheck==='pass'?null:'Source balance does not reconcile',balance:r.balance}));
  if(new Set(raw.map(r=>`${r.tableKey}|${r.period}|${r.grain}`)).size>1)throw new Error('Ranking requires one source, period and grain');
  const groups=new Map<string,Array<(typeof raw)[number]>>();
  raw.forEach((r,i)=>{const key=sourceCandidateKey(r.raw)??`unidentified:${i}`;groups.set(key,[...(groups.get(key)??[]),r]);});
  const inputs:RankingInput[]=[...groups].map(([candidate,group])=>{
    const r=group[0],missing=candidate.startsWith('unidentified:')||!r.ulb?.trim()||!r.district?.trim();
    const variants=new Set(group.map(v=>JSON.stringify([v.top,v.bottom,v.check,'balance' in v?v.balance:null])));
    return {key:`${id}:${candidate}`,candidate:missing?null:candidate,name:r.ulb??'Unidentified returned row',district:r.district??'Not stated',identity:null,
      top:variants.size>1?null:r.top,bottom:variants.size>1?null:r.bottom,
      reasons:[...(missing?['Missing source ULB identity']:[]),...(variants.size>1?['Conflicting measurements for this source identity']:[]),...(group.some(v=>v.check)?['Source balance does not reconcile']:[])]};
  });
  return {id,label,programme,inputs,period:raw[0]?.period??'Not returned',source:raw[0]?.tableKey??'Not returned',
    topLabel:id==='toilets'?'Completed toilets':id==='vehicles'?'Supplied vehicles':'Cleared tonnes',
    bottomLabel:id==='toilets'?'Approved toilets':id==='vehicles'?'Vehicles on work orders':'Target tonnes',
    boundary:'Source-name ULB candidates within this programme and period; cross-programme identity is not certified. Rates measure delivery against the reported denominator, not service quality, infrastructure need or overall sanitation performance.'};
}

export function rankingDiagnosticLink(definition:RankingDefinition,row:RankingInput){
  if(!definition.programme||!row.candidate)return null;
  const key=comparisonDiagnosticKey(row.candidate,definition.programme,definition.period);
  return key?`/diagnostics/${key}?mode=governed&programme=${definition.programme}`:null;
}

/** Native urban identities join only within their source family. Names remain inspection candidates. */
export function getSubjectProfile(selected:RankingInput,subject:RankingSubject,definitions:RankingDefinition[]){
  return definitions.map(def=>{
    const matched=def.id===subject?def.inputs.find(r=>r.key===selected.key):selected.identity?def.inputs.find(r=>r.identity===selected.identity):undefined;
    const candidate=!matched&&selected.candidate?def.inputs.filter(r=>r.candidate===selected.candidate):[];
    const cohort=rankSubject(def.inputs),ranked=matched?cohort.rows.find(r=>r.key===matched.key):undefined,excluded=matched?cohort.excluded.find(r=>r.key===matched.key):undefined;
    return {definition:def,matched,ranked,excluded,population:cohort.rows.length,candidate:candidate.length===1?candidate[0]:undefined};
  });
}
