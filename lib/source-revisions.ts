import {currentSnapshots} from './current-snapshots';
import {governedSnapshotByKey, type SnapshotRecord} from './snapshots';
import {sourceNumber,sourceText,sourcePeriod,canonicalRecord,uniqueSourceRecords} from './record-contract.mjs';

const vehicles=['sasa_sac_door_to_door_e_autos_api','sasa_sac_door_to_door_push_carts_api','sasa_sac_door_to_door_tri_cycles_api','sasa_sac_machinery_e_autos_service_model_api'];
const green=['sasa_50_percent_green_spaces_api','sasa_50_percent_greencover_api','sasa_50_percent_rejuvenation_api'];
export const revisionMeasures=[
  {id:'e-autos',label:'District E-Auto assets',routes:vehicles,target:'e_autos_target',achievement:'e_autos_achievement',unit:'vehicles',grain:'District',change:'Four routes now return a shared district asset table. The former ULB service-model route no longer returns work orders or ULB procurement records.'},
  {id:'push-carts',label:'District push carts',routes:vehicles,target:'push_carts_target',achievement:'push_carts_achievement',unit:'carts',grain:'District',change:'A dedicated measure within the shared district asset response; endpoint copies are not added.'},
  {id:'tri-cycles',label:'District tri-cycles',routes:vehicles,target:'tri_cycles_target',achievement:'tri_cycles_achievement',unit:'tri-cycles',grain:'District',change:'A dedicated measure within the shared district asset response; endpoint copies are not added.'},
  {id:'green-spaces',label:'Green spaces',routes:green,target:'green_spaces_target_in_nos',achievement:'green_spaces_achieved',unit:'spaces',grain:'ULB',change:'Three routes now return one merged response with separate columns for spaces, cover and water bodies. This view resolves each measure separately.'},
  {id:'green-cover',label:'Green cover',routes:green,target:'green_cover_trgts_in_kms',achievement:'green_cover_achvd_in_kms',unit:'km',grain:'ULB',change:'This source supplies a length measure in kilometres. It is not treated as a percentage of land area.'},
  {id:'water-bodies',label:'Water-body rejuvenation',routes:green,target:'rejuvenation_of_water_bodies_in_nos_targets',achievement:'rejuvenation_of_water_bodies_achived',unit:'water bodies',grain:'ULB',change:'Water-body counts are resolved from the merged table; they are not added to green-space counts or green-cover length.'},
  {id:'odf-villages',label:'ODF+ model villages',routes:['sasa_declaration_of_odf_plus_model_villages_api'],target:'odf_vlges_declaration_target_units',achievement:'odf_vlges_declaration_achvmt',unit:'villages',grain:'District',change:'The revised response has 28 district positions and no reporting date. The older monthly history remains separate.'},
  {id:'plastic-units',label:'Plastic waste management units',routes:['sasa_establishment_of_plastic_waste_management_units_api'],target:'pwm_units_trgt_units',achievement:'pwm_units_achvmnt',unit:'units',grain:'District',change:'The revised response has renamed measures and no reporting date. It supports a reported position, not a monthly trend.'},
] as const;
export type RevisionMeasure=typeof revisionMeasures[number];
const envelope=(key:string)=>currentSnapshots.find(snapshot=>snapshot.requestEcho.tableKey===key)!;
const content=(records:SnapshotRecord[])=>records.map(canonicalRecord).sort().join('\n');
const total=(values:Array<number|null>)=>values.some(v=>v!==null)?values.reduce<number>((sum,v)=>sum+(v??0),0):null;

/** One declared source grain and period. All conflicting measure pairs are withheld. */
export function summarizeRevision(records:SnapshotRecord[],spec:{grain:string;target:string;achievement:string},requested?:string) {
  const periods=[...new Set(records.map(sourcePeriod).filter((period):period is string=>Boolean(period)))].sort();
  const selectedPeriod=requested&&periods.includes(requested)?requested:periods.at(-1)??null;
  const selected=records.filter(record=>sourcePeriod(record)===selectedPeriod);
  const prepared=selected.map(record=>{
    // Departmental names identify candidates only within this response. LGD codes are not
    // silently accepted as a cross-source identity decision.
    const district=sourceText(record.dstrt_nm??record.district_name??record.lgd_district_name);
    const entity=spec.grain==='ULB'?sourceText(record.ulb_nm??record.ulb_name):district;
    return {district,entity,key:district&&entity?`${district}|${entity}|${selectedPeriod??'undated'}`:null,target:sourceNumber(record[spec.target]),achievement:sourceNumber(record[spec.achievement])};
  });
  const unique=uniqueSourceRecords(prepared,(row:typeof prepared[number])=>row.key,(row:typeof prepared[number])=>JSON.stringify([row.target,row.achievement]));
  const rows=unique.records as typeof prepared;
  const paired=rows.filter(row=>row.target!==null&&row.achievement!==null);
  const target=total(rows.map(row=>row.target));const achievement=total(rows.map(row=>row.achievement));
  const pairedTarget=total(paired.map(row=>row.target));const pairedAchievement=total(paired.map(row=>row.achievement));
  return {periods,selectedPeriod,rows,quality:unique.quality,target,achievement,paired:paired.length,missingMeasure:rows.length-paired.length,ratio:pairedTarget!==null&&pairedTarget>0&&pairedAchievement!==null?pairedAchievement/pairedTarget:null};
}
export function getRevisionAnalysis(id:string,period?:string) {
  const spec=revisionMeasures.find(spec=>spec.id===id)??revisionMeasures[0];
  const source=envelope(spec.routes[0]);
  const records=source.records as SnapshotRecord[];
  const reference=content(records);
  return {...summarizeRevision(records,spec,period),spec,retainedAt:source.responseMetadata.generatedAt,rawRows:records.length,
    identicalRoutes:spec.routes.filter(key=>content(envelope(key).records as SnapshotRecord[])===reference),
  };
}
export function getRevisionInventory() {
  return currentSnapshots.map(source=>{
    const key=source.requestEcho.tableKey;const active=governedSnapshotByKey.get(key);
    const changed=!active||content(active.records)!==content(source.records as SnapshotRecord[]);
    return {key,changed,activeRows:active?.records.length??0,currentRows:source.records.length};
  });
}
