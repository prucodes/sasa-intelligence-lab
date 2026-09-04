import { anchorRegistry, sameDistrict } from '@/lib/crosswalk';
import type { Coverage } from '@/lib/coverage';
import { excludeDisputed, findDisputedGroups, type DisputedGroup } from '@/lib/disputes';
import { documentedIntegrationCatalogue, readinessCatalogue } from '@/lib/catalogue';
import { safeDivide, validatePeriod } from '@/lib/domain';
import {
  governedSnapshotByKey,
  governedSnapshots,
  currentSnapshotRecords,
  normalizeSourceName,
  isCompleteSnapshot,
  missingAuthorizedSnapshotKeys,
  recordPeriodLabel,
  snapshotAvailablePeriods,
  snapshotPeriod,
  sourceCandidateKey,
  type SnapshotEnvelope,
  type SnapshotRecord,
} from '@/lib/snapshots';

/**
 * Entity coverage for ULB-grain rows: how many distinct ULBs actually returned a
 * usable value for one measure, against the source-provided anchor registry.
 *
 * The denominator is never inferred from what came back. A source that returns
 * 40 rows is at 40 of 123, not at 100% of itself, and that distinction is the
 * whole reason this exists.
 */
function ulbCoverage<T extends { ulb?: string | null }>(
  rows: T[],
  measure: (row: T) => number | null | undefined,
  basis?: string,
): Coverage {
  const reporting = new Set(
    rows
      .filter((row) => {
        const value = measure(row);
        return typeof value === 'number' && Number.isFinite(value);
      })
      .map((row) => String(row.ulb ?? '').trim().toLowerCase())
      .filter(Boolean),
  );
  return { reported: reporting.size, expected: anchorRegistry.length, unit: 'ULBs', basis };
}

export type SourceGrain = 'ULB' | 'District';

export interface TraceableValue {
  tableKey: string;
  responseId: string;
  filters: Record<string, string>;
  retrievedAt: string;
  period: string;
  raw: SnapshotRecord;
  grain: SourceGrain;
}

export interface CollectionProcurementRow extends TraceableValue {
  district: string;
  ulb: string | null;
  target: number | null;
  workOrders: number | null;
  supplied: number | null;
  workOrderRatio: number | null;
  deliveryRatio: number | null;
  deliveryGap: number | null;
}

export interface CollectionAssetSummary {
  label: string;
  tableKey: string;
  grain: SourceGrain;
  records: number;
  reportedCount: number | null;
  countLabel: string;
  period: string;
  /** Places dropped from the count because their rows contradict each other. */
  disputedEntitiesExcluded: number;
}

export interface CollectionProcurementSummary {
  target: number;
  workOrders: number;
  supplied: number;
  workOrderRatio: number | null;
  deliveryRatio: number | null;
  /** How many ULBs returned a supplied count, against the anchor registry. */
  coverage: Coverage;
  deliveryGap: number;
  zeroTargets: number;
  duplicateRowsExcluded: number;
  rows: CollectionProcurementRow[];
  assets: CollectionAssetSummary[];
}

export interface DistrictCollectionAssetRow extends TraceableValue {
  asset: 'Door-to-Door E-Autos' | 'Push Carts' | 'Tri-Cycles';
  district: string;
  target: number | null;
  achievement: number | null;
  achievementRatio: number | null;
  reportedGap: number | null;
}

export interface DistrictCollectionAssetSummary {
  period: string;
  rows: DistrictCollectionAssetRow[];
  assets: Array<{
    asset: DistrictCollectionAssetRow['asset'];
    tableKey: string;
    target: number;
    achievement: number;
    achievementRatio: number | null;
    districts: number;
    returnedPeriods: string[];
    unchangedAcrossReturnedPeriods: number;
  }>;
  compactors: number;
  sweepingMachines: number;
  /** Places dropped from `sweepingMachines` because they reported conflicting figures. */
  sweepingDisputedExcluded: number;
  sweepingAmbiguities: number;
}

export interface LegacyWasteRow extends TraceableValue {
  district: string;
  ulb: string;
  target: number | null;
  achievement: number | null;
  balance: number | null;
  clearanceRatio: number | null;
  balanceCheck: 'pass' | 'conflict' | 'not-computable';
}

export interface LegacyWasteSummary {
  period: string;
  target: number;
  achievement: number;
  balance: number;
  clearanceRatio: number | null;
  /** How many ULBs returned a cleared figure, against the anchor registry. */
  coverage: Coverage;
  positiveBalanceCandidates: number;
  zeroBalanceCandidates: number;
  increasedSincePreviousPeriod: number;
  unchangedSincePreviousPeriod: number;
  decreasedSincePreviousPeriod: number;
  balanceConflicts: number;
  rows: LegacyWasteRow[];
}

export interface IhhlRow extends TraceableValue {
  district: string;
  ulb: string;
  identified: number | null;
  approved: number | null;
  underConstruction: number | null;
  completed: number | null;
  completionRatio: number | null;
  identifiedCoverage: number | null;
  openApprovals: number | null;
  backlogFlag: boolean;
}

export interface IhhlFunnel {
  identified: number;
  approved: number;
  underConstruction: number;
  completed: number;
  completionRatio: number | null;
  identifiedCoverage: number | null;
  /** How many ULBs returned a completed count, against the anchor registry. */
  coverage: Coverage;
  openApprovals: number;
  zeroApprovalRows: number;
  duplicateRowsExcluded: number;
  backlogRule: string;
  rows: IhhlRow[];
}

export type StageCohortTone = 'blocked' | 'review' | 'progress' | 'met';

export interface StageCohort {
  id: string;
  label: string;
  count: number;
  tone: StageCohortTone;
  detail: string;
  examples: Array<{ ulb: string; district: string }>;
}

export interface OperationalStageCohorts {
  title: string;
  period: string;
  coverage: Coverage;
  classified: number;
  excluded: number;
  excludedDetail: string;
  rule: string;
  cohorts: StageCohort[];
}

export interface DistrictSignal {
  district: string;
  value: number;
  returned: number;
  expected: number;
  affected: number;
  topEntity: { ulb: string; value: number } | null;
}

export interface DistrictSignalMap {
  id: 'collection' | 'ihhl' | 'legacy';
  label: string;
  title: string;
  unit: string;
  period: string;
  coverage: Coverage;
  rule: string;
  districts: DistrictSignal[];
}

export interface CommunityProgrammeSummary {
  period: string;
  items: Array<{
    label: string;
    records: number;
    target: number;
    achievement: number;
    achievementRatio: number | null;
    grain: SourceGrain;
  }>;
}

export interface ReportedHistoryPoint {
  period: string;
  order: number;
  target: number;
  achievement: number;
  coverage: number | null;
  /** Distinct districts that returned an achievement in this period. */
  reportingDistricts: number;
}

export interface ReportedHistorySeries {
  tableKey: string;
  label: string;
  shortLabel: string;
  points: ReportedHistoryPoint[];
  percentageConflicts: number;
}

export interface SupportingProgrammeItem {
  tableKey: string;
  label: string;
  theme: string;
  grain: SourceGrain;
  period: string;
  periodCount: number;
  records: number;
  target: number;
  achievement: number;
  coverage: number | null;
  zeroTargets: number;
  aboveTargetRows: number;
  percentageConflicts: number;
  /** Places dropped from the totals because their rows contradict each other. */
  disputedEntitiesExcluded: number;
}

/**
 * `awaiting-pull` is deliberately separate from both neighbours. A dataset that
 * is live and readable but has no retained snapshot is not the same as one that
 * exists only on paper (`pending`), nor one whose endpoint fails (`unavailable`).
 * Collapsing the three would hide the only one that is actionable today.
 */
export type DatasetUsageState = 'primary' | 'supporting' | 'unavailable' | 'pending' | 'awaiting-pull';

export interface DatasetUsageRow {
  dataset: string;
  tableKey: string;
  theme: string;
  programme: string;
  state: DatasetUsageState;
  usage: string;
  records: number;
  period: string;
}

export interface DatasetUsageAudit {
  total: number;
  used: number;
  primary: number;
  supporting: number;
  unavailable: number;
  pending: number;
  /** Live, readable, and not yet retained. */
  awaitingPull: number;
  /** Rows sitting behind those endpoints. */
  awaitingPullRows: number;
  rows: DatasetUsageRow[];
}

export interface ProcessingRegistryRow extends TraceableValue {
  facilityType: 'ISWM' | 'FSTP' | 'CBG' | 'C&D' | 'Plastic Waste';
  district: string;
  ulb: string | null;
  configuredCapacity: number | null;
  unit: 'TPD' | 'KLD' | 'units';
  wetTpd: number | null;
  dryTpd: number | null;
  sourceStatus: string;
  splitCheck: 'pass' | 'conflict' | 'not-applicable';
  periodConflict: boolean;
}

export interface ProcessingRegistry {
  rows: ProcessingRegistryRow[];
  facilityRecords: number;
  configuredTpd: number;
  configuredKld: number;
  completedStatusRecords: number;
  splitConflicts: number;
  periodConflicts: number;
  byType: Array<{ type: ProcessingRegistryRow['facilityType']; records: number; capacity: number; unit: string }>;
}

export interface SwachhOutcomeRow extends TraceableValue {
  district: string;
  ulb: string;
  odfStatus: string | null;
  gfcStatus: string | null;
  nationalRank: number | null;
  candidateKey: string;
}

export interface SwachhOutcomeSummary {
  reportingYear: '2024';
  odfRecords: number;
  gfcRecords: number;
  rankRecords: number;
  exactCandidateOverlap: number;
  odfDistribution: Array<{ label: string; count: number }>;
  gfcDistribution: Array<{ label: string; count: number }>;
  rankDistribution: Array<{ label: string; count: number }>;
  rows: SwachhOutcomeRow[];
}

export type CoverageState = 'returned' | 'not-returned' | 'quality-issue';

export interface CoverageRow {
  candidateKey: string;
  district: string;
  ulb: string;
  states: Record<'eAuto' | 'iswm' | 'ihhl' | 'odf' | 'gfc' | 'rank', CoverageState>;
  returnedCount: number;
}

export interface CoverageMatrix {
  rows: CoverageRow[];
  candidateCount: number;
  overlaps: Array<{ label: string; count: number }>;
}

export interface DatasetPeriodRow {
  dataset: string;
  tableKey: string;
  years: number[];
  months: number[];
  period: string;
  retrieved: boolean;
  conflict: boolean;
}

export interface DataQualityIssue {
  id: string;
  title: string;
  count: number;
  severity: 'info' | 'review' | 'blocked';
  detail: string;
}

/** `recovered` is a cell only visible because a reviewer approved a name match. */
export type GridCellState = CoverageState | 'recovered';

export interface CoverageGridRow {
  ulbId: string;
  ulb: string;
  district: string;
  /** One state per source, in the order of `CoverageGrid.sources`. */
  cells: GridCellState[];
  returned: number;
}

export interface CoverageGrid {
  sources: Array<{ tableKey: string; label: string }>;
  rows: CoverageGridRow[];
  totals: { cells: number; returned: number; flagged: number; absent: number; recovered: number };
}

export interface EvidenceBreadthSummary {
  sourceCount: number;
  candidateCount: number;
  distribution: Array<{ sourceCount: number; candidates: number }>;
  topCandidates: Array<{ candidateKey: string; district: string; ulb: string; sourceCount: number; sources: string[] }>;
}

export interface SourceReconciliationIssue {
  id: string;
  title: string;
  count: number;
  severity: 'info' | 'review' | 'blocked';
  detail: string;
  rule: string;
}

const keys = {
  collection: 'sasa_sac_machinery_e_autos_service_model_api',
  doorEAutos: 'sasa_sac_door_to_door_e_autos_api',
  pushCarts: 'sasa_sac_door_to_door_push_carts_api',
  triCycles: 'sasa_sac_door_to_door_tri_cycles_api',
  compactors: 'sasa_sac_machinery_compactors_api',
  sweeping: 'sasa_sac_sweeping_machines_information_api',
  legacyWaste: 'sasa_100_percent_clearance_of_legacy_waste_api',
  ihhl: 'sasa_sac_identification_of_new_ihhls_api',
  mepmaCircular: 'sasa_mepma_entrepreneurs_promoted_for_circular_economy_api',
  terraceGardens: 'sasa_households_promoted_for_terrace_gardening_kitchen_gardens_api',
  homeComposting: 'sasa_mepma_households_promoted_for_home_composite_api',
  iswm: 'sasa_sac_msw_processing_facilities_iswm_facilities_api',
  fstp: 'sasa_sac_establishing_fstps_information_api',
  cbg: 'sasa_sac_msw_processing_facilities_cbg_units_api',
  cd: 'sasa_sac_c_d_waste_processing_api',
  plastic: 'sasa_establishment_of_plastic_waste_management_units_api',
  odf: 'sasa_sac_swacch_survekshan_information_odf_status_api',
  gfc: 'sasa_sac_swacch_survekshan_information_gfc_status_api',
  rank: 'sasa_sac_swacch_survekshan_information_national_rank_api',
} as const;

function numberValue(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value.replace(/[",%]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function candidateDisplay(record: SnapshotRecord): { district: string; ulb: string } {
  return {
    district: firstValue(record, 'district_name', 'dstrt_nm') ?? 'District not supplied',
    ulb: firstValue(record, 'ulb_name', 'ulb_nm')?.trim() ?? 'ULB name not supplied',
  };
}

function periodOrder(record: SnapshotRecord): number {
  const year = numberValue(record.year) ?? 0;
  const month = numberValue(firstValue(record, 'month_id', 'month_number', 'mnth_no')) ?? 0;
  return year * 100 + (month > 10000 ? month % 100 : month);
}

function trace(snapshot: SnapshotEnvelope, record: SnapshotRecord, grain?: SourceGrain): TraceableValue {
  return {
    tableKey: snapshot.responseMetadata.tableKey,
    responseId: snapshot.responseMetadata.responseId,
    filters: snapshot.requestEcho.filters ?? {},
    retrievedAt: snapshot.responseMetadata.generatedAt,
    period: recordPeriodLabel(record),
    raw: record,
    grain: grain ?? ((record.ulb_name || record.ulb_nm) ? 'ULB' : 'District'),
  };
}

function snapshot(key: string): SnapshotEnvelope {
  const value = governedSnapshotByKey.get(key);
  if (!value) throw new Error(`Retained governed snapshot not found: ${key}`);
  return value;
}

function sum(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function firstValue(record: SnapshotRecord, ...fields: string[]): string | undefined {
  return fields.map((field) => record[field]).find((value): value is string => typeof value === 'string' && value.trim() !== '');
}

function exactSignature(record: SnapshotRecord): string {
  return JSON.stringify(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function uniqueRecords(records: SnapshotRecord[]): { records: SnapshotRecord[]; duplicates: number } {
  const retained = new Map<string, SnapshotRecord>();
  records.forEach((record) => retained.set(exactSignature(record), record));
  return { records: [...retained.values()], duplicates: records.length - retained.size };
}

export function getCollectionProcurementSummary(periodId?: string | null): CollectionProcurementSummary {
  const source = snapshot(keys.collection);
  const deduplicated = uniqueRecords(currentSnapshotRecords(source, periodId));
  const rows = deduplicated.records.map<CollectionProcurementRow>((record) => {
    const target = numberValue(record.target);
    const workOrders = numberValue(firstValue(record, 'actual_work_order_issued', 'actual_wrk_order_issued'));
    const supplied = numberValue(firstValue(record, 'achievement', 'no_of_vehicles_supplied_in_nos'));
    return {
      ...trace(source, record, 'ULB'),
      district: record.district_name,
      ulb: record.ulb_name,
      target,
      workOrders,
      supplied,
      workOrderRatio: safeDivide(workOrders, target).value,
      deliveryRatio: safeDivide(supplied, target).value,
      deliveryGap: target === null || supplied === null ? null : Math.max(target - supplied, 0),
    };
  });
  const target = sum(rows.map((row) => row.target));
  const workOrders = sum(rows.map((row) => row.workOrders));
  const supplied = sum(rows.map((row) => row.supplied));

  const assetConfig = [
    [keys.doorEAutos, 'Door-to-Door E-Autos', 'achievement', 'reported achievement'],
    [keys.pushCarts, 'Push Carts', 'achievement', 'reported achievement'],
    [keys.triCycles, 'Tri-Cycles', 'achievement', 'reported achievement'],
    [keys.compactors, 'Compactors', 'no_of_units', 'reported units'],
    [keys.sweeping, 'Sweeping Machines', 'no_of_machines_supplied', 'machines supplied'],
  ] as const;
  const assets = assetConfig.map<CollectionAssetSummary>(([tableKey, label, field, countLabel]) => {
    const assetSnapshot = snapshot(tableKey);
    const periodRecords = currentSnapshotRecords(assetSnapshot, periodId);
    // A place reported twice with different figures has no usable value, so it
    // is dropped rather than summed. Sweeping Machines reports Nellore as both
    // 19 and 4; counting them gave 23, a number neither row ever stated.
    const usable = excludeDisputed(periodRecords, field);
    return {
      label,
      tableKey,
      grain: assetSnapshot.records.some((record) => record.ulb_name || record.ulb_nm) ? 'ULB' : 'District',
      records: usable.records.length,
      reportedCount: sum(usable.records.map((record) => numberValue(record[field]))),
      countLabel,
      period: snapshotPeriod(assetSnapshot),
      disputedEntitiesExcluded: usable.excludedEntities,
    };
  });
  return {
    target,
    workOrders,
    supplied,
    workOrderRatio: safeDivide(workOrders, target).value,
    deliveryRatio: safeDivide(supplied, target).value,
    coverage: ulbCoverage(rows, (row) => row.supplied, 'ULBs returning a supplied count this period.'),
    deliveryGap: sum(rows.map((row) => row.deliveryGap)),
    zeroTargets: rows.filter((row) => row.target === 0).length,
    duplicateRowsExcluded: deduplicated.duplicates,
    rows,
    assets,
  };
}

export function getDistrictCollectionAssetSummary(): DistrictCollectionAssetSummary {
  const configs = [
    [keys.doorEAutos, 'Door-to-Door E-Autos'],
    [keys.pushCarts, 'Push Carts'],
    [keys.triCycles, 'Tri-Cycles'],
  ] as const;
  const rows = configs.flatMap(([tableKey, asset]) => {
    const source = snapshot(tableKey);
    return uniqueRecords(currentSnapshotRecords(source)).records.map<DistrictCollectionAssetRow>((record) => {
      const target = numberValue(record.target);
      const achievement = numberValue(record.achievement);
      return {
        ...trace(source, record, 'District'),
        asset,
        district: record.district_name,
        target,
        achievement,
        achievementRatio: safeDivide(achievement, target).value,
        reportedGap: target === null || achievement === null ? null : Math.max(target - achievement, 0),
      };
    });
  });
  const assets = configs.map(([tableKey, asset]) => {
    const source = snapshot(tableKey);
    const current = rows.filter((row) => row.tableKey === tableKey);
    const returnedPeriods = snapshotAvailablePeriods(source).months.map((month) => month);
    const byCandidate = source.records.reduce<Map<string, Set<string>>>((map, record) => {
      const key = sourceCandidateKey(record) ?? record.district_name;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(`${record.target ?? ''}|${record.achievement ?? ''}`);
      return map;
    }, new Map());
    const target = sum(current.map((row) => row.target));
    const achievement = sum(current.map((row) => row.achievement));
    return {
      asset,
      tableKey,
      target,
      achievement,
      achievementRatio: safeDivide(achievement, target).value,
      districts: current.length,
      returnedPeriods: returnedPeriods.map((month) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]),
      unchangedAcrossReturnedPeriods: [...byCandidate.values()].filter((values) => values.size === 1).length,
    };
  });
  const compactorsSource = snapshot(keys.compactors);
  const sweepingSource = snapshot(keys.sweeping);
  const sweepingUsable = excludeDisputed(currentSnapshotRecords(sweepingSource), 'no_of_machines_supplied');
  const sweepingGroups = sweepingSource.records.reduce<Map<string, Set<string>>>((map, record) => {
    const key = `${sourceCandidateKey(record) ?? record.district_name}|${recordPeriodLabel(record)}`;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(exactSignature(record));
    return map;
  }, new Map());
  return {
    period: snapshotPeriod(snapshot(keys.doorEAutos)),
    rows,
    assets,
    // These headline sums obey the same rule as the asset table: a place reported
    // twice with different figures is excluded, never summed. Without this, Nellore's
    // 19 and 4 were both counted as 23 — a number no source stated.
    compactors: sum(excludeDisputed(currentSnapshotRecords(compactorsSource), 'no_of_units').records.map((record) => numberValue(record.no_of_units))),
    sweepingMachines: sum(sweepingUsable.records.map((record) => numberValue(record.no_of_machines_supplied))),
    sweepingDisputedExcluded: sweepingUsable.excludedEntities,
    sweepingAmbiguities: [...sweepingGroups.values()].filter((signatures) => signatures.size > 1).length,
  };
}

export function getLegacyWasteSummary(periodId?: string | null): LegacyWasteSummary {
  const source = snapshot(keys.legacyWaste);
  const deduplicated = uniqueRecords(currentSnapshotRecords(source, periodId));
  const rows = deduplicated.records.map<LegacyWasteRow>((record) => {
    const target = numberValue(record.target);
    const achievement = numberValue(record.achievement);
    const balance = numberValue(record.balance);
    const computable = target !== null && achievement !== null && balance !== null;
    const display = candidateDisplay(record);
    return {
      ...trace(source, record, 'ULB'),
      ...display,
      target,
      achievement,
      balance,
      clearanceRatio: safeDivide(achievement, target).value,
      balanceCheck: !computable ? 'not-computable' : Math.abs(target - achievement - balance) <= 1 ? 'pass' : 'conflict',
    };
  });
  const currentOrder = Math.max(...source.records.map(periodOrder));
  const earlierOrders = [...new Set(source.records.map(periodOrder).filter((order) => order < currentOrder))].sort((a, b) => b - a);
  const previousOrder = earlierOrders[0];
  const previousByCandidate = new Map(source.records
    .filter((record) => periodOrder(record) === previousOrder)
    .map((record) => [sourceCandidateKey(record), numberValue(record.achievement)]));
  const comparisons = deduplicated.records.map((record) => {
    const previous = previousByCandidate.get(sourceCandidateKey(record));
    const current = numberValue(record.achievement);
    if (previous === undefined || previous === null || current === null) return null;
    return current > previous ? 'increased' : current < previous ? 'decreased' : 'unchanged';
  });
  const target = sum(rows.map((row) => row.target));
  const achievement = sum(rows.map((row) => row.achievement));
  return {
    period: snapshotPeriod(source),
    target,
    achievement,
    balance: sum(rows.map((row) => row.balance)),
    clearanceRatio: safeDivide(achievement, target).value,
    coverage: ulbCoverage(rows, (row) => row.achievement, 'ULBs returning a cleared figure this period.'),
    positiveBalanceCandidates: rows.filter((row) => (row.balance ?? 0) > 0).length,
    zeroBalanceCandidates: rows.filter((row) => row.balance === 0).length,
    increasedSincePreviousPeriod: comparisons.filter((value) => value === 'increased').length,
    unchangedSincePreviousPeriod: comparisons.filter((value) => value === 'unchanged').length,
    decreasedSincePreviousPeriod: comparisons.filter((value) => value === 'decreased').length,
    balanceConflicts: rows.filter((row) => row.balanceCheck === 'conflict').length,
    rows,
  };
}

export function getIHHLFunnel(periodId?: string | null): IhhlFunnel {
  const source = snapshot(keys.ihhl);
  const deduplicated = uniqueRecords(currentSnapshotRecords(source, periodId));
  const rows = deduplicated.records.map<IhhlRow>((record) => {
    const identified = numberValue(record.no_of_benf_identified);
    const approved = numberValue(record.ihhls_approved_by_mohua);
    const underConstruction = numberValue(record.under_construction);
    const completed = numberValue(record.completed);
    const openApprovals = approved === null || completed === null ? null : Math.max(approved - completed, 0);
    return {
      ...trace(source, record, 'ULB'),
      district: record.district_name,
      ulb: record.ulb_name,
      identified,
      approved,
      underConstruction,
      completed,
      completionRatio: safeDivide(completed, approved).value,
      identifiedCoverage: safeDivide(completed, identified).value,
      openApprovals,
      backlogFlag: openApprovals !== null && openApprovals >= 100,
    };
  });
  const identified = sum(rows.map((row) => row.identified));
  const approved = sum(rows.map((row) => row.approved));
  const underConstruction = sum(rows.map((row) => row.underConstruction));
  const completed = sum(rows.map((row) => row.completed));
  return {
    identified,
    approved,
    underConstruction,
    completed,
    completionRatio: safeDivide(completed, approved).value,
    identifiedCoverage: safeDivide(completed, identified).value,
    coverage: ulbCoverage(rows, (row) => row.completed, 'ULBs returning a completed count this period.'),
    openApprovals: Math.max(approved - completed, 0),
    zeroApprovalRows: rows.filter((row) => row.approved === 0).length,
    duplicateRowsExcluded: deduplicated.duplicates,
    backlogRule: 'Review flag when reported approved minus completed is at least 100; this is not a root-cause finding.',
    rows,
  };
}

function cohortExamples<T extends { ulb: string | null; district: string }>(
  rows: T[],
  weight: (row: T) => number,
): Array<{ ulb: string; district: string }> {
  return [...rows]
    .filter((row) => Boolean(row.ulb))
    .sort((left, right) => weight(right) - weight(left) || String(left.ulb).localeCompare(String(right.ulb)))
    .slice(0, 3)
    .map((row) => ({ ulb: row.ulb as string, district: row.district }));
}

/**
 * Mutually exclusive, count-only operating stages. These turn a statewide ratio
 * into a reviewable pattern without inventing a score or treating missing fields
 * as zero. `classified` is the honest denominator for the cohort counts; source
 * coverage remains visible separately against the 123-ULB anchor registry.
 */
export function getCollectionStageCohorts(periodId?: string | null): OperationalStageCohorts {
  const summary = getCollectionProcurementSummary(periodId);
  const eligible = summary.rows.filter((row) => row.target !== null && row.workOrders !== null && row.supplied !== null);
  const noOrder = eligible.filter((row) => (row.target ?? 0) > 0 && row.workOrders === 0 && row.supplied === 0);
  const orderedNone = eligible.filter((row) => (row.workOrders ?? 0) > 0 && row.supplied === 0);
  const partial = eligible.filter((row) => (row.supplied ?? 0) > 0 && (row.target ?? 0) > 0 && (row.supplied ?? 0) < (row.target ?? 0));
  const met = eligible.filter((row) => (row.target ?? 0) > 0 && row.supplied === row.target);
  const above = eligible.filter((row) => (row.target ?? 0) > 0 && (row.supplied ?? 0) > (row.target ?? 0));
  const zeroTarget = eligible.filter((row) => row.target === 0);
  const classified = noOrder.length + orderedNone.length + partial.length + met.length + above.length + zeroTarget.length;
  const excluded = summary.rows.length - classified;
  return {
    title: 'Procurement stage pattern',
    period: summary.rows[0]?.period ?? periodId ?? 'Not returned',
    coverage: summary.coverage,
    classified,
    excluded,
    excludedDetail: 'records missing target, work-order, or supplied values',
    rule: 'Each returned ULB record appears once: no order, ordered with none supplied, partial supply, target met, above target, or zero-target review.',
    cohorts: [
      { id: 'no-order', label: 'No order issued', count: noOrder.length, tone: 'blocked', detail: 'Positive target; no work order or supply reported.', examples: cohortExamples(noOrder, (row) => row.target ?? 0) },
      { id: 'ordered-none', label: 'Ordered · none supplied', count: orderedNone.length, tone: 'blocked', detail: 'Work order reported; supplied count is zero.', examples: cohortExamples(orderedNone, (row) => (row.workOrders ?? 0) - (row.supplied ?? 0)) },
      { id: 'partial', label: 'Partially supplied', count: partial.length, tone: 'progress', detail: 'Some vehicles supplied; reported target not yet met.', examples: cohortExamples(partial, (row) => (row.target ?? 0) - (row.supplied ?? 0)) },
      { id: 'met', label: 'Target matched', count: met.length, tone: 'met', detail: 'Supplied count equals the reported target.', examples: cohortExamples(met, (row) => row.target ?? 0) },
      { id: 'above', label: 'Above target', count: above.length, tone: 'review', detail: 'Supply exceeds the reported target; retain for review.', examples: cohortExamples(above, (row) => (row.supplied ?? 0) - (row.target ?? 0)) },
      { id: 'zero-target', label: 'Zero-target review', count: zeroTarget.length, tone: 'review', detail: 'A rate is not computed where the denominator is zero.', examples: cohortExamples(zeroTarget, (row) => row.supplied ?? 0) },
    ],
  };
}

export function getIHHLStageCohorts(periodId?: string | null): OperationalStageCohorts {
  const summary = getIHHLFunnel(periodId);
  const eligible = summary.rows.filter((row) => row.approved !== null && row.underConstruction !== null && row.completed !== null);
  const noApprovals = eligible.filter((row) => row.approved === 0);
  const approvedNone = eligible.filter((row) => (row.approved ?? 0) > 0 && row.underConstruction === 0 && row.completed === 0);
  const underwayNone = eligible.filter((row) => (row.approved ?? 0) > 0 && (row.underConstruction ?? 0) > 0 && row.completed === 0);
  const completion = eligible.filter((row) => (row.completed ?? 0) > 0 && (row.completed ?? 0) < (row.approved ?? 0));
  const met = eligible.filter((row) => (row.approved ?? 0) > 0 && (row.completed ?? 0) >= (row.approved ?? 0));
  const classified = noApprovals.length + approvedNone.length + underwayNone.length + completion.length + met.length;
  const excluded = summary.rows.length - classified;
  return {
    title: 'IHHL delivery stage pattern',
    period: summary.rows[0]?.period ?? periodId ?? 'Not returned',
    coverage: summary.coverage,
    classified,
    excluded,
    excludedDetail: 'records missing approved, under-construction, or completed values',
    rule: 'Each returned ULB record appears once, based only on reported approved, under-construction, and completed counts.',
    cohorts: [
      { id: 'no-approvals', label: 'No approvals reported', count: noApprovals.length, tone: 'review', detail: 'Approved count is explicitly zero; this is not a missing value.', examples: cohortExamples(noApprovals, (row) => row.identified ?? 0) },
      { id: 'approved-none', label: 'Approved · no activity', count: approvedNone.length, tone: 'blocked', detail: 'Approvals reported; construction and completion are both zero.', examples: cohortExamples(approvedNone, (row) => row.approved ?? 0) },
      { id: 'underway-none', label: 'Under way · none complete', count: underwayNone.length, tone: 'progress', detail: 'Construction is reported, with no completed units yet.', examples: cohortExamples(underwayNone, (row) => row.underConstruction ?? 0) },
      { id: 'completion', label: 'Completion reported', count: completion.length, tone: 'progress', detail: 'Some units completed; reported approvals remain open.', examples: cohortExamples(completion, (row) => row.openApprovals ?? 0) },
      { id: 'met', label: 'Approvals matched', count: met.length, tone: 'met', detail: 'Completed count meets or exceeds reported approvals.', examples: cohortExamples(met, (row) => row.completed ?? 0) },
    ],
  };
}

export function getLegacyWasteStageCohorts(periodId?: string | null): OperationalStageCohorts {
  const summary = getLegacyWasteSummary(periodId);
  const complete = summary.rows.filter((row) => row.target !== null && row.achievement !== null && row.balance !== null);
  const eligible = complete.filter((row) => row.balanceCheck !== 'conflict');
  const none = eligible.filter((row) => (row.target ?? 0) > 0 && row.achievement === 0);
  const partial = eligible.filter((row) => (row.achievement ?? 0) > 0 && (row.target ?? 0) > 0 && (row.achievement ?? 0) < (row.target ?? 0));
  const met = eligible.filter((row) => (row.target ?? 0) > 0 && row.achievement === row.target);
  const above = eligible.filter((row) => (row.target ?? 0) > 0 && (row.achievement ?? 0) > (row.target ?? 0));
  const zeroTarget = eligible.filter((row) => row.target === 0);
  const classified = none.length + partial.length + met.length + above.length + zeroTarget.length;
  const excluded = summary.rows.length - classified;
  return {
    title: 'Legacy-waste clearance pattern',
    period: summary.rows[0]?.period ?? periodId ?? 'Not returned',
    coverage: { reported: classified, expected: anchorRegistry.length, unit: 'ULBs', basis: 'ULBs with a complete, internally consistent target / cleared / balance record.' },
    classified,
    excluded,
    excludedDetail: 'incomplete or internally conflicting records',
    rule: 'Each internally consistent returned ULB record appears once. Arithmetic conflicts are excluded, never averaged or forced into a stage.',
    cohorts: [
      { id: 'none', label: 'No clearance reported', count: none.length, tone: 'blocked', detail: 'Positive target; cleared count is explicitly zero.', examples: cohortExamples(none, (row) => row.target ?? 0) },
      { id: 'partial', label: 'Partially cleared', count: partial.length, tone: 'progress', detail: 'Some clearance reported; a balance remains.', examples: cohortExamples(partial, (row) => row.balance ?? 0) },
      { id: 'met', label: 'Target matched', count: met.length, tone: 'met', detail: 'Reported cleared count equals target.', examples: cohortExamples(met, (row) => row.target ?? 0) },
      { id: 'above', label: 'Above target', count: above.length, tone: 'review', detail: 'Reported clearance exceeds target; retain for review.', examples: cohortExamples(above, (row) => (row.achievement ?? 0) - (row.target ?? 0)) },
      { id: 'zero-target', label: 'Zero-target review', count: zeroTarget.length, tone: 'review', detail: 'A clearance rate is not computed where target is zero.', examples: cohortExamples(zeroTarget, (row) => row.achievement ?? 0) },
    ],
  };
}

function districtSignals(
  rows: Array<{ district: string; ulb: string | null; value: number | null }>,
): DistrictSignal[] {
  const groups = new Map<string, typeof rows>();
  rows.filter((row) => row.value !== null).forEach((row) => {
    if (!groups.has(row.district)) groups.set(row.district, []);
    groups.get(row.district)!.push(row);
  });
  return [...groups.entries()].map(([district, districtRows]) => {
    const anchors = anchorRegistry.filter((anchor) => sameDistrict(anchor.district, district));
    const returned = new Set(districtRows.map((row) => row.ulb?.trim().toLowerCase()).filter(Boolean)).size;
    const ranked = [...districtRows].sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
    return {
      district,
      value: districtRows.reduce((total, row) => total + (row.value ?? 0), 0),
      returned,
      expected: new Set(anchors.map((anchor) => anchor.id)).size,
      affected: districtRows.filter((row) => (row.value ?? 0) > 0).length,
      topEntity: ranked[0]?.ulb ? { ulb: ranked[0].ulb as string, value: ranked[0].value ?? 0 } : null,
    };
  }).sort((left, right) => right.value - left.value || left.district.localeCompare(right.district));
}

/**
 * Three single-source district maps. Each lane is aggregated only inside its own
 * ULB-grain dataset; the maps are switchable but never merged. District-name
 * matching is used only to attach a returned source label to a boundary/anchor,
 * and is therefore disclosed in the visualization rather than treated as an ID join.
 */
export function getDistrictSignalMaps(): DistrictSignalMap[] {
  const collection = getCollectionProcurementSummary();
  const ihhl = getIHHLFunnel();
  const legacy = getLegacyWasteSummary();
  return [
    {
      id: 'collection',
      label: 'Ordered vehicles',
      title: 'Ordered vehicles not yet supplied',
      unit: 'vehicles',
      period: collection.rows[0]?.period ?? 'Not returned',
      coverage: collection.coverage,
      rule: 'Sum of max(work orders − supplied, 0) inside the E-Auto procurement source.',
      districts: districtSignals(collection.rows.map((row) => ({
        district: row.district,
        ulb: row.ulb,
        value: row.workOrders === null || row.supplied === null ? null : Math.max(row.workOrders - row.supplied, 0),
      }))),
    },
    {
      id: 'ihhl',
      label: 'Open IHHL approvals',
      title: 'Approved toilets not yet completed',
      unit: 'approvals',
      period: ihhl.rows[0]?.period ?? 'Not returned',
      coverage: ihhl.coverage,
      rule: 'Sum of max(approved − completed, 0) inside the IHHL source.',
      districts: districtSignals(ihhl.rows.map((row) => ({ district: row.district, ulb: row.ulb, value: row.openApprovals }))),
    },
    {
      id: 'legacy',
      label: 'Legacy-waste balance',
      title: 'Source-reported legacy-waste balance',
      unit: 'tonnes',
      period: legacy.period,
      coverage: { reported: legacy.rows.filter((row) => row.balance !== null && row.balanceCheck !== 'conflict').length, expected: anchorRegistry.length, unit: 'ULBs', basis: 'Internally conflicting balances excluded.' },
      rule: 'Sum of source-reported balance inside the legacy-waste source; arithmetic conflicts excluded.',
      districts: districtSignals(legacy.rows.map((row) => ({ district: row.district, ulb: row.ulb, value: row.balanceCheck === 'conflict' ? null : row.balance }))),
    },
  ];
}

export function getCommunityProgrammeSummary(): CommunityProgrammeSummary {
  const configs = [
    [keys.mepmaCircular, 'Circular-economy entrepreneurs'],
    [keys.terraceGardens, 'Terrace / kitchen gardens'],
    [keys.homeComposting, 'Home composting'],
  ] as const;
  const items = configs.map(([tableKey, label]) => {
    const source = snapshot(tableKey);
    const records = currentSnapshotRecords(source);
    const target = sum(records.map((record) => numberValue(record.target)));
    const achievement = sum(records.map((record) => numberValue(record.achievement)));
    return {
      label,
      records: records.length,
      target,
      achievement,
      achievementRatio: safeDivide(achievement, target).value,
      grain: 'ULB' as const,
    };
  });
  return { period: snapshotPeriod(snapshot(keys.mepmaCircular)), items };
}

export function getCommunityProgrammeHistory(): ReportedHistorySeries[] {
  const configs = [
    [keys.mepmaCircular, 'Circular-economy entrepreneurs', 'Circular economy'],
    [keys.terraceGardens, 'Terrace / kitchen gardens', 'Terrace gardens'],
    [keys.homeComposting, 'Households promoted for home composting', 'Home composting'],
  ] as const;
  return configs.map(([tableKey, label, shortLabel]) => {
    const source = snapshot(tableKey);
    const groups = uniqueRecords(source.records).records.reduce<Map<number, SnapshotRecord[]>>((map, record) => {
      const order = periodOrder(record);
      if (!map.has(order)) map.set(order, []);
      map.get(order)!.push(record);
      return map;
    }, new Map());
    const points = [...groups.entries()].sort(([left], [right]) => left - right).map(([order, records]) => {
      const target = sum(records.map((record) => numberValue(record.target)));
      const achievement = sum(records.map((record) => numberValue(record.achievement)));
      // How many distinct districts actually returned an achievement this period.
      // A month built on 9 districts is a different claim from one built on 26,
      // and the plotted line alone cannot tell them apart.
      const reporting = new Set(
        records
          .filter((record) => numberValue(record.achievement) !== null)
          .map((record) => String(record.district_name ?? '').trim().toLowerCase())
          .filter(Boolean),
      ).size;
      return {
        period: recordPeriodLabel(records[0]), order, target, achievement,
        coverage: safeDivide(achievement, target).value,
        reportingDistricts: reporting,
      };
    });
    const percentageConflicts = source.records.filter((record) => {
      const target = numberValue(record.target);
      const achievement = numberValue(record.achievement);
      const reported = numberValue(firstValue(record, 'achievement_percentage', 'percentage'));
      return target !== null && target !== 0 && achievement !== null && reported !== null
        && Math.abs(achievement / target * 100 - reported) > 1;
    }).length;
    return { tableKey, label, shortLabel, points, percentageConflicts };
  });
}

export function getSupportingProgrammePortfolio(): SupportingProgrammeItem[] {
  const configs: Array<{
    tableKey: string;
    label: string;
    theme: string;
    grain: SourceGrain;
    targetFields: string[];
    achievementFields: string[];
  }> = [
    { tableKey: 'sasa_50_percent_green_spaces_api', label: 'Green spaces', theme: 'Green & water', grain: 'ULB', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: 'sasa_50_percent_greencover_api', label: 'Green cover', theme: 'Green & water', grain: 'ULB', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: 'sasa_50_percent_rejuvenation_api', label: 'Water-body rejuvenation', theme: 'Green & water', grain: 'ULB', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: 'sasa_cdma_ulbs_ewaste_collection_mechanism_api', label: 'E-waste collection mechanism', theme: 'Waste management', grain: 'District', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: 'sasa_cdma_ulbs_single_use_plastic_ban_api', label: 'Single-use plastic ban', theme: 'Waste management', grain: 'District', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: 'sasa_declaration_of_odf_plus_model_villages_api', label: 'ODF+ model villages', theme: 'Sanitation outcomes', grain: 'District', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: keys.terraceGardens, label: 'Terrace / kitchen gardens', theme: 'Green & water', grain: 'ULB', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: 'sasa_itc_wow_program_in_schools_api', label: 'ITC WOW in schools', theme: 'Awareness & schools', grain: 'District', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: keys.mepmaCircular, label: 'Circular-economy entrepreneurs', theme: 'Circular economy', grain: 'ULB', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: keys.homeComposting, label: 'Home composting', theme: 'Circular economy', grain: 'ULB', targetFields: ['target'], achievementFields: ['achievement'] },
    { tableKey: 'serp_kitchen_garden_api', label: 'SERP kitchen gardens', theme: 'Green & water', grain: 'District', targetFields: ['shg_kitchen_garden_target_units'], achievementFields: ['shg_kitchen_garden_cummulative_achievement_till_current_month'] },
    { tableKey: 'serp_swachhata_awareness_api', label: 'SERP Swachhata awareness', theme: 'Awareness & schools', grain: 'District', targetFields: ['shg_swachhata_awareness_target_units'], achievementFields: ['shg_swachhata_awareness_cummulative_achievement_till_current_month'] },
    { tableKey: 'serp_circular_economy_api', label: 'SERP circular economy', theme: 'Circular economy', grain: 'District', targetFields: ['circular_economy_entrepreneurs_target_units'], achievementFields: ['circular_economy_entrepreneurs_cummulative_achievement_till_current_month'] },
  ];
  return configs.map((config) => {
    const source = snapshot(config.tableKey);
    const deduplicated = uniqueRecords(currentSnapshotRecords(source)).records;
    // Places whose rows disagree on the achievement have no usable figure, so
    // they leave the aggregate entirely rather than contributing both values.
    const disputed = excludeDisputed(deduplicated, config.achievementFields[0]);
    const records = disputed.records;
    const targetFor = (record: SnapshotRecord) => numberValue(firstValue(record, ...config.targetFields));
    const achievementFor = (record: SnapshotRecord) => numberValue(firstValue(record, ...config.achievementFields));
    const target = sum(records.map(targetFor));
    const achievement = sum(records.map(achievementFor));
    const percentageConflicts = records.filter((record) => {
      const rowTarget = targetFor(record);
      const rowAchievement = achievementFor(record);
      const reported = numberValue(firstValue(record, 'achievement_percentage', 'percentage'));
      return rowTarget !== null && rowTarget !== 0 && rowAchievement !== null && reported !== null
        && Math.abs(rowAchievement / rowTarget * 100 - reported) > 1;
    }).length;
    const availability = snapshotAvailablePeriods(source);
    const periodCount = Math.max(availability.months.length, availability.years.length, 1);
    return {
      tableKey: config.tableKey,
      label: config.label,
      theme: config.theme,
      grain: config.grain,
      period: snapshotPeriod(source),
      periodCount,
      records: records.length,
      target,
      achievement,
      coverage: safeDivide(achievement, target).value,
      zeroTargets: records.filter((record) => targetFor(record) === 0).length,
      aboveTargetRows: records.filter((record) => {
        const rowTarget = targetFor(record);
        const rowAchievement = achievementFor(record);
        return rowTarget !== null && rowAchievement !== null && rowAchievement > rowTarget;
      }).length,
      percentageConflicts,
      disputedEntitiesExcluded: disputed.excludedEntities,
    };
  });
}

export function getProcessingRegistry(periodId?: string | null): ProcessingRegistry {
  const configs = [
    [keys.iswm, 'ISWM', 'total_tpd', 'TPD'],
    [keys.fstp, 'FSTP', 'capacity_in_kld', 'KLD'],
    [keys.cbg, 'CBG', 'total_tpd', 'TPD'],
    [keys.cd, 'C&D', 'plnt_cpcty_in_tpd', 'TPD'],
    [keys.plastic, 'Plastic Waste', 'pwm_units_trgt_units', 'units'],
  ] as const;
  const rows = configs.flatMap(([tableKey, facilityType, capacityField, unit]) => {
    const source = snapshot(tableKey);
    return currentSnapshotRecords(source, periodId).map<ProcessingRegistryRow>((record) => {
      const capacity = facilityType === 'Plastic Waste' ? null : numberValue(record[capacityField]);
      const wet = numberValue(record.wet_tpd);
      const dry = numberValue(record.dry_tpd);
      const splitCheck = facilityType !== 'ISWM' || capacity === null || wet === null || dry === null
        ? 'not-applicable'
        : Math.abs(capacity - (wet + dry)) <= 0.01 ? 'pass' : 'conflict';
      const periodConflict = facilityType === 'FSTP'
        && !validatePeriod(numberValue(record.month_number) ?? 0, record.month_name ?? '');
      return {
        ...trace(source, record),
        facilityType,
        district: record.district_name ?? record.dstrt_nm,
        ulb: record.ulb_name ?? record.ulb_nm ?? null,
        configuredCapacity: capacity,
        unit,
        wetTpd: wet,
        dryTpd: dry,
        sourceStatus: record.status_tx ?? record.overall_progress
          ?? `${record.achievement ?? record.pwm_units_achvmnt ?? 'Not supplied'} of ${record.target ?? record.pwm_units_trgt_units ?? 'not supplied'} source-reported units`,
        splitCheck,
        periodConflict,
      };
    });
  });
  const byType = configs.map((config) => {
    const type = config[1];
    const unit = config[3];
    const matching = rows.filter((row) => row.facilityType === type);
    return { type, records: matching.length, capacity: sum(matching.map((row) => row.configuredCapacity)), unit };
  });
  return {
    rows,
    facilityRecords: rows.length,
    configuredTpd: sum(rows.filter((row) => row.unit === 'TPD').map((row) => row.configuredCapacity)),
    configuredKld: sum(rows.filter((row) => row.unit === 'KLD').map((row) => row.configuredCapacity)),
    completedStatusRecords: rows.filter((row) => /^(completed|100%)$/i.test(row.sourceStatus)).length,
    splitConflicts: rows.filter((row) => row.splitCheck === 'conflict').length,
    periodConflicts: rows.filter((row) => row.periodConflict).length,
    byType,
  };
}

export function getFacilityStatusReviewQueue(): ProcessingRegistryRow[] {
  const reviewStatuses = /^(site not available|not commenced|local issue|approach road)$/i;
  return getProcessingRegistry().rows
    .filter((row) => row.facilityType === 'ISWM' && reviewStatuses.test(row.sourceStatus.trim()))
    .sort((left, right) => left.sourceStatus.localeCompare(right.sourceStatus)
      || (left.ulb ?? left.district).localeCompare(right.ulb ?? right.district));
}

function distribution(values: string[]): Array<{ label: string; count: number }> {
  const counts = values.reduce<Map<string, number>>((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map());
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function getSwachhOutcomeSummary(): SwachhOutcomeSummary {
  const odf = snapshot(keys.odf);
  const gfc = snapshot(keys.gfc);
  const rank = snapshot(keys.rank);
  const sourceByKey = new Map<string, { odf?: SnapshotRecord; gfc?: SnapshotRecord; rank?: SnapshotRecord }>();
  for (const [kind, source] of [['odf', odf], ['gfc', gfc], ['rank', rank]] as const) {
    source.records.forEach((record) => {
      const candidate = sourceCandidateKey(record);
      if (!candidate) return;
      sourceByKey.set(candidate, { ...sourceByKey.get(candidate), [kind]: record });
    });
  }
  const rows = [...sourceByKey.entries()].map<SwachhOutcomeRow>(([candidateKey, value]) => {
    const anchor = value.odf ?? value.rank ?? value.gfc!;
    const source = value.odf ? odf : value.rank ? rank : gfc;
    return {
      ...trace(source, anchor, 'ULB'),
      district: anchor.district_name,
      ulb: anchor.ulb_name,
      odfStatus: value.odf?.odf_status ?? null,
      gfcStatus: value.gfc?.gfc_status ?? null,
      nationalRank: numberValue(value.rank?.national_rank),
      candidateKey,
    };
  });
  const baseline = new Set(getIHHLFunnel().rows.map((row) => sourceCandidateKey(row.raw)).filter(Boolean));
  const exactCandidateOverlap = rows.filter((row) => baseline.has(row.candidateKey)).length;
  const rankBuckets = rank.records.map((record) => numberValue(record.national_rank)).filter((value): value is number => value !== null).map((value) =>
    value <= 100 ? 'Top 100' : value <= 300 ? '101–300' : value <= 600 ? '301–600' : value <= 1000 ? '601–1000' : '> 1000');
  return {
    reportingYear: '2024',
    odfRecords: odf.records.length,
    gfcRecords: gfc.records.length,
    rankRecords: rank.records.length,
    exactCandidateOverlap,
    odfDistribution: distribution(odf.records.map((record) => record.odf_status || 'Not reported')),
    gfcDistribution: distribution(gfc.records.map((record) => record.gfc_status || 'Not reported')),
    rankDistribution: distribution(rankBuckets),
    rows: rows.sort((a, b) => (a.nationalRank ?? Number.MAX_SAFE_INTEGER) - (b.nationalRank ?? Number.MAX_SAFE_INTEGER)),
  };
}

export function getEntityCoverageMatrix(): CoverageMatrix {
  const ihhlSource = snapshot(keys.ihhl);
  const baselineRecords = [...new Map(ihhlSource.records.map((record) => [sourceCandidateKey(record), record])).values()]
    .filter((record): record is SnapshotRecord => Boolean(record));
  const indexes = new Map([
    ['eAuto', keys.collection], ['iswm', keys.iswm], ['ihhl', keys.ihhl], ['odf', keys.odf], ['gfc', keys.gfc], ['rank', keys.rank],
  ].map(([label, tableKey]) => [label, new Set(snapshot(tableKey).records.map(sourceCandidateKey).filter(Boolean))]));
  const duplicateCandidates = new Set(
    ihhlSource.records.reduce<Map<string, number>>((map, record) => {
      const candidate = sourceCandidateKey(record);
      if (candidate) {
        const candidatePeriod = `${candidate}|${recordPeriodLabel(record)}`;
        map.set(candidatePeriod, (map.get(candidatePeriod) ?? 0) + 1);
      }
      return map;
    }, new Map()).entries(),
  );
  const duplicateKeys = new Set([...duplicateCandidates].filter(([, count]) => count > 1).map(([candidatePeriod]) => candidatePeriod.split('|').slice(0, 2).join('|')));
  const rows = baselineRecords.map<CoverageRow>((record) => {
    const candidateKey = sourceCandidateKey(record)!;
    const states = Object.fromEntries([...indexes.entries()].map(([label, index]) => [
      label,
      index.has(candidateKey) ? label === 'ihhl' && duplicateKeys.has(candidateKey) ? 'quality-issue' : 'returned' : 'not-returned',
    ])) as CoverageRow['states'];
    return {
      candidateKey,
      district: record.district_name,
      ulb: record.ulb_name,
      states,
      returnedCount: Object.values(states).filter((state) => state !== 'not-returned').length,
    };
  }).sort((a, b) => b.returnedCount - a.returnedCount || a.ulb.localeCompare(b.ulb));
  const overlap = (left: keyof CoverageRow['states'], right: keyof CoverageRow['states']) =>
    rows.filter((row) => row.states[left] !== 'not-returned' && row.states[right] !== 'not-returned').length;
  return {
    rows,
    candidateCount: rows.length,
    overlaps: [
      { label: 'ISWM × IHHL', count: overlap('iswm', 'ihhl') },
      { label: 'E-Auto × IHHL', count: overlap('eAuto', 'ihhl') },
      { label: 'E-Auto × ISWM', count: overlap('eAuto', 'iswm') },
    ],
  };
}

const gridSourceLabels: Record<string, string> = {
  sasa_sac_identification_of_new_ihhls_api: 'IHHL',
  sasa_100_percent_clearance_of_legacy_waste_api: 'Legacy',
  sasa_sac_msw_processing_facilities_iswm_facilities_api: 'ISWM',
  sasa_sac_machinery_e_autos_service_model_api: 'E-Auto',
  sasa_50_percent_green_spaces_api: 'Green sp.',
  sasa_50_percent_greencover_api: 'Green cv.',
  sasa_50_percent_rejuvenation_api: 'Rejuv.',
  sasa_mepma_households_promoted_for_home_composite_api: 'Compost',
  sasa_mepma_entrepreneurs_promoted_for_circular_economy_api: 'Circ. econ.',
  sasa_households_promoted_for_terrace_gardening_kitchen_gardens_api: 'Terrace',
  sasa_sac_establishing_fstps_information_api: 'FSTP',
  sasa_sac_machinery_compactors_api: 'Compactor',
  sasa_sac_sweeping_machines_information_api: 'Sweeper',
  sasa_sac_msw_processing_facilities_cbg_units_api: 'CBG',
  sasa_sac_c_d_waste_processing_api: 'C&D',
  sasa_sac_swacch_survekshan_information_odf_status_api: 'ODF 24',
  sasa_sac_swacch_survekshan_information_national_rank_api: 'Rank 24',
  sasa_sac_swacch_survekshan_information_gfc_status_api: 'GFC 24',
};

/**
 * The full anchored coverage grid: every entity in the source-provided registry against every
 * ULB-grain source. Absence is a first-class value here — a cell is 'not-returned' because the
 * source returned no row for that entity, which is never the same as a reported zero.
 */
export function getEvidenceCoverageGrid(aliases: Map<string, string> = new Map()): CoverageGrid {
  // Observed signatures a reviewer has attached to each anchor entity.
  const extraSignatures = new Map<string, string[]>();
  for (const [observed, ulbId] of aliases) {
    if (!extraSignatures.has(ulbId)) extraSignatures.set(ulbId, []);
    extraSignatures.get(ulbId)!.push(observed);
  }
  const sources = Object.entries(gridSourceLabels)
    .filter(([tableKey]) => governedSnapshotByKey.has(tableKey))
    .map(([tableKey, label]) => ({ tableKey, label }));

  const byTable = new Map<string, Map<string, SnapshotRecord[]>>();
  for (const { tableKey } of sources) {
    const bySignature = new Map<string, SnapshotRecord[]>();
    for (const record of governedSnapshotByKey.get(tableKey)?.records ?? []) {
      const name = normalizeSourceName(record.ulb_name).replace(/\s+/g, '');
      if (!name) continue;
      if (!bySignature.has(name)) bySignature.set(name, []);
      bySignature.get(name)!.push(record);
    }
    byTable.set(tableKey, bySignature);
  }

  const totals = { cells: 0, returned: 0, flagged: 0, absent: 0, recovered: 0 };
  const rows: CoverageGridRow[] = anchorRegistry.map((entity) => {
    const signature = normalizeSourceName(entity.name).replace(/\s+/g, '');
    const approvedSignatures = extraSignatures.get(entity.ulbId) ?? [];
    const cells = sources.map(({ tableKey }) => {
      const table = byTable.get(tableKey);
      const direct = table?.get(signature) ?? [];
      const viaReview = approvedSignatures.flatMap((alias) => table?.get(alias) ?? []);
      const matched = [...direct, ...viaReview];
      totals.cells += 1;
      if (matched.length === 0) { totals.absent += 1; return 'not-returned' as GridCellState; }
      if (direct.length === 0) { totals.recovered += 1; return 'recovered' as GridCellState; }
      const flagged = matched.some((record) => {
        const month = Number(record.month_number ?? record.month_id ?? NaN);
        const named = record.month_name;
        if (Number.isFinite(month) && named && !validatePeriod(month, named)) return true;
        const target = Number(String(record.target ?? '').replace(/[^0-9.]/g, ''));
        return String(record.target ?? '') !== '' && (!Number.isFinite(target) || target === 0);
      });
      if (flagged) { totals.flagged += 1; return 'quality-issue' as GridCellState; }
      totals.returned += 1;
      return 'returned' as GridCellState;
    });
    return {
      ulbId: entity.ulbId,
      ulb: entity.name,
      district: entity.district,
      cells,
      returned: cells.filter((cell) => cell !== 'not-returned').length,
    };
  }).sort((left, right) => left.district.localeCompare(right.district) || left.ulb.localeCompare(right.ulb));

  return { sources, rows, totals };
}

export function getEntityEvidenceBreadth(): EvidenceBreadthSummary {
  const outcomeKeys = new Set<string>([keys.odf, keys.gfc, keys.rank]);
  const sources = governedSnapshots.filter((source) => !outcomeKeys.has(source.responseMetadata.tableKey)
    && source.records.some((record) => Boolean(record.ulb_name || record.ulb_nm || record.ulb_id)));
  const candidates = new Map<string, { district: string; ulb: string; sources: Set<string> }>();
  sources.forEach((source) => {
    const sourceLabel = documentedIntegrationCatalogue.find((item) => item.tableKey === source.responseMetadata.tableKey)?.catalogueName
      ?? readinessCatalogue.find((item) => item.tableKey === source.responseMetadata.tableKey)?.catalogueName
      ?? source.responseMetadata.tableKey;
    source.records.forEach((record) => {
      const candidateKey = sourceCandidateKey(record);
      if (!candidateKey) return;
      const display = candidateDisplay(record);
      const current = candidates.get(candidateKey) ?? { ...display, sources: new Set<string>() };
      current.sources.add(sourceLabel);
      candidates.set(candidateKey, current);
    });
  });
  const distributionMap = [...candidates.values()].reduce<Map<number, number>>((map, candidate) => {
    map.set(candidate.sources.size, (map.get(candidate.sources.size) ?? 0) + 1);
    return map;
  }, new Map());
  return {
    sourceCount: sources.length,
    candidateCount: candidates.size,
    distribution: [...distributionMap.entries()].sort((left, right) => left[0] - right[0])
      .map(([sourceCount, candidateCount]) => ({ sourceCount, candidates: candidateCount })),
    topCandidates: [...candidates.entries()].map(([candidateKey, candidate]) => ({
      candidateKey,
      district: candidate.district,
      ulb: candidate.ulb,
      sourceCount: candidate.sources.size,
      sources: [...candidate.sources].sort(),
    })).sort((left, right) => right.sourceCount - left.sourceCount || left.ulb.localeCompare(right.ulb)).slice(0, 12),
  };
}

export function getSourceReconciliationIssues(): SourceReconciliationIssue[] {
  let exactDuplicates = 0;
  let percentageMismatches = 0;
  let zeroTargets = 0;
  let achievementAboveTarget = 0;
  const entityPeriodGroups = new Map<string, Set<string>>();
  governedSnapshots.forEach((source) => {
    const latest = currentSnapshotRecords(source);
    const unique = uniqueRecords(latest);
    exactDuplicates += unique.duplicates;
    unique.records.forEach((record) => {
      const target = numberValue(record.target);
      const achievement = numberValue(record.achievement);
      const reportedPercentage = numberValue(firstValue(record, 'achievement_percentage', 'percentage'));
      if (target === null || achievement === null) return;
      if (target === 0) {
        zeroTargets += 1;
        return;
      }
      if (achievement > target) achievementAboveTarget += 1;
      if (reportedPercentage !== null && Math.abs(achievement / target * 100 - reportedPercentage) > 1) percentageMismatches += 1;
    });
    source.records.forEach((record) => {
      const entity = sourceCandidateKey(record) ?? firstValue(record, 'district_name', 'dstrt_nm') ?? 'entity-not-supplied';
      const key = `${source.responseMetadata.tableKey}|${entity}|${recordPeriodLabel(record)}`;
      if (!entityPeriodGroups.has(key)) entityPeriodGroups.set(key, new Set());
      entityPeriodGroups.get(key)!.add(exactSignature(record));
    });
  });
  const ambiguousEntityPeriods = [...entityPeriodGroups.values()].filter((signatures) => signatures.size > 1).length;
  const legacy = getLegacyWasteSummary();
  const processing = getProcessingRegistry();
  return [
    { id: 'recon-duplicates', title: 'Exact duplicate latest-period rows', count: exactDuplicates, severity: 'review', detail: 'Excluded from analytical totals while the raw source rows remain available.', rule: 'Exact equality across every retained field.' },
    { id: 'recon-ambiguous', title: 'Distinct rows for the same entity and period', count: ambiguousEntityPeriods, severity: 'review', detail: 'Requires source or grain review before a single value is selected.', rule: 'Same source + normalized entity candidate + period, with different raw fields.' },
    { id: 'recon-percentage', title: 'Reported percentage does not reconcile', count: percentageMismatches, severity: 'review', detail: 'Concentrated in MEPMA sources; monthly and cumulative field meanings may differ.', rule: '|reported % − achievement / target × 100| > 1 percentage point.' },
    { id: 'recon-zero-target', title: 'Zero-target rows', count: zeroTargets, severity: 'review', detail: 'Derived ratios remain unavailable and are never presented as 0%.', rule: 'target = 0.' },
    { id: 'recon-above-target', title: 'Achievement reported above target', count: achievementAboveTarget, severity: 'review', detail: 'Kept as reported and routed for definition or target review.', rule: 'achievement > target.' },
    { id: 'recon-period', title: 'FSTP period conflicts', count: processing.periodConflicts, severity: 'blocked', detail: 'Month-number and month-name fields conflict and are not silently corrected.', rule: 'month_number does not match month_name.' },
    { id: 'recon-balance', title: 'Legacy-waste balance mismatch', count: legacy.balanceConflicts, severity: 'review', detail: 'The source-reported balance does not reconcile for one retained row.', rule: '|target − achievement − balance| > 1.' },
  ];
}

const primaryDatasetUse = new Map<string, string>([
  [keys.sweeping, 'Collection inventory and entity-period ambiguity checks'],
  [keys.legacyWaste, 'Overview signal, clearance flow, Pareto and balance review'],
  [keys.plastic, 'Processing registry and configured-unit evidence'],
  [keys.cd, 'Processing registry and configured TPD inventory'],
  [keys.doorEAutos, 'District collection source-contrast view'],
  [keys.pushCarts, 'District collection source-contrast view'],
  [keys.triCycles, 'District collection source-contrast view'],
  [keys.fstp, 'Configured KLD registry and period-conflict quarantine'],
  [keys.ihhl, 'Sanitation delivery funnel and candidate review queue'],
  [keys.compactors, 'Collection inventory summary'],
  [keys.collection, 'ULB procurement funnel and delivery-gap review'],
  [keys.cbg, 'Processing registry and configured TPD inventory'],
  [keys.iswm, 'Facility registry, capacity, status distribution and review queue'],
  [keys.gfc, 'Limited 2024 historical outcome evidence'],
  [keys.rank, '2024 national-rank distribution'],
  [keys.odf, '2024 ODF distribution'],
]);

const supportingDatasetUse = new Map<string, string>([
  ['sasa_50_percent_green_spaces_api', 'Supporting programme portfolio and evidence breadth'],
  ['sasa_50_percent_greencover_api', 'Supporting programme portfolio and evidence breadth'],
  ['sasa_50_percent_rejuvenation_api', 'Supporting programme portfolio and evidence breadth'],
  ['sasa_cdma_ulbs_ewaste_collection_mechanism_api', 'District programme portfolio'],
  ['sasa_cdma_ulbs_single_use_plastic_ban_api', 'District programme portfolio'],
  ['sasa_declaration_of_odf_plus_model_villages_api', 'District programme portfolio with ambiguity flags'],
  [keys.terraceGardens, 'Five-period monitor and supporting programme portfolio'],
  ['sasa_itc_wow_program_in_schools_api', 'Supporting programme portfolio and reported-period evidence'],
  [keys.mepmaCircular, 'Five-period monitor and supporting programme portfolio'],
  [keys.homeComposting, 'Five-period monitor and supporting programme portfolio'],
  ['serp_kitchen_garden_api', 'SERP district programme portfolio'],
  ['serp_swachhata_awareness_api', 'SERP district programme portfolio'],
  ['serp_circular_economy_api', 'SERP district programme portfolio with above-target review'],
]);

export function getDatasetUsageAudit(): DatasetUsageAudit {
  const rows = readinessCatalogue.map<DatasetUsageRow>((dataset) => {
    const source = governedSnapshotByKey.get(dataset.tableKey);
    const state: DatasetUsageState = dataset.sourceState === 'DOCUMENTED — INGESTION PENDING'
      ? 'pending'
      : primaryDatasetUse.has(dataset.tableKey)
        ? 'primary'
        : supportingDatasetUse.has(dataset.tableKey)
          ? 'supporting'
          : !source && typeof dataset.liveRowCount === 'number'
            ? 'awaiting-pull'
            : 'unavailable';
    const usage = state === 'primary' ? primaryDatasetUse.get(dataset.tableKey)!
      : state === 'supporting' ? supportingDatasetUse.get(dataset.tableKey)!
        : state === 'pending' ? 'Documented schema only; excluded until a complete authenticated response is retained'
          : state === 'awaiting-pull' ? `Live and readable: ${(dataset.liveRowCount ?? 0).toLocaleString('en-IN')} rows checked ${dataset.liveCheckedOn}. Excluded until a complete paginated pull is retained.`
            : 'Authorized endpoint unavailable; no retained governed response';
    return {
      dataset: dataset.catalogueName,
      tableKey: dataset.tableKey,
      theme: dataset.theme,
      programme: dataset.programme,
      state,
      usage,
      records: source?.records.length ?? 0,
      period: source ? snapshotPeriod(source)
        : state === 'pending' ? 'Ingestion pending'
          : state === 'awaiting-pull' ? 'Awaiting pull'
            : 'Unavailable',
    };
  });
  const count = (state: DatasetUsageState) => rows.filter((row) => row.state === state).length;
  const primary = count('primary');
  const supporting = count('supporting');
  const awaitingPullRows = readinessCatalogue
    .filter((dataset) => !governedSnapshotByKey.get(dataset.tableKey) && typeof dataset.liveRowCount === 'number')
    .reduce((total, dataset) => total + (dataset.liveRowCount ?? 0), 0);
  return {
    total: rows.length,
    used: primary + supporting,
    primary,
    supporting,
    awaitingPull: count('awaiting-pull'),
    awaitingPullRows,
    unavailable: count('unavailable'),
    pending: count('pending'),
    rows,
  };
}

export function getDatasetPeriodAvailability(): DatasetPeriodRow[] {
  return readinessCatalogue.map((dataset) => {
    const source = governedSnapshotByKey.get(dataset.tableKey);
    if (!source) return {
      dataset: dataset.catalogueName,
      tableKey: dataset.tableKey,
      years: [],
      months: [],
      period: dataset.sourceState === 'DOCUMENTED — INGESTION PENDING'
        ? 'Not retained · documentation example only'
        : 'Unavailable',
      retrieved: false,
      conflict: false,
    };
    const availability = snapshotAvailablePeriods(source);
    const conflict = source.records.some((record) => record.month_number && record.month_name
      && !validatePeriod(Number(record.month_number), record.month_name));
    return {
      dataset: dataset.catalogueName,
      tableKey: dataset.tableKey,
      years: availability.years,
      months: availability.months,
      period: availability.months.length > 1
        ? `${availability.months.length} governed months · latest ${snapshotPeriod(source)}`
        : snapshotPeriod(source),
      retrieved: true,
      conflict,
    };
  });
}

export type TriageState = 'open' | 'acknowledged' | 'resolved';

export interface InboxItem {
  id: string;
  title: string;
  detail: string;
  /** The deterministic check that produced this item. Never a model or a heuristic. */
  rule: string;
  severity: 'info' | 'review' | 'blocked';
  count: number;
  origin: 'reconciliation' | 'quality' | 'facility-status';
  /** Where in the product the underlying records can be inspected. */
  screen: string;
}

const severityRank: Record<InboxItem['severity'], number> = { blocked: 0, review: 1, info: 2 };

/**
 * One prioritised worklist from every deterministic check in the product.
 *
 * These conditions already existed but were scattered across four screens — the
 * reconciliation workspace, the quality conditions list, the facility status queue and
 * the analytics tabs — so nobody could see the whole review load in one place. Nothing
 * here is inferred; each item names the rule that produced it.
 */
export function getReviewInbox(): InboxItem[] {
  const items: InboxItem[] = [];

  for (const issue of getSourceReconciliationIssues()) {
    items.push({
      id: issue.id,
      title: issue.title,
      detail: issue.detail,
      rule: issue.rule,
      severity: issue.severity,
      count: issue.count,
      origin: 'reconciliation',
      screen: 'Data Readiness → Quality',
    });
  }

  const facilityQueue = getFacilityStatusReviewQueue();
  if (facilityQueue.length > 0) {
    const statuses = [...new Set(facilityQueue.map((row) => row.sourceStatus).filter(Boolean))];
    items.push({
      id: 'facility-status-queue',
      title: 'Processing facilities with a source status needing review',
      detail: `Source-reported statuses: ${statuses.join(', ')}. These are the values the source supplied, not an inferred cause.`,
      rule: 'ISWM source status is not Commenced or Completed.',
      severity: 'review',
      count: facilityQueue.length,
      origin: 'facility-status',
      screen: 'Operational Analytics → Processing Infrastructure',
    });
  }

  // Seven quality conditions restate a reconciliation check under a different id and
  // title. Listing both would double the apparent review load, so the reconciliation
  // version wins — it carries the explicit rule text.
  const restatedByReconciliation = new Set([
    'duplicates', 'ambiguous-entity-period', 'percentage-reconciliation', 'denominators',
    'above-target', 'balance-reconciliation', 'period-conflicts',
  ]);
  // Descriptive counts rather than anything to action.
  const descriptiveOnly = new Set(['history', 'filtered', 'documented-pr']);

  for (const issue of getDataQualityIssues()) {
    if (restatedByReconciliation.has(issue.id) || descriptiveOnly.has(issue.id)) continue;
    if (issue.count === 0) continue;
    items.push({
      id: `quality-${issue.id}`,
      title: issue.title,
      detail: issue.detail,
      rule: 'Deterministic evidence-quality check over retained rows.',
      severity: issue.severity,
      count: issue.count,
      origin: 'quality',
      screen: 'Data Readiness → Quality',
    });
  }

  return items.sort((left, right) => severityRank[left.severity] - severityRank[right.severity]
    || right.count - left.count
    || left.title.localeCompare(right.title));
}

/** Triage is a local working note, exactly like the crosswalk decisions. */
export const TRIAGE_STORAGE_KEY = 'sasa-review-triage-v1';

let triageCache: Record<string, TriageState> | null = null;
const triageListeners = new Set<() => void>();
const emptyTriage: Record<string, TriageState> = {};

export function readTriage(): Record<string, TriageState> {
  if (triageCache) return triageCache;
  try {
    const stored = window.localStorage.getItem(TRIAGE_STORAGE_KEY);
    triageCache = stored ? (JSON.parse(stored) as Record<string, TriageState>) : {};
  } catch {
    triageCache = {};
  }
  return triageCache;
}

export function serverTriage(): Record<string, TriageState> {
  return emptyTriage;
}

export function writeTriage(next: Record<string, TriageState>): void {
  triageCache = next;
  try {
    window.localStorage.setItem(TRIAGE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or quota: the in-memory cache still serves this session.
  }
  for (const listener of triageListeners) listener();
}

export function subscribeTriage(listener: () => void): () => void {
  triageListeners.add(listener);
  return () => { triageListeners.delete(listener); };
}

export function getDataQualityIssues(): DataQualityIssue[] {
  const collection = getCollectionProcurementSummary();
  const ihhl = getIHHLFunnel();
  const processing = getProcessingRegistry();
  const reconciliation = getSourceReconciliationIssues();
  const reconciliationById = new Map(reconciliation.map((issue) => [issue.id, issue]));
  const incompletePagination = governedSnapshots.filter((item) => !isCompleteSnapshot(item)).length;
  const filteredExports = governedSnapshots.filter((item) => {
    const filters = item.requestEcho.filters ?? {};
    return Object.keys(filters).some((key) => /^(district|dstrt|ulb)(_id|_name|_nm)?$/.test(key));
  }).length;
  const multiPeriodExports = governedSnapshots.filter((item) => snapshotAvailablePeriods(item).months.length > 1).length;
  const snapshotsWithoutStableUlbIds = governedSnapshots.filter((item) =>
    item.records.some((record) => Boolean(record.ulb_name || record.ulb_nm))
    && !item.records.some((record) => Boolean(record.ulb_id))).length;
  const staleOutcomeRows = snapshot(keys.odf).records.length + snapshot(keys.gfc).records.length + snapshot(keys.rank).records.length;
  const blankSourceValues = governedSnapshots.reduce((count, item) => count + item.records.reduce((rowCount, record) =>
    rowCount + Object.values(record).filter((value) => value === null || value === undefined || String(value).trim() === '').length, 0), 0);
  const schemaAliasSnapshots = governedSnapshots.filter((item) => item.records.some((record) =>
    record.dstrt_nm !== undefined || record.ulb_nm !== undefined || record.mnth_nm !== undefined)).length;
  return [
    { id: 'pagination', title: 'Incomplete pagination', count: incompletePagination, severity: incompletePagination ? 'blocked' : 'info', detail: incompletePagination ? 'Some retrieved snapshots do not reconcile.' : 'All 29 retained snapshots reconcile to source totals.' },
    { id: 'duplicates', title: 'Exact duplicate current-period rows', count: reconciliationById.get('recon-duplicates')?.count ?? collection.duplicateRowsExcluded + ihhl.duplicateRowsExcluded, severity: 'review', detail: 'Duplicates across all latest-period exports are excluded from analytical totals and retained for inspection.' },
    { id: 'ambiguous-entity-period', title: 'Ambiguous entity-period records', count: reconciliationById.get('recon-ambiguous')?.count ?? 0, severity: 'review', detail: 'More than one distinct row exists for the same source, candidate identity, and period.' },
    { id: 'percentage-reconciliation', title: 'Percentage reconciliation differences', count: reconciliationById.get('recon-percentage')?.count ?? 0, severity: 'review', detail: 'Source-reported percentages differ from achievement divided by target; source semantics require review.' },
    { id: 'denominators', title: 'Zero denominators', count: reconciliationById.get('recon-zero-target')?.count ?? collection.zeroTargets + ihhl.zeroApprovalRows, severity: 'review', detail: 'Ratios are suppressed; zero or missing denominators never display as 0%.' },
    { id: 'above-target', title: 'Achievement above target', count: reconciliationById.get('recon-above-target')?.count ?? 0, severity: 'review', detail: 'Values remain source-reported and are routed for target or definition review.' },
    { id: 'balance-reconciliation', title: 'Legacy-waste balance mismatch', count: reconciliationById.get('recon-balance')?.count ?? 0, severity: 'review', detail: 'Target, achievement, and balance do not reconcile for the flagged source row.' },
    { id: 'period-conflicts', title: 'FSTP month conflicts', count: processing.periodConflicts, severity: 'blocked', detail: 'Source month number 7 conflicts with source month name JUNE; values are not silently corrected.' },
    { id: 'history', title: 'Multi-period full exports', count: multiPeriodExports, severity: 'info', detail: 'History is enumerated from returned records; current analytics select each dataset’s latest governed period.' },
    { id: 'filtered', title: 'Active source-filtered exports', count: filteredExports, severity: filteredExports ? 'review' : 'info', detail: filteredExports ? 'Some active responses include geographic filters and are not described as statewide.' : 'The 29 active full exports use empty export filters; earlier filtered evidence remains archived separately.' },
    { id: 'stale-filter-contracts', title: 'Stale dataset-page filter contracts', count: 13, severity: 'review', detail: 'Some dataset detail pages advertise obsolete filter fields even though governed full exports remain available.' },
    { id: 'unavailable', title: 'Unavailable authorized endpoints', count: missingAuthorizedSnapshotKeys.length, severity: 'blocked', detail: 'Gobardhan is authorized but no governed response was retained.' },
    { id: 'documented-pr', title: 'Documented PR integrations pending', count: documentedIntegrationCatalogue.length, severity: 'review', detail: 'Three additional table keys have documented schemas, but no complete authenticated snapshot is retained in the project.' },
    { id: 'pr-pagination', title: 'PR response pagination incomplete', count: 1, severity: 'blocked', detail: 'The documented door-to-door example returns 100 of 1,241,643 rows with a next-page token; it is excluded from analytics.' },
    { id: 'pr-semantics', title: 'PR title-to-schema conflicts', count: 2, severity: 'review', detail: 'Two endpoint titles and returned field semantics appear inverted between SWPC and Swachh Ratham concepts; labels require source-owner review.' },
    { id: 'identity', title: 'Snapshots without shared stable ULB IDs', count: snapshotsWithoutStableUlbIds, severity: 'blocked', detail: 'Normalized names remain candidate identities; no fuzzy matching is applied.' },
    { id: 'missing-fields', title: 'Blank retained field values', count: blankSourceValues, severity: blankSourceValues ? 'review' : 'info', detail: 'Blank strings are counted directly from retained rows and are never converted to zero.' },
    { id: 'schema-aliases', title: 'Snapshots using alternate field names', count: schemaAliasSnapshots, severity: 'review', detail: 'District, ULB, and month aliases are parsed explicitly while raw keys remain visible.' },
    { id: 'stale-outcomes', title: '2024 outcome rows', count: staleOutcomeRows, severity: 'review', detail: 'Outcome records are descriptive and kept separate from 2026 operational evidence.' },
    { id: 'split-check', title: 'ISWM wet + dry discrepancies', count: processing.splitConflicts, severity: processing.splitConflicts ? 'review' : 'info', detail: 'Configured total TPD is checked against wet plus dry TPD with a 0.01 tolerance.' },
  ];
}


/**
 * Every disputed value across the retained snapshots.
 *
 * Ordered so the groups with the widest disagreement come first, because the
 * size of the gap is what decides whether a figure can be published at all.
 */
export function getDisputedValues(): { groups: DisputedGroup[]; datasets: number; total: number } {
  const groups = readinessCatalogue.flatMap((dataset) => {
    const source = governedSnapshotByKey.get(dataset.tableKey);
    if (!source) return [];
    // Every retained period, not just the latest: a disputed figure in an
    // earlier month still poisons any comparison drawn across months.
    return findDisputedGroups(source.records, dataset.tableKey, dataset.catalogueName);
  });
  const spread = (group: DisputedGroup) => Math.max(...group.fields.map((field) => {
    const numbers = field.values.map((value) => Number(value.replace(/,/g, ''))).filter(Number.isFinite);
    return numbers.length > 1 ? Math.max(...numbers) - Math.min(...numbers) : 0;
  }), 0);
  groups.sort((left, right) => spread(right) - spread(left));
  return { groups, datasets: new Set(groups.map((group) => group.tableKey)).size, total: groups.length };
}

export interface ContrastPoint {
  ulb: string;
  district: string;
  /** Reported legacy-waste clearance for the current operational period. */
  clearance: number;
  /** National rank from the Swachh Survekshan year. Lower is better. */
  rank: number;
}

export interface ClearanceRankContrast {
  points: ContrastPoint[];
  clearancePeriod: string;
  rankYear: number;
  /** ULBs with a clearance figure but no rank record at all. */
  excludedNoRank: number;
  /** ULBs whose rank came back as 0, which means unranked rather than first. */
  excludedZeroRank: number;
  /** Points sitting exactly at 100% clearance, which is worth a second look. */
  atCeiling: number;
}

/**
 * The one contrast the retained evidence can actually populate today.
 *
 * This is deliberately NOT the Gap Radar. That plots reported implementation
 * against a same-period outcome and classifies the result; nothing here supports
 * a classification. The two axes are two years apart, so no causal reading is
 * available and none is offered — the panel states the gap rather than hiding it.
 *
 * Every other candidate axis is degenerate: IHHL completion is zero for 58 of 59
 * ULBs, collection delivery for 80 of 83, and GFC ratings exist for 5 of 102.
 * Legacy clearance and national rank are the only two measures in the retained
 * snapshots with enough spread to place a point meaningfully.
 *
 * A rank of 0 is treated as unranked, never as first place. That is finding A4
 * applied to the only outcome axis that works.
 */
export function getClearanceRankContrast(): ClearanceRankContrast {
  const key = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const outcomes = getSwachhOutcomeSummary();

  const rankByUlb = new Map<string, number>();
  let excludedZeroRank = 0;
  outcomes.rows.forEach((row) => {
    const name = key(row.ulb);
    const value = Number(row.nationalRank);
    if (!name || !Number.isFinite(value)) return;
    if (value <= 0) { excludedZeroRank += 1; return; }
    rankByUlb.set(name, value);
  });

  const legacy = getLegacyWasteSummary();
  const points: ContrastPoint[] = [];
  let excludedNoRank = 0;
  legacy.rows.forEach((row) => {
    if (row.clearanceRatio === null) return;
    const name = key(row.ulb);
    const rank = rankByUlb.get(name);
    if (rank === undefined) { excludedNoRank += 1; return; }
    points.push({ ulb: String(row.ulb ?? ''), district: String(row.district ?? ''), clearance: row.clearanceRatio, rank });
  });
  points.sort((left, right) => left.rank - right.rank);

  return {
    points,
    clearancePeriod: legacy.period,
    rankYear: outcomes.reportingYear,
    excludedNoRank,
    excludedZeroRank,
    atCeiling: points.filter((point) => point.clearance >= 1).length,
  };
}

export interface DistrictCoverage {
  /** District name as the anchor registry spells it. */
  district: string;
  /** ULBs the registry places in this district. */
  expected: number;
  /** Of those, how many returned at least one value this period. */
  reported: number;
  /** Distinct sources that carried a row for this district. */
  sources: number;
}

export interface DistrictCoverageSummary {
  districts: DistrictCoverage[];
  /** Districts present in the data with no boundary in the bundled map. */
  unmapped: string[];
  totalExpected: number;
  totalReported: number;
}

/**
 * ULB reporting coverage rolled up to district.
 *
 * The product has only ever worked at ULB grain or per programme; this is the
 * altitude an officer actually works at. Expected counts come from the anchor
 * registry, never from what happened to come back, so a district that returned
 * nothing reads as absent rather than simply missing from the list.
 */
export function getDistrictCoverage(): DistrictCoverageSummary {
  const canon = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '').replace(/(.)\1+/g, '$1');

  // Registry side: which ULBs belong to which district, and how the district is spelled.
  const expectedByDistrict = new Map<string, { label: string; ulbs: Set<string> }>();
  anchorRegistry.forEach((anchor) => {
    const key = canon(anchor.district);
    if (!key) return;
    if (!expectedByDistrict.has(key)) expectedByDistrict.set(key, { label: anchor.district, ulbs: new Set() });
    expectedByDistrict.get(key)!.ulbs.add(canon(anchor.name));
  });

  // Evidence side: which ULBs actually returned a row, and from how many sources.
  const reportedByDistrict = new Map<string, Set<string>>();
  const sourcesByDistrict = new Map<string, Set<string>>();
  governedSnapshots.forEach((snapshot) => {
    const tableKey = snapshot.responseMetadata?.tableKey ?? '';
    snapshot.records.forEach((record) => {
      const district = canon(record.district_name ?? record.dstrt_nm);
      const ulb = canon(record.ulb_name ?? record.ulb_nm);
      if (!district) return;
      if (!sourcesByDistrict.has(district)) sourcesByDistrict.set(district, new Set());
      sourcesByDistrict.get(district)!.add(tableKey);
      if (!ulb) return;
      if (!reportedByDistrict.has(district)) reportedByDistrict.set(district, new Set());
      reportedByDistrict.get(district)!.add(ulb);
    });
  });

  const districts: DistrictCoverage[] = [...expectedByDistrict.entries()].map(([key, entry]) => {
    const reporting = reportedByDistrict.get(key) ?? new Set<string>();
    // Only count ULBs the registry actually places here; a source naming a ULB
    // under the wrong district must not inflate that district's coverage.
    const matched = [...entry.ulbs].filter((ulb) => reporting.has(ulb)).length;
    return {
      district: entry.label,
      expected: entry.ulbs.size,
      reported: matched,
      sources: (sourcesByDistrict.get(key) ?? new Set()).size,
    };
  }).sort((left, right) => right.expected - left.expected);

  // Districts the data knows about that the 2022-vintage boundary file does not.
  const mappedKeys = new Set(districts.map((entry) => canon(entry.district)));
  const unmapped = [...sourcesByDistrict.keys()]
    .filter((key) => !mappedKeys.has(key))
    .map((key) => key);

  return {
    districts,
    unmapped,
    totalExpected: districts.reduce((total, entry) => total + entry.expected, 0),
    totalReported: districts.reduce((total, entry) => total + entry.reported, 0),
  };
}
