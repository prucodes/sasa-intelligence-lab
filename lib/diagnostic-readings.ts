import type { EvidenceRecord } from './domain';
import { governedSnapshotByKey, snapshotPeriod } from './snapshots';
import { authorizedCatalogue } from './catalogue';

export interface DiagnosticReading {
  id: string;
  title: string;
  family: 'delivery' | 'facility' | 'outcome';
  period: string;
  source: string;
  evidenceIds: string[];
  fields: Array<{label:string; value:number | null}>;
  value: number | string | null;
  unit: string;
  denominator: number | null;
  denominatorLabel: string;
  ratio: number | null;
  state: 'returned' | 'missing' | 'disputed' | 'invalid';
  note: string;
  warning: string | null;
}

const specs = [
  {id:'toilets',title:'Household toilets',family:'delivery',key:'sasa_sac_identification_of_new_ihhls_api',fields:[['Identified','no_of_benf_identified'],['Approved','ihhls_approved_by_mohua'],['Under construction','under_construction'],['Completed','completed']]},
  {id:'vehicles',title:'Vehicle delivery',family:'delivery',key:'sasa_sac_machinery_e_autos_service_model_api',fields:[['Target','target'],['Work orders','actual_work_order_issued','actual_wrk_order_issued'],['Supplied','achievement','no_of_vehicles_supplied_in_nos']]},
  {id:'solid-waste',title:'Processing facility',family:'facility',key:'sasa_sac_msw_processing_facilities_iswm_facilities_api',fields:[['Configured capacity','total_tpd']]},
  {id:'fstp',title:'Faecal sludge treatment',family:'facility',key:'sasa_sac_establishing_fstps_information_api',fields:[['Configured capacity','capacity_in_kld']]},
  {id:'odf',title:'Open-defecation-free status',family:'outcome',key:'sasa_sac_swacch_survekshan_information_odf_status_api',fields:[['ODF status','odf_status']]},
  {id:'gfc',title:'Garbage-free city status',family:'outcome',key:'sasa_sac_swacch_survekshan_information_gfc_status_api',fields:[['GFC status','gfc_status']]},
  {id:'rank',title:'National rank',family:'outcome',key:'sasa_sac_swacch_survekshan_information_national_rank_api',fields:[['National rank','national_rank']]},
] as const;

function raw(record:EvidenceRecord, keys:readonly string[]):string | null {
  for (const key of keys) {
    const value = record.rawFields[key];
    if (value !== undefined && value !== null) return String(value).trim() || null;
  }
  return null;
}
function numeric(value:string | null):number | null {
  if (value === null) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

/** Each reading owns one source, one period and its own evidence link. */
export function getDiagnosticReadings(records:EvidenceRecord[]):DiagnosticReading[] {
  return specs.map(spec => {
    const snapshot = governedSnapshotByKey.get(spec.key);
    const period = snapshot ? snapshotPeriod(snapshot) : 'Not returned';
    const current = records.filter(record => record.tableKey === spec.key && record.period === period && record.grain === 'ULB');
    const first = current[0];
    const signatures = new Set(current.map(record => JSON.stringify(spec.fields.map(([, ...keys])=>raw(record, keys)))));
    const values = spec.fields.map(([, ...keys])=>first ? raw(first, keys) : null);
    const quantitative = spec.family !== 'outcome' || spec.id === 'rank';
    const state:DiagnosticReading['state'] = signatures.size > 1 ? 'disputed' : !first || values.every(value=>value===null) ? 'missing' : quantitative && values.some(value=>value!==null && numeric(value)===null) ? 'invalid' : 'returned';
    const accepted = state === 'returned';
    const fields = spec.fields.map(([label],index)=>({label,value:accepted ? numeric(values[index]) : null}));
    const valueIndex = spec.family === 'delivery' ? fields.length - 1 : 0;
    const value = accepted ? quantitative ? fields[valueIndex].value : values[valueIndex] : null;
    const denominatorIndex = spec.id === 'toilets' ? 1 : 0;
    const denominator = spec.family === 'delivery' && accepted ? fields[denominatorIndex].value : null;
    const ratio = typeof value === 'number' && denominator !== null && denominator > 0 ? value / denominator : null;
    const periodConflict = first && spec.id === 'fstp' && Number(first.rawFields.month_number) === 7 && first.rawFields.month_name?.trim().toUpperCase() === 'JUNE';
    const warning = state === 'disputed' ? 'Different measurements returned for this source and period. No value is selected.'
      : state === 'invalid' ? 'A required measurement is invalid or negative. Inspect the raw source.'
        : periodConflict ? 'Period conflict: month number is 7; month name is JUNE. No alignment is assumed.'
          : null;
    const note = state === 'missing' ? 'No usable reading for this source’s latest retained period. Missing is not zero.'
      : warning ?? (spec.family === 'delivery' ? denominator === 0 ? 'No rate: the denominator is reported as zero.' : ratio === null ? 'No rate: a required measurement was not returned.' : 'Reported quantity only—not service quality or an explanation of cause.'
        : spec.family === 'facility' ? 'Configured capacity—not actual throughput or utilization.'
          : 'Historical 2024 context—not a current operational outcome.');
    return {
      id:spec.id,title:spec.title,family:spec.family,period,source:first?.dataset ?? authorizedCatalogue.find(source=>source.tableKey===spec.key)?.catalogueName ?? spec.title,
      evidenceIds:current.map(record=>record.id),fields,value,
      unit:spec.id==='toilets'?'completed':spec.id==='vehicles'?'supplied':spec.id==='solid-waste'?'TPD':spec.id==='fstp'?'KLD':spec.id==='rank'?'national rank':'source status',
      denominator,denominatorLabel:spec.id==='toilets'?'approved':spec.id==='vehicles'?'target':'',ratio,state,note,warning,
    };
  });
}
