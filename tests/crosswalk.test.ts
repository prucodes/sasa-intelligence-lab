import { describe, expect, it } from 'vitest';
import { anchorByDistrict, anchorConflictCount, anchorRegistry, crosswalkQueue, crosswalkStats, sameDistrict, serializeDecisions } from '@/lib/crosswalk';

describe('anchor registry', () => {
  it('is the 123-entity source-provided spine', () => {
    expect(anchorRegistry).toHaveLength(123);
    expect(new Set(anchorRegistry.map((entity) => entity.ulbId)).size).toBe(123);
  });

  it('has no id-to-name or name-to-id conflict across the anchor family', () => {
    expect(anchorConflictCount()).toBe(0);
  });
});

describe('resolution coverage', () => {
  const stats = crosswalkStats();

  it('resolves the large majority of observed names by exact match alone', () => {
    expect(stats.totalPairs).toBe(1408);
    expect(stats.resolvedPairs).toBe(1151);
    expect(stats.residualPairs).toBe(stats.totalPairs - stats.resolvedPairs);
  });

  it('leaves a bounded, reviewable residual queue', () => {
    expect(stats.residualNames).toBe(crosswalkQueue().length);
    expect(stats.residualNames).toBeLessThan(120);
    expect(stats.singleCandidate + stats.ambiguous + stats.crossDistrictOnly + stats.unmatched).toBe(stats.residualNames);
  });
});

describe('district scoping guards the ambiguous-name traps', () => {
  const queue = crosswalkQueue();
  const find = (name: string, district: string) =>
    queue.find((item) => item.sourceName.toLowerCase() === name.toLowerCase() && item.sourceDistrict.toLowerCase() === district.toLowerCase());

  it('never proposes a same-district match across a district boundary', () => {
    for (const item of queue) {
      for (const candidate of item.candidates) {
        if (candidate.sameDistrict) expect(sameDistrict(item.sourceDistrict, candidate.district)).toBe(true);
      }
    }
  });

  // District names vary as much as ULB names; comparing them exactly broke the scoping.
  it('treats district spelling variants as the same district', () => {
    expect(sameDistrict('Anantapur', 'ANANTHAPUR')).toBe(true);
    expect(sameDistrict('Nandyala', 'NANDYAL')).toBe(true);
    expect(sameDistrict('Kadapa', 'YSR KADAPA')).toBe(true);
    expect(sameDistrict('West Godavari District', 'WEST GODAVARI')).toBe(true);
    expect(sameDistrict('Ambedkar Konaseema', 'DR. B.R AMBEDKAR KONASEEMA')).toBe(true);
  });

  it('does not merge genuinely different districts', () => {
    expect(sameDistrict('Kurnool', 'SPSR NELLORE')).toBe(false);
    expect(sameDistrict('Prakasam', 'BAPATLA')).toBe(false);
  });

  it('reaches a renamed city that similarity alone would miss', () => {
    const item = find('Rajamahendravaram', 'East Godavari');
    expect(item?.tier).toBe('single-candidate');
    expect(item?.candidates[0].name.toUpperCase()).toBe('RAJAHMUNDRY');
  });

  it('routes the Kurnool Gudur to the Kurnool anchor once districts resolve', () => {
    const item = find('Gudur (KNL)', 'Kurnool');
    expect(item?.candidates[0].name.toUpperCase()).toBe('GUDUR_KURNOOL');
    expect(item?.candidates[0].sameDistrict).toBe(true);
  });

  it('routes the Nellore Atmakur to the Nellore anchor', () => {
    const item = find('Atmakur (NLR)', 'SPSR Nellore');
    expect(item?.tier).toBe('single-candidate');
    expect(item?.candidates[0].district.toUpperCase()).toContain('NELLORE');
  });

  it('flags the Kurnool Atmakur rather than taking its higher-scoring Nellore match', () => {
    const item = find('Atmakur K', 'Kurnool');
    expect(item?.tier).toBe('cross-district');
    // The top raw-similarity candidate is the wrong district — the flag is what prevents the error.
    expect(item?.candidates.every((candidate) => !candidate.sameDistrict)).toBe(true);
  });

  it('keeps a high-similarity different-district proposal out of the auto-resolvable tier', () => {
    const item = find('Addanki', 'Prakasam');
    expect(item?.tier).toBe('cross-district');
    expect(item?.candidates[0].score).toBeGreaterThan(0.85);
    expect(item?.candidates[0].sameDistrict).toBe(false);
  });

  it('records names with no plausible anchor as unmatched rather than forcing a match', () => {
    expect(find('Vijayawada', 'NTR')?.tier).toBe('unmatched');
    expect(find('Vijayawada', 'NTR')?.candidates).toHaveLength(0);
  });
});

describe('manual assignment', () => {
  it('exposes the whole registry grouped by district as a fallback', () => {
    const groups = anchorByDistrict();
    expect(groups.reduce((total, group) => total + group.entities.length, 0)).toBe(123);
    expect(groups.every((group) => group.entities.length > 0)).toBe(true);
  });
});

describe('exported working copy', () => {
  it('is labelled unapproved and carries its anchor provenance', () => {
    const payload = JSON.parse(serializeDecisions(
      [{ itemId: 'ntr|vijayawada', state: 'rejected', ulbId: null, decidedAt: '2026-09-01T00:00:00.000Z' }],
      crosswalkStats(),
    ));
    expect(payload.status).toContain('UNAPPROVED');
    expect(payload.anchorTableKey).toBe('sasa_mepma_households_promoted_for_home_composite_api');
    expect(payload.decisions).toHaveLength(1);
  });
});
