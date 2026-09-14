import {describe,it,expect} from 'vitest';
import {getOverallReadiness} from '@/lib/overall-readiness';
describe('overall delivery readiness',()=>{
  it('quantifies why a composite remains gated',()=>{
    const r=getOverallReadiness();
    expect(r.alignedSubjects).toEqual(['Household toilet delivery','Vehicle supply fulfilment','Legacy waste clearance']);
    // 49 source name + district identities are returned by all three July sources; 19 of them can be rated in all three.
    expect(r.periods).toEqual(['July 2026']);expect(r.exactCandidateOverlap).toBe(49);expect(r.validThreeSubjectCandidates).toBe(19);
    expect(r.validCoveragePercent).toBeCloseTo(19/49*100,6);expect(r.zeroToiletAndVehicle).toBe(18);expect(r.nonDegenerateCandidates).toBe(1);
    expect(r.scoreRange.minimum).toBeGreaterThan(0);expect(r.scoreRange.maximum).toBeGreaterThan(r.scoreRange.minimum);expect(r.verdict).toBe('gated');
  });
});
