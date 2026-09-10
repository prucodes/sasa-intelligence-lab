import { uniqueSourceRecords } from './record-contract.mjs';
import { governedSnapshotByKey, normalizeSourceName, type SnapshotRecord } from './snapshots';

/** Selected-period target and achievement. Additivity across months is unconfirmed. */

export interface PlanMonth {
  /** `YYYYMM` as the source encodes it. */
  monthId: string;
  year: number;
  month: number;
  label: string;
  target: number | null;
  achievement: number | null;
  /** No district reported an achievement for this month. */
  unreported: boolean;
  reportedDistricts:number;
  targetDistricts:number;
}

export interface PlanDistrict {
  district: string;
  target: number;
  achievement: number;
  /** Months in the elapsed window this district never reported. */
  silentMonths: number;
  targetMissing:boolean;
  achievementMissing:boolean;
}

/**
 * `monthly` — the source reports a period, so a series can be drawn.
 * `point-in-time` — one target and one achievement per district, no period column at
 * all. Drawing a trend for these would invent a time dimension the source never gave.
 */
export type Periodicity = 'monthly' | 'point-in-time';

export interface DeliveryPlan {
  id: string;
  tableKey: string;
  label: string;
  periodicity: Periodicity;
  /**
   * Set when a source's identifier and name columns hold each other's values.
   * `itc_wow_schools_api` returns dstrt_id="ANANTAPUR" and dstrt_nm="12". Detected by
   * type, not hardcoded, so it clears itself if the source is corrected.
   */
  transposedIdentity: boolean;
  /** Read from the source's own `units` column, not assumed from the dataset name. */
  unit: string;
  /** What the source says these rows describe. May contradict the endpoint name. */
  reportedWorkName: string | null;
  /**
   * Set when another retained plan returns byte-identical rows. `soak_pits_api` serves
   * Compost Pits data — same 336 rows, and its own `work_name` column says so. A
   * duplicate is excluded from every total rather than counted twice.
   */
  duplicateOf: string | null;
  months: PlanMonth[];
  districts: PlanDistrict[];
  /** Months with at least one reported achievement, in order. */
  elapsed: PlanMonth[];
  /** Months carrying a target but no reported achievement anywhere. */
  remaining: PlanMonth[];
  plannedTotal: number;
  plannedToDate: number;
  deliveredToDate: number;
  /** Achievement / target for selected-period districts with both measures. */
  paceToDate: number | null;
  rows: number;
  excluded: number;
  boundary: string;
  selectedMonth:PlanMonth|null;
  retrievedAt:string;
  expectedDistricts:number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function measurement(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'null') return null;
  const value = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

type PeriodStrategy = 'yyyymm' | 'month-year' | 'none';

/**
 * The three period encodings these sources actually use. `yyyymm` is a single column
 * literally named `month`; `month-year` is a month number beside a year; `none` means
 * the source returns no period at all and none may be inferred for it.
 */
function periodOf(record: SnapshotRecord, strategy: PeriodStrategy): { monthId: string; year: number; month: number } | null {
  if (strategy === 'none') return null;
  if (strategy === 'yyyymm') {
    const raw = String(record.month ?? '').trim();
    if (!/^\d{6}$/.test(raw)) return null;
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4));
    return month >= 1 && month <= 12 ? { monthId: raw, year, month } : null;
  }
  const month = Number(String(record.month_no ?? record.mnth_no ?? '').trim());
  const year = Number(String(record.year ?? '').trim());
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isFinite(year) || year < 2000) return null;
  return { monthId: `${year}${String(month).padStart(2, '0')}`, year, month };
}

/**
 * Whether a source's id and name columns hold each other's values.
 *
 * A district name is not a number and an id is. When the "name" column parses as a
 * number for every row and the "id" column does not, the two are transposed — which is
 * what `itc_wow_schools_api` does. Reported rather than silently corrected, and detected
 * by shape so a fixed source stops being flagged without an edit here.
 */
function identityLooksTransposed(records: SnapshotRecord[], idField: string, nameField: string): boolean {
  const numeric = (field: string) => {
    const values = records.map((record) => String(record[field] ?? '').trim()).filter(Boolean);
    return values.length > 0 && values.every((value) => Number.isFinite(Number(value)));
  };
  return numeric(nameField) && !numeric(idField);
}

interface PlanSpec {
  id: string;
  tableKey: string;
  label: string;
  period: PeriodStrategy;
  /** District label candidates, in preference order. */
  districtFields: string[];
  targetFields: string[];
  achievementFields: string[];
  /** Checked for a transposed id/name pair, when the source carries both. */
  identityPair?: [idField: string, nameField: string];
  unitFallback: string;
}

const SPECS: PlanSpec[] = [
  { id: 'compost-pits', tableKey: 'compost_pits_api', label: 'Compost pits', period: 'yyyymm', districtFields: ['district_name'], targetFields: ['target'], achievementFields: ['achivement', 'achievement'], unitFallback: 'units' },
  { id: 'magic-drains', tableKey: 'magic_drains_api', label: 'Magic drains', period: 'yyyymm', districtFields: ['district_name'], targetFields: ['target'], achievementFields: ['achivement', 'achievement'], unitFallback: 'units' },
  { id: 'soak-pits', tableKey: 'soak_pits_api', label: 'Soak pits', period: 'yyyymm', districtFields: ['district_name'], targetFields: ['target'], achievementFields: ['achivement', 'achievement'], unitFallback: 'units' },
  { id: 'sanitary-complexes', tableKey: 'construction_of_csc_api', label: 'Community sanitary complexes', period: 'month-year', districtFields: ['api_district_name', 'district_name'], targetFields: ['csc_target_units'], achievementFields: ['csc_achievement'], unitFallback: 'complexes' },
  // Both of these return one figure per district and no period column.
  { id: 'itc-wow-schools', tableKey: 'itc_wow_schools_api', label: 'ITC WOW schools', period: 'none', districtFields: ['lgd_district_name'], targetFields: ['trgt_units'], achievementFields: ['achvmnt'], identityPair: ['dstrt_id', 'dstrt_nm'], unitFallback: 'schools' },
  { id: 'gobardhan', tableKey: 'sasa_establishment_of_gobardhan_units_api', label: 'Gobardhan units', period: 'none', districtFields: ['lgd_district_name', 'dstrt_nm'], targetFields: ['gobardhan_trgt_uniits'], achievementFields: ['gobardhan_achvmnt'], identityPair: ['dstrt_id', 'dstrt_nm'], unitFallback: 'units' },
];

/** First present, non-blank value from a list of candidate columns. */
function pick(record: SnapshotRecord, fields: string[]): string {
  for (const field of fields) {
    const value = String(record[field] ?? '').trim();
    if (value && value.toLowerCase() !== 'null') return value;
  }
  return '';
}

/** Content signature of a snapshot, ignoring the two descriptive columns. */
function contentSignature(records: SnapshotRecord[]): string {
  return records
    .map((record) => JSON.stringify(Object.keys(record).filter((key) => key !== 'work_name' && key !== 'units').sort().map((key) => [key, record[key]])))
    .sort()
    .join('\n');
}

function buildPlan(spec: PlanSpec, selectedPeriod: string | null = null): DeliveryPlan | null {
  const snapshot = governedSnapshotByKey.get(spec.tableKey);
  if (!snapshot) return null;

  type Cell = { target: number | null; achievement: number | null };
  const byMonth = new Map<string, Map<string, Cell>>();
  const labels = new Map<string, string>();
  let excluded = 0;

  // Unperiodized sources are held in a single synthetic bucket so one code path builds
  // both shapes. That bucket never becomes a PlanMonth, so nothing is drawn for it.
  const UNPERIODIZED = '';

  const prepared = snapshot.records.flatMap(record => {
    const period = periodOf(record, spec.period);
    const district = pick(record, spec.districtFields);
    if (!district || (spec.period !== 'none' && !period)) { excluded++; return []; }
    return [{ key: `${period?.monthId ?? UNPERIODIZED}|${normalizeSourceName(district)}`, bucket: period?.monthId ?? UNPERIODIZED, district,
      target: measurement(pick(record,spec.targetFields) || undefined), achievement: measurement(pick(record,spec.achievementFields) || undefined) }];
  });
  const unique = uniqueSourceRecords(prepared, (row: typeof prepared[number])=>row.key, (row: typeof prepared[number])=>JSON.stringify([row.target,row.achievement]));
  excluded += unique.quality.conflictingRows + unique.quality.missingKeyRows;
  // Keep the observed district frame even when a conflicting cell is held out.
  for (const row of prepared) {
    const key=normalizeSourceName(row.district);
    labels.set(key,row.district);
    if(!byMonth.has(row.bucket)) byMonth.set(row.bucket,new Map());
    byMonth.get(row.bucket)!.set(key,{target:null,achievement:null});
  }
  for (const row of unique.records) byMonth.get(row.bucket)!.set(normalizeSourceName(row.district),{target:row.target,achievement:row.achievement});

  const monthIds = [...byMonth.keys()].filter((id) => id !== UNPERIODIZED).sort();
  const months: PlanMonth[] = monthIds.map((monthId) => {
    const cells = [...byMonth.get(monthId)!.values()];
    const reported = cells.filter((cell) => cell.achievement !== null);
    const targets = cells.filter((cell) => cell.target !== null);
    return {
      monthId,
      year: Number(monthId.slice(0, 4)),
      month: Number(monthId.slice(4)),
      label: MONTHS[Number(monthId.slice(4)) - 1] ?? monthId,
      target: targets.length ? targets.reduce((sum, cell) => sum + cell.target!, 0) : null,
      achievement: reported.length ? reported.reduce((sum, cell) => sum + cell.achievement!, 0) : null,
      unreported: reported.length === 0,
      reportedDistricts:reported.length,
      targetDistricts:targets.length,
    };
  });

  // The elapsed window ends at the last month anyone reported. Later months carry a
  // plan only, and are never counted as shortfall.
  const lastReported = months.reduce((last, month, index) => month.unreported ? last : index, -1);
  const elapsed = lastReported >= 0 ? months.slice(0, lastReported + 1) : [];
  const remaining = lastReported >= 0 ? months.slice(lastReported + 1) : months;

  // These sources do not establish additivity. Count one selected source month only.
  const selectedMonth = (selectedPeriod ? months.find(m=>m.monthId===selectedPeriod.replace('-','')) : elapsed.at(-1)) ?? null;
  const countedBuckets = spec.period === 'none'
    ? [UNPERIODIZED]
    : selectedMonth ? [selectedMonth.monthId] : [];
  const counted = new Set(countedBuckets);

  const districtTotals = new Map<string, PlanDistrict>();
  for (const [bucket, districts] of byMonth) {
    if (!counted.has(bucket)) continue;
    for (const [key, cell] of districts) {
      const entry = districtTotals.get(key) ?? { district: labels.get(key) ?? key, target: 0, achievement: 0, silentMonths: 0, targetMissing:cell.target===null, achievementMissing:cell.achievement===null };
      if (cell.target !== null) entry.target += cell.target;
      if (cell.achievement !== null) entry.achievement += cell.achievement; else entry.silentMonths += 1;
      districtTotals.set(key, entry);
    }
  }

  const plannedToDate = [...districtTotals.values()].reduce((sum, district) => sum + district.target, 0);
  const deliveredToDate = [...districtTotals.values()].reduce((sum, district) => sum + district.achievement, 0);
  const plannedTotal = plannedToDate; // Compatibility field: no cross-month sum is supported.
  const paired = [...districtTotals.values()].filter(d=>!d.targetMissing && !d.achievementMissing);
  const pairedTarget = paired.reduce((sum,d)=>sum+d.target,0);
  const pairedAchievement = paired.reduce((sum,d)=>sum+d.achievement,0);

  const units = [...new Set(snapshot.records.map((record) => String(record.units ?? '').trim()).filter(Boolean))];
  const workNames = [...new Set(snapshot.records.map((record) => String(record.work_name ?? '').trim()).filter(Boolean))];

  return {
    id: spec.id,
    tableKey: spec.tableKey,
    label: spec.label,
    periodicity: spec.period === 'none' ? 'point-in-time' : 'monthly',
    transposedIdentity: spec.identityPair
      ? identityLooksTransposed(snapshot.records, spec.identityPair[0], spec.identityPair[1])
      : false,
    unit: units.length === 1 ? units[0] : spec.unitFallback,
    reportedWorkName: workNames.length === 1 ? workNames[0] : null,
    duplicateOf: null,
    months,
    districts: [...districtTotals.values()].sort((a, b) => b.target - a.target || a.district.localeCompare(b.district)),
    elapsed,
    remaining,
    plannedTotal,
    plannedToDate,
    deliveredToDate,
    paceToDate: pairedTarget > 0 ? pairedAchievement / pairedTarget : null,
    rows: snapshot.records.length,
    excluded,
    selectedMonth,
    retrievedAt:snapshot.responseMetadata.generatedAt,
    expectedDistricts:labels.size,
    boundary: spec.period === 'none'
      ? 'The source returns one target and one achievement per district with no reporting period. No trend is shown because none is reported.'
      : 'The headline and district table describe one selected reporting month. Whether achievements are monthly additions or cumulative positions is unconfirmed, so values are not added across months. Missing achievements remain unreported.',
  };
}

/**
 * Every retained works plan, with duplicates marked.
 *
 * The duplicate is detected by comparing content, not by hardcoding a known bad key —
 * if the platform fixes `soak_pits_api` the flag disappears on the next pull, and if a
 * different endpoint starts duplicating another it is caught the same way.
 */
export function getDeliveryPlans(selectedPeriod: string | null = null): DeliveryPlan[] {
  const plans = SPECS.map(spec=>buildPlan(spec,selectedPeriod)).filter((plan): plan is DeliveryPlan => plan !== null);
  const signatures = new Map<string, string>();
  for (const plan of plans) {
    const snapshot = governedSnapshotByKey.get(plan.tableKey);
    if (!snapshot) continue;
    const signature = contentSignature(snapshot.records);
    const first = signatures.get(signature);
    if (first && first !== plan.tableKey) plan.duplicateOf = first;
    else signatures.set(signature, plan.tableKey);
  }
  return plans;
}

/** Plans that carry distinct evidence. The only safe basis for any total. */
export function getDistinctDeliveryPlans(): DeliveryPlan[] {
  return getDeliveryPlans().filter((plan) => plan.duplicateOf === null);
}
