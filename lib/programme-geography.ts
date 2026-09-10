import {getRevisionAnalysis,revisionMeasures,summarizeRevision} from './source-revisions';
import {governedSnapshotByKey} from './snapshots';
import type {DistrictMeasure} from './visual-evidence';

const historical=[
  {id:'serp-gardens',label:'SERP kitchen gardens',tableKey:'serp_kitchen_garden_api',target:'shg_kitchen_garden_target_units',achievement:'shg_kitchen_garden_cummulative_achievement_till_current_month',grain:'District',unit:'source units'},
  {id:'serp-awareness',label:'SERP Swachhata awareness',tableKey:'serp_swachhata_awareness_api',target:'shg_swachhata_awareness_target_units',achievement:'shg_swachhata_awareness_cummulative_achievement_till_current_month',grain:'District',unit:'source units'},
  {id:'serp-circular',label:'SERP circular economy',tableKey:'serp_circular_economy_api',target:'circular_economy_entrepreneurs_target_units',achievement:'circular_economy_entrepreneurs_cummulative_achievement_till_current_month',grain:'District',unit:'entrepreneurs'},
  {id:'terrace',label:'Terrace / kitchen gardens',tableKey:'sasa_households_promoted_for_terrace_gardening_kitchen_gardens_api',target:'target',achievement:'achievement',grain:'ULB',unit:'households'},
  {id:'home-compost',label:'Home composting',tableKey:'sasa_mepma_households_promoted_for_home_composite_api',target:'target',achievement:'achievement',grain:'ULB',unit:'households'},
  {id:'mepma-circular',label:'MEPMA circular-economy entrepreneurs',tableKey:'sasa_mepma_entrepreneurs_promoted_for_circular_economy_api',target:'target',achievement:'achievement',grain:'ULB',unit:'entrepreneurs'},
  {id:'ewaste',label:'E-waste collection mechanism',tableKey:'sasa_cdma_ulbs_ewaste_collection_mechanism_api',target:'target',achievement:'achievement',grain:'District',unit:'source units'},
  {id:'plastic-ban',label:'Single-use plastic ban',tableKey:'sasa_cdma_ulbs_single_use_plastic_ban_api',target:'target',achievement:'achievement',grain:'District',unit:'source units'},
  {id:'itc',label:'ITC WOW in schools',tableKey:'sasa_itc_wow_program_in_schools_api',target:'target',achievement:'achievement',grain:'District',unit:'schools'},
];
export const geographicProgrammes=[...revisionMeasures.filter(spec=>['green-spaces','green-cover','water-bodies','odf-villages','plastic-units'].includes(spec.id)),...historical];

export function getProgrammeGeography(id:string,period?:string){
  const legacy=historical.find(spec=>spec.id===id);
  const source=legacy?governedSnapshotByKey.get(legacy.tableKey):null;
  const analysis=legacy&&source?{...summarizeRevision(source.records,legacy,period),spec:legacy,retainedAt:source.responseMetadata.generatedAt,rawRows:source.records.length}:getRevisionAnalysis(id,period);
  const districts=[...new Set(analysis.rows.map(row=>row.district).filter((value):value is string=>Boolean(value)))];
  const mapRows:DistrictMeasure[]=districts.map(district=>{
    const all=analysis.rows.filter(row=>row.district===district);
    const paired=all.filter(row=>row.target!==null&&row.achievement!==null);
    const target=paired.reduce((sum,row)=>sum+row.target!,0),achieved=paired.reduce((sum,row)=>sum+row.achievement!,0);
    return {district,value:paired.length&&target>0?achieved/target*100:null,detail:`${paired.length} paired ${analysis.spec.grain==='ULB'?'ULB':'district'} candidates · ${paired.length?`${achieved.toLocaleString('en-IN',{maximumFractionDigits:2})} achieved / ${target.toLocaleString('en-IN',{maximumFractionDigits:2})} targeted ${analysis.spec.unit}`:'Paired quantities not available'} · ${all.length-paired.length} excluded from the ratio for missing measures`};
  });
  return {...analysis,mapRows};
}
