/**
 * Disputed values: the same place and period reported twice with different numbers.
 *
 * This is not a hypothetical. Across the retained snapshots, eight datasets
 * return more than one row for the same entity in the same period, and in twelve
 * of those groups the rows disagree. Sweeping Machines reports Nellore in July as
 * both 19 machines and 4.
 *
 * The existing `uniqueRecords` helper removes byte-identical duplicates only, so
 * a contradictory pair survives deduplication and both rows reach the aggregate.
 * A disputed entity is therefore counted twice, and the total is wrong in a
 * direction nobody can see.
 *
 * There is no rule that resolves this from inside the data: with no record ID,
 * submission date or revision number (finding A8) neither row is newer, better
 * sourced, or more authoritative. So the honest treatment is the one this module
 * supports — surface the disagreement, name both values, and let a person decide.
 */

import type { SnapshotRecord } from '@/lib/snapshots';

/** Fields that identify or timestamp a row rather than measure anything. */
const NON_MEASURE = /^(district|dstrt|ulb|secretariat|sachivalayam|month|mnth|year|fin_year|financial_year|load_date|inserted_date|i_ts|u_ts|s_no|a_in|active_indicator|api_|lgd_|.*_code|.*_id|.*_nm|.*_name)/i;

export interface DisputedField {
  field: string;
  /** Every distinct value reported for this field, in the order encountered. */
  values: string[];
}

export interface DisputedGroup {
  tableKey: string;
  dataset: string;
  district: string;
  entity: string;
  period: string;
  /** How many rows share this place and period. Always two or more. */
  rows: number;
  fields: DisputedField[];
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function identity(record: SnapshotRecord) {
  return {
    district: text(record.district_name ?? record.dstrt_nm ?? record.api_district_name),
    entity: text(record.ulb_name ?? record.ulb_nm ?? record.village_name ?? record.secretariat_name),
    period: text(record.month_number ?? record.mnth_no ?? record.month_id ?? record.month ?? record.month_name ?? record.mnth_nm),
  };
}

/** True when a column carries a measurement rather than an identifier or a timestamp. */
export function isMeasureField(field: string): boolean {
  return !NON_MEASURE.test(field);
}

/**
 * Finds place-and-period groups whose rows disagree on at least one measure.
 *
 * Groups whose rows are byte-identical are not disputed — those are harmless
 * duplicates that deduplication already handles, and reporting them as conflicts
 * would bury the twelve that actually matter.
 */
export function findDisputedGroups(
  records: SnapshotRecord[],
  tableKey: string,
  dataset: string,
): DisputedGroup[] {
  const groups = new Map<string, SnapshotRecord[]>();
  records.forEach((record) => {
    const { district, entity, period } = identity(record);
    if (!entity && !district) return;
    const key = `${district}|${entity}|${period}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  });

  const disputed: DisputedGroup[] = [];
  groups.forEach((rows) => {
    if (rows.length < 2) return;
    const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(isMeasureField);
    const conflicting = fields
      .map((field) => ({ field, values: [...new Set(rows.map((row) => text(row[field])))] }))
      .filter((entry) => entry.values.length > 1);
    if (!conflicting.length) return;
    const { district, entity, period } = identity(rows[0]);
    disputed.push({ tableKey, dataset, district, entity, period, rows: rows.length, fields: conflicting });
  });
  return disputed;
}

/**
 * The effect on a summed measure: what the disputed rows contribute today versus
 * the range the answer could actually take. Used to state the size of the error
 * rather than merely asserting one exists.
 */
export function disputedSumImpact(group: DisputedGroup, field: string): { counted: number; low: number; high: number } | null {
  const entry = group.fields.find((item) => item.field === field);
  if (!entry) return null;
  const numbers = entry.values.map((value) => Number(value.replace(/,/g, ''))).filter((value) => Number.isFinite(value));
  if (numbers.length < 2) return null;
  return {
    // Every row reaches the aggregate today, so the contribution is their sum.
    counted: numbers.reduce((total, value) => total + value, 0),
    low: Math.min(...numbers),
    high: Math.max(...numbers),
  };
}


export interface DisputeExclusion<T> {
  /** Rows safe to aggregate: every disputed place-and-period group removed. */
  records: T[];
  /** Entities dropped because their reported value contradicts itself. */
  excludedEntities: number;
  /** Rows dropped with them. Always at least twice `excludedEntities`. */
  excludedRows: number;
}

/**
 * Removes rows whose place-and-period group disagrees on `field`.
 *
 * A disputed figure is an unknown figure, so it is treated exactly as a
 * non-return: excluded from the numerator, and excluded from coverage too, since
 * that entity did not supply a usable value. Keeping both rows and summing them
 * — which is what happens without this — reports a number no source ever stated.
 * Nellore's sweeping machines were counted as 23 that way, from rows saying 19
 * and 4.
 *
 * Byte-identical duplicates are not disputes and are left to normal
 * deduplication; only genuine disagreement is removed here.
 */
export function excludeDisputed<T extends SnapshotRecord>(records: T[], field: string): DisputeExclusion<T> {
  const groups = new Map<string, T[]>();
  records.forEach((record) => {
    const { district, entity, period } = identity(record);
    const key = `${district}|${entity}|${period}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  });

  const disputedKeys = new Set<string>();
  groups.forEach((rows, key) => {
    if (rows.length < 2) return;
    const values = new Set(rows.map((row) => text(row[field])));
    if (values.size > 1) disputedKeys.add(key);
  });

  if (!disputedKeys.size) return { records, excludedEntities: 0, excludedRows: 0 };

  const kept = records.filter((record) => {
    const { district, entity, period } = identity(record);
    return !disputedKeys.has(`${district}|${entity}|${period}`);
  });
  return {
    records: kept,
    excludedEntities: disputedKeys.size,
    excludedRows: records.length - kept.length,
  };
}
