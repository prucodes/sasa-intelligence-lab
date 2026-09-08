import { describe, expect, it } from 'vitest';
import { getIhhlReconciliation, ihhlConstructionSources, reconcileSources } from '@/lib/source-reconciliation';
import { governedSnapshotByKey } from '@/lib/snapshots';

describe('cross-source reconciliation', () => {
  it('joins both retained IHHL sources completely on district and month', () => {
    const result = getIhhlReconciliation();
    // 28 districts x May, June, July, present in both sources with nothing left over.
    expect(result.matched).toBe(84);
    expect(result.districts).toBe(28);
    expect(result.months).toEqual([5, 6, 7]);
    expect(result.leftOnly).toEqual([]);
    expect(result.rightOnly).toEqual([]);
  });

  it('refuses to combine two sources whose targets never coincide', () => {
    const result = getIhhlReconciliation();
    expect(result.targetsCoincide).toBe(0);
    expect(result.refusal).toContain('two separate programmes');
    // The refusal is the finding. No combined total is exposed for a caller to render.
    expect(result).not.toHaveProperty('combinedTarget');
    expect(result).not.toHaveProperty('combinedAchievement');
  });

  it('reports how each achievement column behaves without naming an accounting basis', () => {
    const result = getIhhlReconciliation();
    // Housing never falls across the three months; SBM falls in most districts.
    expect(result.left.basis).toBe('non-decreasing');
    expect(result.left.nonDecreasingDistricts).toBe(28);
    expect(result.left.districtsWithSeries).toBe(28);
    expect(result.right.basis).toBe('varies');
    expect(result.right.nonDecreasingDistricts).toBe(7);
    // 'cumulative' and 'monthly' are conclusions the data does not support.
    expect(['non-decreasing', 'varies', 'indeterminate']).toContain(result.left.basis);
  });

  it('keeps a reported zero but holds out a blank, negative or disputed measurement', () => {
    const spec = { ...ihhlConstructionSources[0], tableKey: 'test-left' };
    const other = { ...ihhlConstructionSources[1], tableKey: 'test-right' };
    const row = (district: string, month: string, target: string, achievement: string) => ({
      lgd_district_name: district, month_no: month, year: '2026',
      construction_of_ihhls_target_units: target, construction_of_ihhls_achievement: achievement,
      ihhls_target_units: target, ihhls_achievement: achievement,
    });
    const envelope = (tableKey: string, records: Record<string, string>[]) => ({
      requestEcho: { departmentId: 'd', requestId: 'r', purpose: 'p', tableKey, filters: {} },
      responseMetadata: { responseId: 'x', generatedAt: '2026-09-08', totalRecordCount: records.length, returnedRecordCount: records.length, hasNextPage: false, nextPageToken: null, tableKey, tableName: tableKey },
      records,
    });

    governedSnapshotByKey.set('test-left', envelope('test-left', [
      row('ZERO', '5', '10', '0'),      // a genuine zero survives
      row('BLANK', '5', '10', ''),      // blank is not zero
      row('NEGATIVE', '5', '10', '-4'), // invalid
      row('DISPUTE', '5', '10', '1'),
      row('DISPUTE', '5', '10', '2'),   // same identity, two answers
    ]) as never);
    governedSnapshotByKey.set('test-right', envelope('test-right', [
      row('ZERO', '5', '7', '0'), row('BLANK', '5', '7', '3'),
      row('NEGATIVE', '5', '7', '3'), row('DISPUTE', '5', '7', '3'),
    ]) as never);

    const result = reconcileSources(spec, other);
    const zero = result.rows.find((entry) => entry.district === 'ZERO');
    expect(zero?.left.achievement).toBe(0);
    expect(result.rows.find((entry) => entry.district === 'BLANK')?.left.achievement).toBeNull();
    expect(result.rows.find((entry) => entry.district === 'NEGATIVE')?.left.achievement).toBeNull();
    // Both disputed rows are dropped together, so the district never reaches the join.
    expect(result.left.disputed).toBe(1);
    expect(result.rows.some((entry) => entry.district === 'DISPUTE')).toBe(false);
    expect(result.rightOnly).toContain('DISPUTE');

    governedSnapshotByKey.delete('test-left');
    governedSnapshotByKey.delete('test-right');
  });

  it('refuses a reconciliation when a retained source is missing', () => {
    expect(() => reconcileSources({ ...ihhlConstructionSources[0], tableKey: 'not-retained' }, ihhlConstructionSources[1]))
      .toThrow(/needs both retained sources/);
  });

  it('states the boundary that neither source checks the other', () => {
    const result = getIhhlReconciliation();
    expect(result.boundary).toContain('never summed, differenced or ranked');
    expect(result.boundary).toContain('neither source is treated as a check on the other');
  });
});
