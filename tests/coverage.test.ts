import { describe, expect, it } from 'vitest';
import {
  coverageNote,
  coverageRatio,
  coverageTier,
  formatCoverage,
  isBareRate,
  notReturned,
  rateCoverageViolation,
  type Coverage,
} from '@/lib/coverage';
import { datasets } from '@/lib/domain';
import { getCollectionProcurementSummary, getIHHLFunnel, getDisputedValues } from '@/lib/analytics';
import { excludeDisputed } from '@/lib/disputes';

const full: Coverage = { reported: 123, expected: 123, unit: 'ULBs' };
const partial: Coverage = { reported: 102, expected: 123, unit: 'ULBs' };  // 83%
const thin: Coverage = { reported: 40, expected: 123, unit: 'ULBs' };      // 33%

describe('coverage arithmetic', () => {
  it('reports how many did not return', () => {
    expect(notReturned(thin)).toBe(83);
    expect(notReturned(full)).toBe(0);
  });

  it('never returns a negative shortfall when more rows arrive than expected', () => {
    expect(notReturned({ reported: 130, expected: 123, unit: 'ULBs' })).toBe(0);
  });

  it('returns null rather than dividing by zero', () => {
    expect(coverageRatio({ reported: 0, expected: 0, unit: 'ULBs' })).toBeNull();
  });

  it('bands a figure by how much of the population stands behind it', () => {
    expect(coverageTier(full)).toBe('full');
    expect(coverageTier(partial)).toBe('partial');
    expect(coverageTier(thin)).toBe('thin');
  });

  // The boundary that matters: a figure missing a third of the state is thin,
  // not partial. An earlier 0.6 threshold let this render at full strength.
  it('treats the live collection coverage as thin', () => {
    expect(coverageTier({ reported: 83, expected: 123, unit: 'ULBs' })).toBe('thin');
  });

  it('treats an unknown denominator as thin rather than assuming the best', () => {
    expect(coverageTier({ reported: 10, expected: 0, unit: 'ULBs' })).toBe('thin');
  });

  it('writes the shortfall into the note, because that is the part to act on', () => {
    expect(coverageNote(thin)).toContain('83 did not return');
    expect(coverageNote(full)).toContain('all returned');
  });

  it('formats the denominator compactly', () => {
    expect(formatCoverage(partial)).toBe('102 / 123');
  });
});

describe('the bare-rate rule', () => {
  it('recognises a bare rate', () => {
    expect(isBareRate('84%')).toBe(true);
    expect(isBareRate(' 7.5 % ')).toBe(true);
  });

  it('leaves counts, ratios and placeholders alone', () => {
    for (const value of ['193 rows', '29 / 30', 'Not returned', '—', '1,240 TPD', '5']) {
      expect(isBareRate(value)).toBe(false);
    }
  });

  it('rejects a rate with no denominator', () => {
    expect(rateCoverageViolation('84%')).toMatch(/no coverage/);
  });

  it('rejects a denominator smaller than what reported', () => {
    expect(rateCoverageViolation('84%', { reported: 130, expected: 123, unit: 'ULBs' }))
      .toMatch(/denominator is wrong/);
  });

  it('accepts a rate that states its denominator', () => {
    expect(rateCoverageViolation('84%', partial)).toBeNull();
  });
});

/**
 * The rule is only worth having if it holds across everything the product
 * actually renders. This walks every shipped metric in every mode, so a new
 * uncovered percentage fails here rather than reaching a reviewer.
 */
describe('every shipped metric obeys the rule', () => {
  const shipped = Object.values(datasets).flatMap((dataset) => [
    ...dataset.overview.map((metric) => ({ mode: dataset.mode, where: 'overview', metric })),
    ...dataset.readiness.cards.map((metric) => ({ mode: dataset.mode, where: 'readiness', metric })),
  ]);

  it('covers at least one metric per mode, so this test cannot pass vacuously', () => {
    expect(shipped.length).toBeGreaterThanOrEqual(Object.keys(datasets).length * 2);
  });

  it.each(shipped)('$mode $where · $metric.label', ({ metric }) => {
    expect(rateCoverageViolation(metric.value, metric.coverage)).toBeNull();
  });
});

describe('analytics summaries carry entity coverage', () => {
  it('counts ULBs that returned a supplied figure, against the anchor registry', () => {
    const { coverage } = getCollectionProcurementSummary();
    expect(coverage.unit).toBe('ULBs');
    expect(coverage.expected).toBe(123);
    expect(coverage.reported).toBeGreaterThan(0);
    // The denominator is the registry, never the rows that happened to come back.
    expect(coverage.reported).toBeLessThanOrEqual(coverage.expected);
  });

  it('counts ULBs that returned a completed figure for the IHHL funnel', () => {
    const { coverage } = getIHHLFunnel();
    expect(coverage.expected).toBe(123);
    expect(coverage.reported).toBeLessThanOrEqual(coverage.expected);
    expect(rateCoverageViolation('84%', coverage)).toBeNull();
  });
});


/**
 * A disputed value is an unknown value. Summing both rows reports a figure no
 * source ever stated, which is how Nellore's sweeping machines became 23.
 */
describe('disputed values leave the aggregate', () => {
  it('finds the twelve disagreements across the retained snapshots', () => {
    const disputed = getDisputedValues();
    expect(disputed.total).toBe(12);
    expect(disputed.datasets).toBe(2);
  });

  it('drops both rows of a disputed place rather than summing them', () => {
    const rows = [
      { district_name: 'SPSR Nellore', ulb_name: 'Nellore', month_number: '7', machines: '19' },
      { district_name: 'SPSR Nellore', ulb_name: 'Nellore', month_number: '7', machines: '4' },
      { district_name: 'Kurnool', ulb_name: 'Adoni', month_number: '7', machines: '6' },
    ];
    const result = excludeDisputed(rows, 'machines');
    expect(result.excludedEntities).toBe(1);
    expect(result.excludedRows).toBe(2);
    expect(result.records).toHaveLength(1);
    // 19 + 4 would have contributed 23, a number neither row reported.
    expect(result.records.reduce((total, row) => total + Number(row.machines), 0)).toBe(6);
  });

  it('leaves byte-identical duplicates to normal deduplication', () => {
    const rows = [
      { district_name: 'D', ulb_name: 'U', month_number: '7', machines: '5' },
      { district_name: 'D', ulb_name: 'U', month_number: '7', machines: '5' },
    ];
    expect(excludeDisputed(rows, 'machines').excludedEntities).toBe(0);
  });

  it('removes the double count from the shipped sweeping-machines total', () => {
    const asset = getCollectionProcurementSummary().assets.find((item) => item.label === 'Sweeping Machines')!;
    expect(asset.disputedEntitiesExcluded).toBe(1);
    // 81 before the fix, which included Nellore twice at 19 and 4.
    expect(asset.reportedCount).toBe(58);
  });
});
