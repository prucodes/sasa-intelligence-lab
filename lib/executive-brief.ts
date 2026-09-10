import type { DataMode } from './domain';
import { getOverviewIssues } from './overview';
import { authorizedCatalogue } from './catalogue';
import { governedSnapshotByKey, governedSnapshotStats, snapshotPeriod, currentSnapshotRecords } from './snapshots';

const sourceKeys = {
  collection:'sasa_sac_machinery_e_autos_service_model_api',
  sanitation:'sasa_sac_identification_of_new_ihhls_api',
  processing:'sasa_100_percent_clearance_of_legacy_waste_api',
};
const outcomeKeys = ['sasa_sac_swacch_survekshan_information_odf_status_api','sasa_sac_swacch_survekshan_information_gfc_status_api','sasa_sac_swacch_survekshan_information_national_rank_api'];
export const briefNumber = (value:number) => value.toLocaleString('en-IN',{maximumFractionDigits:2});

export function getExecutiveBrief(mode:DataMode) {
  const governed = mode === 'SAMPLE';
  // Mode isolation is intentional: a Demo/Live brief must never contain governed findings.
  const issues = governed ? getOverviewIssues() : [];
  const sources = governed ? [...Object.values(sourceKeys),...outcomeKeys].map(key=>{
    const snapshot = governedSnapshotByKey.get(key)!;
    return {key,name:authorizedCatalogue.find(source=>source.tableKey===key)?.catalogueName ?? snapshot.responseMetadata.tableName,period:snapshotPeriod(snapshot),responseId:snapshot.responseMetadata.responseId,
      generatedAt:snapshot.responseMetadata.generatedAt,rows:snapshot.records.length,latestRows:currentSnapshotRecords(snapshot).length};
  }) : [];
  return {governed,mode,
    title:governed?'Executive evidence brief':'Capability brief',
    scope:governed?'Whole retained snapshot · latest period per source. Screen filters, selected ULBs and local crosswalk decisions are not applied.':mode==='DEMO'?'Demo mode · synthetic capability story. No governed findings included.':'Live mode · roadmap only. No runtime Data Lake connection or current findings.',
    footprint:governed?{datasets:governedSnapshotStats.completeDatasets,rows:governedSnapshotStats.records,observed:governedSnapshotStats.baselineUlbCandidates}:null,
    issues,sources,
    nextActions:['Confirm delivery status with the source owners for the named records. The data does not establish why quantities remain open.','Obtain aligned operational and outcome periods, complete formal identity approval, resolve source disputes and agree a scoring policy.'],
    boundary:'UNSCORED. Counts support descriptive review only. Blank is not zero; disputed measurements are excluded, never averaged; source grain and periods remain separate.',
  };
}

export function executiveBriefText(brief:ReturnType<typeof getExecutiveBrief>,preparedAt:string):string {
  return [
    `SASA INTELLIGENCE LAB · ${brief.title.toUpperCase()}`,
    `Export prepared: ${preparedAt} (not a source update time)`,
    `SCOPE: ${brief.scope}`,
    brief.governed?brief.boundary:'Switch to Governed data for an authenticated retained-evidence brief.',
    ...(brief.footprint?[`${brief.footprint.datasets} complete retained datasets · ${briefNumber(brief.footprint.rows)} retained rows · ${brief.footprint.observed} observed ULB-name reference candidates, not an official statewide denominator.`]:[]),
    ...brief.issues.flatMap(issue=>[
      '',`${issue.title.toUpperCase()} · ${issue.period} · ${issue.source} · ULB grain`,
      `${issue.rows.length?briefNumber(issue.total):'Not returned'} ${issue.quantity}`,
      issue.rows.length ? `${briefNumber(issue.completed)} ${issue.completedLabel} / ${briefNumber(issue.basis)} ${issue.basisLabel} within the same eligible cohort.` : 'Quantities not returned in an eligible cohort.',
      `Coverage: ${issue.rows.length} eligible candidates / ${brief.footprint!.observed} observed-name reference frame; ${issue.excluded} rows or candidate groups excluded by evidence checks.`,
      `Largest reported quantities: ${issue.rows.filter(row=>row.value>0).slice(0,3).map(row=>`${row.ulb} (${row.district}): ${briefNumber(row.value)} ${issue.unit}`).join('; ') || 'None returned in the eligible cohort.'}`,
      issue.boundary,
    ]),
    ...(brief.governed?['','HISTORICAL OUTCOMES · NOT ALIGNED WITH OPERATIONS',...brief.sources.filter(source=>outcomeKeys.includes(source.key)).map(source=>`${source.name}: ${source.latestRows} source rows · ${source.period}. Row counts are not certified entity counts.`),'','NEXT REVIEW ACTIONS',...brief.nextActions,'','SOURCE PROVENANCE · RESPONSE TIME IS NOT THE REPORTING PERIOD',...brief.sources.map(source=>`${source.name} | ${source.key} | latest period ${source.period} | ${source.rows} retained rows across all periods | response ${source.responseId} | response generated ${source.generatedAt}`)]:[]),
    '',
  ].join('\n');
}
