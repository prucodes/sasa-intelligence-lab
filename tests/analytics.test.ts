import { describe, expect, it } from 'vitest';
import {
  getCollectionProcurementSummary,
  getCommunityProgrammeSummary,
  getCommunityProgrammeHistory,
  getDataQualityIssues,
  getDatasetUsageAudit,
  getDatasetPeriodAvailability,
  getDistrictCollectionAssetSummary,
  getEntityEvidenceBreadth,
  getEntityCoverageMatrix,
  getFacilityStatusReviewQueue,
  getIHHLFunnel,
  getLegacyWasteSummary,
  getProcessingRegistry,
  getSourceReconciliationIssues,
  getSupportingProgrammePortfolio,
  getSwachhOutcomeSummary,
} from '@/lib/analytics';

describe('operational analytics selectors', () => {
  it('calculates the collection funnel from retained E-Auto records', () => {
    const summary = getCollectionProcurementSummary();
    expect(summary.target).toBe(1910);
    expect(summary.workOrders).toBe(1153);
    expect(summary.supplied).toBe(134);
    expect(summary.deliveryGap).toBe(1780);
    expect(summary.deliveryRatio).toBeCloseTo(134 / 1910);
    expect(summary.workOrderRatio).toBeCloseTo(1153 / 1910);
    expect(summary.rows.every((row) => row.tableKey && row.responseId && row.period)).toBe(true);
  });

  it('preserves collection dataset grain', () => {
    const summary = getCollectionProcurementSummary();
    expect(summary.rows.every((row) => row.grain === 'ULB')).toBe(true);
    expect(summary.assets.find((item) => item.label === 'Door-to-Door E-Autos')?.grain).toBe('District');
    expect(summary.assets.find((item) => item.label === 'Compactors')?.grain).toBe('ULB');
  });

  it('keeps district collection achievement separate from ULB procurement', () => {
    const summary = getDistrictCollectionAssetSummary();
    expect(summary.assets).toHaveLength(3);
    expect(summary.assets.map((item) => [item.target, item.achievement])).toEqual([[200, 200], [5000, 5000], [12000, 12000]]);
    expect(summary.rows.every((row) => row.grain === 'District')).toBe(true);
    expect(summary.compactors).toBe(25);
    expect(summary.sweepingMachines).toBe(81);
    expect(summary.sweepingAmbiguities).toBe(2);
  });

  it('builds a traceable legacy-waste clearance and balance review', () => {
    const summary = getLegacyWasteSummary();
    expect(summary.target).toBe(14933110);
    expect(summary.achievement).toBe(13569745);
    expect(summary.balance).toBe(1353366);
    expect(summary.clearanceRatio).toBeCloseTo(0.9087018712);
    expect(summary.positiveBalanceCandidates).toBe(47);
    expect(summary.zeroBalanceCandidates).toBe(73);
    expect(summary.increasedSincePreviousPeriod).toBe(25);
    expect(summary.unchangedSincePreviousPeriod).toBe(95);
    expect(summary.balanceConflicts).toBe(1);
    expect(summary.rows.every((row) => row.tableKey && row.responseId && row.raw)).toBe(true);
  });

  it('suppresses zero-approval ratios and excludes exact duplicates from IHHL totals', () => {
    const funnel = getIHHLFunnel();
    expect(funnel.rows).toHaveLength(117);
    expect(funnel.duplicateRowsExcluded).toBe(2);
    expect(funnel.zeroApprovalRows).toBe(58);
    expect(funnel.rows.filter((row) => row.approved === 0).every((row) => row.completionRatio === null)).toBe(true);
    expect(funnel.identified).toBe(8499);
    expect(funnel.approved).toBe(8499);
    expect(funnel.completed).toBe(20);
  });

  it('uses the latest governed period for complete MEPMA programme exports', () => {
    const summary = getCommunityProgrammeSummary();
    expect(summary.period).toBe('July 2026');
    expect(summary.items).toHaveLength(3);
    expect(summary.items.every((item) => item.records === 123 && item.grain === 'ULB')).toBe(true);
    expect(summary.items.every((item) => item.achievementRatio !== null)).toBe(true);
  });

  it('parses configured capacity without relabeling it as performance', () => {
    const registry = getProcessingRegistry();
    expect(registry.configuredTpd).toBe(6012);
    expect(registry.configuredKld).toBe(600);
    expect(registry.rows.find((row) => row.facilityType === 'ISWM')?.configuredCapacity).toBe(30);
    expect(registry.rows.find((row) => row.facilityType === 'FSTP')?.unit).toBe('KLD');
    expect(registry.rows.find((row) => row.facilityType === 'Plastic Waste')?.grain).toBe('District');
  });

  it('checks ISWM wet + dry consistency and retains every FSTP period conflict', () => {
    const registry = getProcessingRegistry();
    expect(registry.splitConflicts).toBe(0);
    expect(registry.rows.filter((row) => row.facilityType === 'ISWM').every((row) => row.splitCheck === 'pass')).toBe(true);
    expect(registry.periodConflicts).toBe(35);
    expect(registry.rows.filter((row) => row.facilityType === 'FSTP').every((row) => row.periodConflict)).toBe(true);
  });

  it('routes exact ISWM source-status exceptions without inferring causes', () => {
    const queue = getFacilityStatusReviewQueue();
    expect(queue).toHaveLength(34);
    expect(queue.every((row) => /^(site not available|not commenced|local issue|approach road)$/i.test(row.sourceStatus))).toBe(true);
  });

  it('keeps 2024 outcomes descriptive and separate from operational periods', () => {
    const outcomes = getSwachhOutcomeSummary();
    expect(outcomes.reportingYear).toBe('2024');
    expect(outcomes.odfRecords).toBe(85);
    expect(outcomes.gfcRecords).toBe(5);
    expect(outcomes.rankRecords).toBe(74);
    expect(outcomes.rows.every((row) => row.period === '2024')).toBe(true);
  });

  it('builds overlap counts from returned candidate records', () => {
    const coverage = getEntityCoverageMatrix();
    expect(coverage.candidateCount).toBe(123);
    for (const overlap of coverage.overlaps) {
      const [left, right] = overlap.label.split(' × ');
      const map = { 'ISWM': 'iswm', 'IHHL': 'ihhl', 'E-Auto': 'eAuto' } as const;
      const expected = coverage.rows.filter((row) => row.states[map[left as keyof typeof map]] !== 'not-returned'
        && row.states[map[right as keyof typeof map]] !== 'not-returned').length;
      expect(overlap.count).toBe(expected);
    }
    expect(coverage.rows.some((row) => row.states.gfc === 'not-returned')).toBe(true);
    expect(coverage.rows.filter((row) => row.states.gfc === 'not-returned').every((row) => row.states.gfc !== 'returned')).toBe(true);
  });

  it('measures operational evidence breadth without calling it official completeness', () => {
    const breadth = getEntityEvidenceBreadth();
    expect(breadth.sourceCount).toBe(15);
    expect(breadth.candidateCount).toBe(250);
    expect(breadth.topCandidates[0].sourceCount).toBe(12);
    expect(breadth.distribution.reduce((total, item) => total + item.candidates, 0)).toBe(250);
  });

  it('builds deterministic source-reconciliation queues', () => {
    const issues = getSourceReconciliationIssues();
    const count = (id: string) => issues.find((issue) => issue.id === id)?.count;
    expect(count('recon-duplicates')).toBe(6);
    expect(count('recon-ambiguous')).toBe(12);
    expect(count('recon-percentage')).toBe(296);
    expect(count('recon-zero-target')).toBe(104);
    expect(count('recon-above-target')).toBe(22);
    expect(count('recon-period')).toBe(35);
    expect(count('recon-balance')).toBe(1);
  });

  it('builds five-period reported history without manufacturing a composite score', () => {
    const history = getCommunityProgrammeHistory();
    expect(history).toHaveLength(3);
    expect(history.every((series) => series.points.length === 5)).toBe(true);
    expect(history.every((series) => series.points.every((point) => point.coverage !== null))).toBe(true);
    expect(history.reduce((total, series) => total + series.percentageConflicts, 0)).toBe(849);
  });

  it('promotes every retained non-primary source into the supporting programme portfolio', () => {
    const portfolio = getSupportingProgrammePortfolio();
    expect(portfolio).toHaveLength(13);
    expect(portfolio.every((item) => item.records > 0 && item.coverage !== null)).toBe(true);
    expect(portfolio.find((item) => item.tableKey === 'serp_circular_economy_api')?.coverage).toBeGreaterThan(1);
  });

  it('accounts for all 46 catalogue entries and distinguishes used from unavailable data', () => {
    const audit = getDatasetUsageAudit();
    expect(audit.total).toBe(46);
    expect(audit.used).toBe(29);
    expect(audit.primary).toBe(16);
    expect(audit.supporting).toBe(13);
    // Gobardhan alone: authorized, and every route to it still fails.
    expect(audit.unavailable).toBe(1);
    // Documented on paper only, endpoint not live (3 PR + 10 CDMA that 404).
    expect(audit.pending).toBe(13);
    // Live and readable on 2 September, no retained snapshot yet. This is the
    // only bucket that can be acted on without waiting for anyone else.
    expect(audit.awaitingPull).toBe(3);
    expect(audit.awaitingPullRows).toBe(193424);
    // Every entry lands in exactly one bucket.
    expect(audit.primary + audit.supporting + audit.pending + audit.unavailable + audit.awaitingPull).toBe(audit.total);
    expect(audit.rows.filter((row) => row.records > 0)).toHaveLength(29);
    // Reachable is not retained: an awaiting-pull row carries no records.
    expect(audit.rows.filter((row) => row.state === 'awaiting-pull').every((row) => row.records === 0)).toBe(true);
  });

  it('enumerates only periods represented by retrieved governed responses', () => {
    const periods = getDatasetPeriodAvailability();
    const fstp = periods.find((row) => row.tableKey.includes('establishing_fstps'))!;
    const outcomes = periods.filter((row) => /odf_status|gfc_status|national_rank/.test(row.tableKey));
    const gobardhan = periods.find((row) => row.tableKey.includes('gobardhan'))!;
    const documentedPr = periods.filter((row) => row.tableKey.startsWith('sasa_pr_'));
    expect(fstp.years).toEqual([2026]);
    expect(fstp.months).toEqual([6, 7]);
    expect(fstp.conflict).toBe(true);
    expect(outcomes.every((row) => row.years.join() === '2024' && row.months.length === 0)).toBe(true);
    expect(gobardhan.retrieved).toBe(false);
    expect(documentedPr).toHaveLength(3);
    expect(documentedPr.every((row) => !row.retrieved && row.years.length === 0 && row.months.length === 0)).toBe(true);
    expect(documentedPr.every((row) => row.period.includes('documentation example only'))).toBe(true);
  });

  it('surfaces evidence issues as operational quality states', () => {
    const issues = getDataQualityIssues();
    expect(issues.find((item) => item.id === 'duplicates')?.count).toBe(6);
    expect(issues.find((item) => item.id === 'period-conflicts')?.count).toBe(35);
    expect(issues.find((item) => item.id === 'unavailable')?.count).toBe(1);
    expect(issues.find((item) => item.id === 'pagination')?.count).toBe(0);
    expect(issues.find((item) => item.id === 'documented-pr')?.count).toBe(3);
    expect(issues.find((item) => item.id === 'pr-pagination')?.count).toBe(1);
    expect(issues.find((item) => item.id === 'pr-semantics')?.count).toBe(2);
    expect(issues.find((item) => item.id === 'stale-filter-contracts')?.count).toBe(13);
    expect((issues.find((item) => item.id === 'history')?.count ?? 0)).toBeGreaterThan(0);
  });
});
