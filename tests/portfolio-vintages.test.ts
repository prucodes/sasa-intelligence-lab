import { describe, expect, it, afterEach } from 'vitest';
import { getSupportingProgrammePortfolio } from '@/lib/analytics';
import { governedSnapshotByKey, type SnapshotEnvelope } from '@/lib/snapshots';

/**
 * The three "50 percent" programmes have two column vocabularies in the wild.
 *
 * August: three separate datasets, generic `target`/`achievement`.
 * September: one merged table served under all three keys, each programme carrying its
 * own named columns. The portfolio must read the right measure from either, and three
 * keys pointing at one merged table must not produce three copies of one number.
 */
const KEYS = [
  'sasa_50_percent_green_spaces_api',
  'sasa_50_percent_greencover_api',
  'sasa_50_percent_rejuvenation_api',
] as const;

const original = new Map(KEYS.map((key) => [key, governedSnapshotByKey.get(key)!]));
afterEach(() => { for (const [key, snapshot] of original) governedSnapshotByKey.set(key, snapshot); });

/** One merged row per ULB, exactly as the September revision returns it. */
function mergedEnvelope(tableKey: string): SnapshotEnvelope {
  const records = [
    { dstrt_nm: 'Anantapur', ulb_nm: 'Rayadurg', mnth_no: '7', mnth_nm: 'JULY', year: '2026',
      green_cover_trgts_in_kms: '6.00', green_cover_achvd_in_kms: '5.00', achvd_percent_in_kms: '83.33',
      rejuvenation_of_water_bodies_in_nos_targets: '4.00', rejuvenation_of_water_bodies_achived: '1.00', rejuvenation_of_water_bodies_achived_percent: '25.00',
      green_spaces_target_in_nos: '10.00', green_spaces_achieved: '2.00', green_spaces_achieved_percent: '20.00' },
    { dstrt_nm: 'Kurnool', ulb_nm: 'Adoni', mnth_no: '7', mnth_nm: 'JULY', year: '2026',
      green_cover_trgts_in_kms: '4.00', green_cover_achvd_in_kms: '3.00', achvd_percent_in_kms: '75.00',
      rejuvenation_of_water_bodies_in_nos_targets: '6.00', rejuvenation_of_water_bodies_achived: '3.00', rejuvenation_of_water_bodies_achived_percent: '50.00',
      green_spaces_target_in_nos: '20.00', green_spaces_achieved: '8.00', green_spaces_achieved_percent: '40.00' },
  ];
  return {
    requestEcho: { departmentId: 'd', requestId: 'r', purpose: 'p', tableKey, filters: {} },
    responseMetadata: { responseId: 'x', generatedAt: '2026-09-08', totalRecordCount: records.length, returnedRecordCount: records.length, hasNextPage: false, nextPageToken: null, tableKey, tableName: tableKey },
    records,
  } as unknown as SnapshotEnvelope;
}

describe('supporting portfolio across both source vintages', () => {
  it('reads the generic columns of the retained August vintage', () => {
    const portfolio = getSupportingProgrammePortfolio();
    const entries = KEYS.map((key) => portfolio.find((item) => item.tableKey === key)!);
    expect(entries.every((entry) => entry.records > 0)).toBe(true);
    // Three genuinely separate datasets, so the measures differ between them.
    expect(new Set(entries.map((entry) => entry.target)).size).toBeGreaterThan(1);
  });

  it('reads each programme’s own column when all three keys serve one merged table', () => {
    for (const key of KEYS) governedSnapshotByKey.set(key, mergedEnvelope(key));
    const portfolio = getSupportingProgrammePortfolio();
    const byKey = (key: string) => portfolio.find((item) => item.tableKey === key)!;

    // Green spaces 10+20 target / 2+8 achieved; green cover 6+4 / 5+3;
    // rejuvenation 4+6 / 1+3. One table, three distinct measures — no triple-count.
    expect(byKey('sasa_50_percent_green_spaces_api').target).toBe(30);
    expect(byKey('sasa_50_percent_green_spaces_api').achievement).toBe(10);
    expect(byKey('sasa_50_percent_greencover_api').target).toBe(10);
    expect(byKey('sasa_50_percent_greencover_api').achievement).toBe(8);
    expect(byKey('sasa_50_percent_rejuvenation_api').target).toBe(10);
    expect(byKey('sasa_50_percent_rejuvenation_api').achievement).toBe(4);
  });

  it('reconciles each programme against its own reported percentage column', () => {
    for (const key of KEYS) governedSnapshotByKey.set(key, mergedEnvelope(key));
    const portfolio = getSupportingProgrammePortfolio();
    // Every row's stated percentage matches its own measures, so nothing is flagged.
    // Reading another programme's percentage column would have produced false conflicts.
    expect(KEYS.every((key) => portfolio.find((item) => item.tableKey === key)!.percentageConflicts === 0)).toBe(true);
  });
});
