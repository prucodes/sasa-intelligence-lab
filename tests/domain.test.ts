import { describe, expect, it } from 'vitest';
import { assessEligibility, classifyDemoGap, createProvider, datasets, outcomeLagYears, safeDivide, validatePeriod } from '@/lib/domain';
import { authorizedCatalogueStats, cdmaIntegrationCatalogue, documentedIntegrationCatalogue, readinessCatalogueStats, sasaCatalogue, sasaCatalogueStats } from '@/lib/catalogue';
import { governedSnapshotStats, governedSnapshots, isCompleteSnapshot } from '@/lib/snapshots';

describe('evidence-safe calculations', () => {
  it('returns null for zero and missing denominators', () => {
    expect(safeDivide(0, 0)).toEqual({ value: null, flag: 'undefined_denominator' });
    expect(safeDivide(undefined, 4)).toEqual({ value: null, flag: 'missing_value' });
  });

  it('calculates observed ratios and outcome lag', () => {
    expect(safeDivide(3, 6).value).toBe(0.5);
    expect(safeDivide(0, 6).value).toBe(0);
    expect(outcomeLagYears(2026, 2024)).toBe(2);
  });

  it('detects the retained FSTP period conflict', () => {
    expect(validatePeriod(7, 'JUNE')).toBe(false);
    expect(validatePeriod(7, 'JULY')).toBe(true);
  });

  it('classifies every illustrative quadrant', () => {
    expect(classifyDemoGap(.8, .8)).toBe('DOING_WELL');
    expect(classifyDemoGap(.3, .8)).toBe('LEARN_FROM');
    expect(classifyDemoGap(.3, .3)).toBe('INFRASTRUCTURE_GAP');
    expect(classifyDemoGap(.8, .3)).toBe('INVESTIGATE');
  });

  it('makes current sample evidence ineligible', () => {
    const reasons = assessEligibility({ reviewedMatch: false, completePayload: false, operationalYear: 2026, outcomeYear: 2024, requiredValuesPresent: true, periodValid: true });
    expect(reasons).toEqual(expect.arrayContaining(['ULB_MATCH_UNREVIEWED', 'INCOMPLETE_PAYLOAD', 'PERIOD_MISMATCH', 'STALE_OUTCOME']));
    expect(datasets.SAMPLE.radar.every((item) => item.state === 'UNSCORED')).toBe(true);
  });

  it('keeps data modes isolated and live mode inert', () => {
    expect(createProvider('DEMO').getOverview()[0].value).toBe('84%');
    expect(createProvider('SAMPLE').getOverview()[0].value).toBe('193 rows');
    expect(createProvider('LIVE').getOverview()[0].value).toBe('—');
    expect(createProvider('LIVE').getGapAssessments()[0].reasons).toContain('LIVE_ACCESS_PENDING');
  });

  it('keeps the 27 SASA datasets distinct inside the 30 authorized endpoints', () => {
    expect(sasaCatalogue).toHaveLength(27);
    expect(sasaCatalogueStats.documentedFields).toBe(242);
    expect(sasaCatalogueStats.themes).toBe(6);
    expect(sasaCatalogueStats.retainedExcerpts).toBe(6);
    expect(sasaCatalogueStats.completePayloads).toBe(0);
    expect(sasaCatalogue.every((dataset) => dataset.scoringEligibility === 'UNSCORED')).toBe(true);
    expect(authorizedCatalogueStats.authorizedDatasets).toBe(30);
    expect(authorizedCatalogueStats.serpDatasets).toBe(3);
    expect(datasets.SAMPLE.readiness.rows).toHaveLength(46);
  });

  it('adds documented PR and CDMA integrations without promoting them to authenticated snapshots', () => {
    expect(documentedIntegrationCatalogue).toHaveLength(3);
    expect(cdmaIntegrationCatalogue).toHaveLength(13);
    expect(readinessCatalogueStats.documentedDatasets).toBe(46);
    expect(readinessCatalogueStats.documentedPending).toBe(16);
    // Three CDMA keys are live (re-verified 3 September 2026); the other ten
    // still return dataset_not_found (404).
    const cdmaLive = cdmaIntegrationCatalogue.filter((dataset) => dataset.sourceState === 'AUTHORIZED');
    expect(cdmaLive).toHaveLength(3);
    expect(cdmaLive.every((dataset) => (dataset.liveRowCount ?? 0) > 0)).toBe(true);
    expect(cdmaLive.every((dataset) => dataset.liveCheckedOn === '2026-09-03')).toBe(true);
    expect(cdmaIntegrationCatalogue.filter((dataset) => dataset.sourceState === 'DOCUMENTED — INGESTION PENDING')).toHaveLength(10);
    // The invariant that matters: reachable is not the same as retained, and
    // neither makes a source scoreable. This must hold for all thirteen.
    expect(cdmaIntegrationCatalogue.every((dataset) => dataset.completePayload === false)).toBe(true);
    expect(cdmaIntegrationCatalogue.every((dataset) => dataset.retainedExcerpt === false)).toBe(true);
    expect(cdmaIntegrationCatalogue.every((dataset) => dataset.scoringEligibility === 'UNSCORED')).toBe(true);
    // 193,424 rows are readable today and none of them are in the product yet.
    expect(readinessCatalogueStats.liveNotIngestedDatasets).toBe(3);
    expect(readinessCatalogueStats.liveNotIngestedRows).toBe(193424);
    expect(readinessCatalogueStats.documentedPendingFields).toBe(24);
    expect(documentedIntegrationCatalogue.every((dataset) => dataset.sourceState === 'DOCUMENTED — INGESTION PENDING')).toBe(true);
    expect(documentedIntegrationCatalogue.every((dataset) => dataset.scoringEligibility === 'UNSCORED')).toBe(true);
    expect(documentedIntegrationCatalogue.map((dataset) => dataset.sourceGrain)).toEqual([
      'Gram Panchayat',
      'District',
      'Gram Panchayat · Date',
    ]);
  });

  it('reconciles every authenticated snapshot while retaining unscored ULB candidates', () => {
    expect(governedSnapshotStats.completeDatasets).toBe(29);
    expect(governedSnapshotStats.records).toBe(4359);
    expect(governedSnapshotStats.baselineUlbRows).toBe(119);
    expect(governedSnapshotStats.baselineUlbCandidates).toBe(123);
    expect(governedSnapshots.every(isCompleteSnapshot)).toBe(true);
    expect(datasets.SAMPLE.diagnostics).toHaveLength(123);
    expect(datasets.SAMPLE.radar.every((item) => item.state === 'UNSCORED')).toBe(true);
  });
});
