import continuity from '@/data/aggregates/reporting-continuity.json';
import rural from '@/data/aggregates/rural-cohort.json';
import facilities from '@/data/aggregates/rural-swpc-districts.json';
import months from '@/data/aggregates/month-series.json';

export interface AggregateEvidence { rows:number; period:string; grain:string; quality:string }
export const aggregateEvidenceByKey = new Map<string,AggregateEvidence>(continuity.datasets.map(d=>[d.tableKey,{rows:d.rawRows,period:`${d.days[0].date} – ${d.days.at(-1)?.date}`,grain:'Secretariat · Day',quality:`${d.rows.toLocaleString('en-IN')} distinct records · grid completeness unproven`}]));
for(const [key,source] of Object.entries(rural.generatedFrom)) {
  const activity=key.includes('door_to_door');
  aggregateEvidenceByKey.set(key,{rows:source.rows,period:activity?`${rural.usableDays[0]} – ${rural.usableDays.at(-1)}`:'Register date not supplied',grain:activity?'Gram Panchayat · Date':'Gram Panchayat',quality:activity?`${rural.recordQuality.uniqueRows.toLocaleString('en-IN')} distinct records · grid completeness unproven`:`${facilities.panchayatsCounted.toLocaleString('en-IN')} registered GPs counted`});
}

// Completed monthly pulls supersede the older August-only activity inventory.
const ruralActivityKey='sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026';
aggregateEvidenceByKey.set(ruralActivityKey,{rows:Object.values(months.recordQuality).reduce((n,q)=>n+q.rawRows,0),period:`${months.periods[0]} – ${months.periods.at(-1)} · retained days vary`,grain:'Gram Panchayat · Date',quality:`${Object.values(months.recordQuality).reduce((n,q)=>n+q.uniqueRows,0).toLocaleString('en-IN')} distinct GP-days; ${months.cohort.pairs.toLocaleString('en-IN')} in the common first-week comparison`});
