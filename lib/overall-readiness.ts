import {getRankingDefinition,rankSubject,type RankingSubject} from './subject-rankings';

const subjects: RankingSubject[]=['toilets','vehicles','legacy'];
export interface OverallReadiness {
  alignedSubjects:string[];
  periods:string[];
  exactCandidateOverlap:number;
  validThreeSubjectCandidates:number;
  validCoveragePercent:number;
  zeroToiletAndVehicle:number;
  nonDegenerateCandidates:number;
  scoreRange:{minimum:number;maximum:number};
  verdict:'gated';
  reasons:string[];
}

/** Tests the aligned July delivery sources without manufacturing a composite score. */
export function getOverallReadiness():OverallReadiness {
  const definitions=subjects.map(id=>getRankingDefinition(id));
  const maps=definitions.map(def=>new Map(rankSubject(def.inputs).rows.filter(row=>row.candidate).map(row=>[row.candidate!,row])));
  const exact=[...maps[0].keys()].filter(key=>maps.every(map=>map.has(key)));
  const valid=exact.map(key=>maps.map(map=>map.get(key)!));
  const degenerate=valid.filter(rows=>rows[0].rate===0&&rows[1].rate===0).length;
  const scores=valid.map(rows=>rows.reduce((sum,row)=>sum+row.rate,0)/rows.length);
  return {alignedSubjects:definitions.map(def=>def.label),periods:[...new Set(definitions.map(def=>def.period))],exactCandidateOverlap:exact.length,
    validThreeSubjectCandidates:valid.length,validCoveragePercent:exact.length?valid.length/exact.length*100:0,zeroToiletAndVehicle:degenerate,
    nonDegenerateCandidates:valid.length-degenerate,scoreRange:{minimum:scores.length?Math.min(...scores):0,maximum:scores.length?Math.max(...scores):0},verdict:'gated',
    reasons:['No shared canonical ULB code is carried by all three source families; the overlap is exact source name + district only.',`Only the valid three-subject intersection can be compared, leaving ${valid.length} candidates.`,`${degenerate} of those ${valid.length} have zero reported toilet and vehicle rates, so an equal-weight composite is structurally dominated by two zero reports.`,'The retained subjects are delivery measures with different denominators and meanings; no approved weighting policy exists.']};
}
