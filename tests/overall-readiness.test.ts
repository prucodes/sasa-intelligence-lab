import {describe,it,expect} from 'vitest';
import {getOverallReadiness} from '@/lib/overall-readiness';
describe('overall delivery readiness',()=>{
  it('quantifies why a composite remains gated',()=>{
    const r=getOverallReadiness();
    expect(r.alignedSubjects).toEqual(['Household toilet delivery','Vehicle supply fulfilment','Legacy waste clearance']);
    expect(r.periods).toEqual(['July 2026']);expect(r.exactCandidateOverlap).toBe(18);expect(r.validThreeSubjectCandidates).toBe(18);
    expect(r.validCoveragePercent).toBe(100);expect(r.zeroToiletAndVehicle).toBe(17);expect(r.nonDegenerateCandidates).toBe(1);
    expect(r.scoreRange.minimum).toBeGreaterThan(0);expect(r.scoreRange.maximum).toBeGreaterThan(r.scoreRange.minimum);expect(r.verdict).toBe('gated');
  });
});
