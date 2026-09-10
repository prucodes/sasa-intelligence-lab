import {datasets} from './domain';
import {sourceCandidateKey} from './snapshots';
import type {ReviewIssueId} from './overview';

export const ulbComparisonSources:Record<ReviewIssueId,string>={sanitation:'sasa_sac_identification_of_new_ihhls_api',collection:'sasa_sac_machinery_e_autos_service_model_api',processing:'sasa_100_percent_clearance_of_legacy_waste_api'};
/** Resolve an existing diagnostics file by its exact source record, never by a guessed route. */
export function comparisonDiagnosticKey(candidate:string,subject:ReviewIssueId,period:string){
  const matches=datasets.SAMPLE.diagnostics.filter(diagnostic=>diagnostic.evidence.some(record=>record.tableKey===ulbComparisonSources[subject]&&record.period===period&&record.grain==='ULB'&&sourceCandidateKey(record.rawFields)===candidate));
  return matches.length===1?matches[0].ulbKey:null;
}
