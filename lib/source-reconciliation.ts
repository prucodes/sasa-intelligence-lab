import {
  currentSnapshotRecords,
  governedSnapshotByKey,
  normalizeSourceName,
  recordPeriodLabel,
  type SnapshotEnvelope,
  type SnapshotRecord,
} from './snapshots';

/**
 * Cross-source reconciliation.
 *
 * Every other analysis in this app reads one source at a time, because two sources
 * sharing a district name is not evidence that they describe the same thing. This
 * module exists to test that assumption rather than assume it: it joins two sources on
 * a shared identity and reports what the join actually establishes.
 *
 * It is deliberately built to be able to say no. A join can succeed completely and the
 * two sources still not be combinable — and when the evidence says so, the result
 * carries a refusal, not a total.
 */

export interface ReconciliationSourceSpec {
  tableKey: string;
  /** How the programme is named to a reviewer, not the raw table name. */
  label: string;
  department: string;
  districtField: string;
  targetField: string;
  achievementField: string;
}

/** How a source's achievement column behaves across the periods it reports. */
export type AchievementBasis = 'non-decreasing' | 'varies' | 'indeterminate';

export interface ReconciliationCell {
  district: string;
  month: number;
  target: number | null;
  achievement: number | null;
}

export interface ReconciliationSourceState {
  spec: ReconciliationSourceSpec;
  period: string;
  /** Districts whose achievement never falls as the month advances. */
  nonDecreasingDistricts: number;
  districtsWithSeries: number;
  constantTargetDistricts: number;
  basis: AchievementBasis;
  latestTarget: number;
  latestAchievement: number;
  disputed: number;
  missing: number;
}

export interface ReconciliationRow {
  district: string;
  month: number;
  left: ReconciliationCell;
  right: ReconciliationCell;
  /** True only when both sources returned an identical target for this cell. */
  targetsCoincide: boolean;
}

export interface Reconciliation {
  left: ReconciliationSourceState;
  right: ReconciliationSourceState;
  months: number[];
  monthLabels: string[];
  rows: ReconciliationRow[];
  matched: number;
  leftOnly: string[];
  rightOnly: string[];
  districts: number;
  targetsCoincide: number;
  /** Set when the two sources cannot be summed or differenced. */
  refusal: string | null;
  boundary: string;
}

function measurement(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function monthOf(record: SnapshotRecord): number | null {
  const raw = record.month_no ?? record.mnth_no ?? record.month_number ?? record.month_id;
  const value = Number(String(raw ?? '').trim());
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}

/**
 * One cell per district-month. Repeated identical measurements collapse to one; a
 * district-month that reports two different measurements is held out entirely, because
 * choosing between them would be inventing evidence.
 */
function cellsOf(records: SnapshotRecord[], spec: ReconciliationSourceSpec) {
  const groups = new Map<string, SnapshotRecord[]>();
  let missing = 0;
  for (const record of records) {
    const district = normalizeSourceName(record[spec.districtField]);
    const month = monthOf(record);
    if (!district || month === null) { missing += 1; continue; }
    const key = `${district}|${month}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const cells = new Map<string, ReconciliationCell>();
  let disputed = 0;
  for (const [key, group] of groups) {
    const values = group.map((record) => ({
      target: measurement(record[spec.targetField]),
      achievement: measurement(record[spec.achievementField]),
    }));
    if (new Set(values.map((value) => JSON.stringify(value))).size > 1) { disputed += 1; continue; }
    // The display label comes from the first row of the group; the join key is normalized.
    cells.set(key, {
      district: String(group[0][spec.districtField]).trim(),
      month: Number(key.split('|')[1]),
      target: values[0].target,
      achievement: values[0].achievement,
    });
  }
  return { cells, disputed, missing };
}

/**
 * Whether a source's achievement column ever falls as the month advances.
 *
 * A year-to-date column cannot decrease; a per-month column usually does somewhere. This
 * does not prove which one a source is — a monthly series can rise by chance — so the
 * verdict is only ever 'non-decreasing' or 'varies', never "cumulative" or "monthly".
 * Naming the observation rather than the conclusion is the point.
 */
function classify(cells: Map<string, ReconciliationCell>): Pick<ReconciliationSourceState, 'basis' | 'nonDecreasingDistricts' | 'districtsWithSeries' | 'constantTargetDistricts'> {
  const byDistrict = new Map<string, ReconciliationCell[]>();
  for (const cell of cells.values()) {
    const key = normalizeSourceName(cell.district);
    byDistrict.set(key, [...(byDistrict.get(key) ?? []), cell]);
  }
  let nonDecreasing = 0;
  let withSeries = 0;
  let constantTarget = 0;
  for (const series of byDistrict.values()) {
    const ordered = [...series].sort((a, b) => a.month - b.month);
    const achievements = ordered.map((cell) => cell.achievement);
    if (ordered.length > 1 && achievements.every((value) => value !== null)) {
      withSeries += 1;
      if (achievements.every((value, index) => index === 0 || value! >= achievements[index - 1]!)) nonDecreasing += 1;
    }
    const targets = new Set(ordered.map((cell) => cell.target));
    if (targets.size === 1) constantTarget += 1;
  }
  const basis: AchievementBasis = withSeries === 0 ? 'indeterminate'
    : nonDecreasing === withSeries ? 'non-decreasing' : 'varies';
  return { basis, nonDecreasingDistricts: nonDecreasing, districtsWithSeries: withSeries, constantTargetDistricts: constantTarget };
}

function latestMonth(cells: Map<string, ReconciliationCell>): number | null {
  const months = [...cells.values()].map((cell) => cell.month);
  return months.length ? Math.max(...months) : null;
}

function stateOf(snapshot: SnapshotEnvelope, spec: ReconciliationSourceSpec): ReconciliationSourceState & { cells: Map<string, ReconciliationCell> } {
  const { cells, disputed, missing } = cellsOf(snapshot.records, spec);
  const month = latestMonth(cells);
  const latest = [...cells.values()].filter((cell) => cell.month === month);
  return {
    spec,
    period: recordPeriodLabel(currentSnapshotRecords(snapshot)[0] ?? snapshot.records[0] ?? {}),
    ...classify(cells),
    latestTarget: latest.reduce((sum, cell) => sum + (cell.target ?? 0), 0),
    latestAchievement: latest.reduce((sum, cell) => sum + (cell.achievement ?? 0), 0),
    disputed,
    missing,
    cells,
  };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function reconcileSources(left: ReconciliationSourceSpec, right: ReconciliationSourceSpec): Reconciliation {
  const leftSnapshot = governedSnapshotByKey.get(left.tableKey);
  const rightSnapshot = governedSnapshotByKey.get(right.tableKey);
  if (!leftSnapshot || !rightSnapshot) {
    throw new Error(`Reconciliation needs both retained sources: ${left.tableKey}, ${right.tableKey}`);
  }

  const leftState = stateOf(leftSnapshot, left);
  const rightState = stateOf(rightSnapshot, right);

  const keys = [...new Set([...leftState.cells.keys(), ...rightState.cells.keys()])].sort();
  const rows: ReconciliationRow[] = [];
  const leftOnly: string[] = [];
  const rightOnly: string[] = [];
  for (const key of keys) {
    const leftCell = leftState.cells.get(key);
    const rightCell = rightState.cells.get(key);
    if (leftCell && !rightCell) { leftOnly.push(leftCell.district); continue; }
    if (rightCell && !leftCell) { rightOnly.push(rightCell.district); continue; }
    if (!leftCell || !rightCell) continue;
    rows.push({
      district: leftCell.district,
      month: leftCell.month,
      left: leftCell,
      right: rightCell,
      targetsCoincide: leftCell.target !== null && leftCell.target === rightCell.target,
    });
  }
  rows.sort((a, b) => b.month - a.month || a.district.localeCompare(b.district));

  const months = [...new Set(rows.map((row) => row.month))].sort((a, b) => a - b);
  const targetsCoincide = rows.filter((row) => row.targetsCoincide).length;

  // The two refusal conditions, in the order a reviewer would check them. Both are
  // statements about the sources, not about delivery.
  const refusal = targetsCoincide === 0 && rows.length > 0
    ? `No district-month reports the same target in both sources (0 of ${rows.length}). These are two separate programmes, not one programme reported twice.`
    : leftState.basis !== rightState.basis
      ? 'The two achievement columns do not behave the same way across periods, so they are not on a common accounting basis.'
      : null;

  return {
    left: leftState,
    right: rightState,
    months,
    monthLabels: months.map((month) => MONTHS[month - 1] ?? String(month)),
    rows,
    matched: rows.length,
    leftOnly: [...new Set(leftOnly)],
    rightOnly: [...new Set(rightOnly)],
    districts: new Set(rows.map((row) => normalizeSourceName(row.district))).size,
    targetsCoincide,
    refusal,
    boundary: 'Each source is shown on its own terms. Values are never summed, differenced or ranked across the two, and neither source is treated as a check on the other.',
  };
}

/**
 * Household latrine construction as reported by two departments over the same districts
 * and months. Retained 2026-09-08 from the LGD-enriched exports.
 */
export const ihhlConstructionSources: [ReconciliationSourceSpec, ReconciliationSourceSpec] = [
  {
    tableKey: 'housing_construction_of_ihhls_new1_api',
    label: 'Housing — construction of IHHLs',
    department: 'Housing',
    districtField: 'lgd_district_name',
    targetField: 'construction_of_ihhls_target_units',
    achievementField: 'construction_of_ihhls_achievement',
  },
  {
    tableKey: 'sbm_construction_of_ihhls_new1_api',
    label: 'SBM — construction of IHHLs',
    department: 'Swachh Bharat Mission',
    districtField: 'lgd_district_name',
    targetField: 'ihhls_target_units',
    achievementField: 'ihhls_achievement',
  },
];

export function getIhhlReconciliation(): Reconciliation {
  return reconcileSources(...ihhlConstructionSources);
}
