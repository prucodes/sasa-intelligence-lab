import { describe, expect, it } from 'vitest';
import { eligibleReviewRows, getOverviewIssues } from '@/lib/overview';
import { getCollectionProcurementSummary } from '@/lib/analytics';

describe('connected overview evidence', () => {
  it('keeps the three source quantities separate and reconciles every total', () => {
    const issues = getOverviewIssues();
    expect(issues.map((issue) => issue.id)).toEqual(['collection', 'sanitation', 'processing']);
    expect(issues.map((issue) => issue.total)).toEqual([1019, 8479, 1353366]);
    expect(issues.map((issue) => issue.rows.length)).toEqual([83, 117, 119]);
    expect(issues[2].excluded).toBe(1);
    for (const issue of issues) {
      expect(issue.total).toBe(issue.rows.reduce((sum, row) => sum + row.value, 0));
      expect(issue.basis).toBe(issue.rows.reduce((sum, row) => sum + row.basis, 0));
      expect(issue.completed).toBe(issue.rows.reduce((sum, row) => sum + row.completed, 0));
      expect(new Set(issue.rows.map((row) => row.key)).size).toBe(issue.rows.length);
      expect(issue.rows.map((row) => row.value)).toEqual(issue.rows.map((row) => row.value).sort((a, b) => b - a));
      const districts = [...new Set(issue.rows.map((row) => row.district))];
      expect(districts.reduce((sum, district) => sum + issue.rows.filter((row) => row.district === district).reduce((sub, row) => sub + row.value, 0), 0)).toBe(issue.total);
    }
  });

  const base = getCollectionProcurementSummary().rows[0];
  const measures = (row: typeof base) => [row.workOrders, row.supplied];
  it('retains a reported zero, but holds out a blank, invalid number or identity', () => {
    expect(eligibleReviewRows([{ ...base, supplied: 0 }], measures).rows).toHaveLength(1);
    for (const supplied of [null, NaN, Infinity, -1]) {
      expect(eligibleReviewRows([{ ...base, supplied }], measures)).toEqual({ rows: [], excluded: 1 });
    }
    expect(eligibleReviewRows([{ ...base, district: ' ' }], measures).excluded).toBe(1);
  });

  it('counts identical measurements once and excludes both disputed values', () => {
    expect(eligibleReviewRows([base, { ...base }], measures).rows).toHaveLength(1);
    expect(eligibleReviewRows([base, { ...base, supplied: base.supplied! + 1 }], measures)).toEqual({ rows: [], excluded: 1 });
    expect(eligibleReviewRows([base], measures, () => false).rows).toHaveLength(0);
  });

  it('refuses an accidentally mixed source, period or grain', () => {
    for (const override of [{ period: 'another period' }, { tableKey: 'another source' }, { grain: 'District' as const }]) {
      expect(() => eligibleReviewRows([base, { ...base, ...override }], measures)).toThrow('one source, period and grain');
    }
  });
});
