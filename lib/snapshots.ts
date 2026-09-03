import kitchenGarden from '@/data/full-snapshots/serp_kitchen_garden_api.json';
import swachhataAwareness from '@/data/full-snapshots/serp_swachhata_awareness_api.json';
import serpCircularEconomy from '@/data/full-snapshots/serp_circular_economy_api.json';
import doorToDoorEAutos from '@/data/full-snapshots/sasa_sac_door_to_door_e_autos_api.json';
import doorToDoorPushCarts from '@/data/full-snapshots/sasa_sac_door_to_door_push_carts_api.json';
import doorToDoorTriCycles from '@/data/full-snapshots/sasa_sac_door_to_door_tri_cycles_api.json';
import odfPlusVillages from '@/data/full-snapshots/sasa_declaration_of_odf_plus_model_villages_api.json';
import eAutosService from '@/data/full-snapshots/sasa_sac_machinery_e_autos_service_model_api.json';
import plasticWaste from '@/data/full-snapshots/sasa_establishment_of_plastic_waste_management_units_api.json';
import itcWow from '@/data/full-snapshots/sasa_itc_wow_program_in_schools_api.json';
import mepmaCircularEconomy from '@/data/full-snapshots/sasa_mepma_entrepreneurs_promoted_for_circular_economy_api.json';
import terraceGardens from '@/data/full-snapshots/sasa_households_promoted_for_terrace_gardening_kitchen_gardens_api.json';
import homeComposting from '@/data/full-snapshots/sasa_mepma_households_promoted_for_home_composite_api.json';
import legacyWaste from '@/data/full-snapshots/sasa_100_percent_clearance_of_legacy_waste_api.json';
import ihhl from '@/data/full-snapshots/sasa_sac_identification_of_new_ihhls_api.json';
import fstp from '@/data/full-snapshots/sasa_sac_establishing_fstps_information_api.json';
import compactors from '@/data/full-snapshots/sasa_sac_machinery_compactors_api.json';
import greenCover from '@/data/full-snapshots/sasa_50_percent_greencover_api.json';
import rejuvenation from '@/data/full-snapshots/sasa_50_percent_rejuvenation_api.json';
import greenSpaces from '@/data/full-snapshots/sasa_50_percent_green_spaces_api.json';
import iswm from '@/data/full-snapshots/sasa_sac_msw_processing_facilities_iswm_facilities_api.json';
import cbg from '@/data/full-snapshots/sasa_sac_msw_processing_facilities_cbg_units_api.json';
import gfc from '@/data/full-snapshots/sasa_sac_swacch_survekshan_information_gfc_status_api.json';
import odf from '@/data/full-snapshots/sasa_sac_swacch_survekshan_information_odf_status_api.json';
import nationalRank from '@/data/full-snapshots/sasa_sac_swacch_survekshan_information_national_rank_api.json';
import sweepingMachines from '@/data/full-snapshots/sasa_sac_sweeping_machines_information_api.json';
import cdWaste from '@/data/full-snapshots/sasa_sac_c_d_waste_processing_api.json';
import singleUsePlastic from '@/data/full-snapshots/sasa_cdma_ulbs_single_use_plastic_ban_api.json';
import eWaste from '@/data/full-snapshots/sasa_cdma_ulbs_ewaste_collection_mechanism_api.json';

export type SnapshotRecord = Record<string, string>;

export interface SnapshotEnvelope {
  requestEcho: {
    departmentId: string;
    requestId: string;
    purpose: string;
    tableKey: string;
    filters?: Record<string, string>;
  };
  responseMetadata: {
    responseId: string;
    generatedAt: string;
    totalRecordCount: number;
    returnedRecordCount: number;
    hasNextPage: boolean;
    nextPageToken: string | null;
    tableKey: string;
    tableName: string;
  };
  records: SnapshotRecord[];
}

const asSnapshot = (value: unknown) => value as SnapshotEnvelope;

export const governedSnapshots: SnapshotEnvelope[] = [
  kitchenGarden,
  swachhataAwareness,
  serpCircularEconomy,
  doorToDoorEAutos,
  doorToDoorPushCarts,
  doorToDoorTriCycles,
  odfPlusVillages,
  eAutosService,
  plasticWaste,
  itcWow,
  mepmaCircularEconomy,
  terraceGardens,
  homeComposting,
  legacyWaste,
  ihhl,
  fstp,
  compactors,
  greenCover,
  rejuvenation,
  greenSpaces,
  iswm,
  cbg,
  gfc,
  odf,
  nationalRank,
  sweepingMachines,
  cdWaste,
  singleUsePlastic,
  eWaste,
].map(asSnapshot);

export const governedSnapshotByKey = new Map(
  governedSnapshots.map((snapshot) => [snapshot.responseMetadata.tableKey, snapshot]),
);

export const missingAuthorizedSnapshotKeys = ['sasa_establishment_of_gobardhan_units_api'] as const;

export function isCompleteSnapshot(snapshot: SnapshotEnvelope): boolean {
  return snapshot.responseMetadata.hasNextPage === false
    && snapshot.responseMetadata.nextPageToken === null
    && snapshot.responseMetadata.totalRecordCount === snapshot.records.length
    && snapshot.responseMetadata.returnedRecordCount === snapshot.records.length;
}

export const governedSnapshotStats = {
  authorizedDatasets: 30,
  retrievedDatasets: governedSnapshots.length,
  completeDatasets: governedSnapshots.filter(isCompleteSnapshot).length,
  records: governedSnapshots.reduce((total, snapshot) => total + snapshot.records.length, 0),
  baselineUlbRows: currentSnapshotRecords(governedSnapshotByKey.get('sasa_sac_identification_of_new_ihhls_api')).length,
  baselineUlbCandidates: new Set(
    (governedSnapshotByKey.get('sasa_sac_identification_of_new_ihhls_api')?.records ?? [])
      .map(sourceCandidateKey)
      .filter(Boolean),
  ).size,
};

export function normalizeSourceName(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function sourceCandidateKey(record: SnapshotRecord): string | null {
  const district = record.district_name ?? record.dstrt_nm;
  const ulb = record.ulb_name ?? record.ulb_nm;
  if (!district || !ulb) return null;
  return `${normalizeSourceName(district)}|${normalizeSourceName(ulb)}`;
}

export function recordsBySourceCandidate(tableKey: string): Map<string, SnapshotRecord> {
  const snapshot = governedSnapshotByKey.get(tableKey);
  const entries = currentSnapshotRecords(snapshot)
    .map((record) => [sourceCandidateKey(record), record] as const)
    .filter((entry): entry is readonly [string, SnapshotRecord] => Boolean(entry[0]));
  return new Map(entries);
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthNumber(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  const index = monthNames.findIndex((month) => month.toLowerCase() === trimmed.toLowerCase());
  return index >= 0 ? index + 1 : null;
}

export function recordPeriodParts(record: SnapshotRecord): { year: number | null; month: number | null } {
  const monthId = record.month_id?.trim();
  const encodedYear = monthId && /^\d{6}$/.test(monthId) ? Number(monthId.slice(0, 4)) : null;
  const encodedMonth = monthId && /^\d{6}$/.test(monthId) ? Number(monthId.slice(4)) : monthNumber(monthId);
  const year = Number(record.year ?? encodedYear);
  const rawMonth = record.month_number ?? record.mnth_no ?? record.month ?? record.kpi_month
    ?? record.month_name ?? record.mnth_nm;
  return {
    year: Number.isFinite(year) && year > 0 ? year : null,
    month: encodedMonth ?? monthNumber(rawMonth),
  };
}

export function recordPeriodLabel(record: SnapshotRecord): string {
  const { year, month } = recordPeriodParts(record);
  if (year && month) return `${monthNames[month - 1]} ${year}`;
  if (year) return String(year);
  if (month) return monthNames[month - 1];
  return 'Period not supplied';
}

function recordPeriodSortKey(record: SnapshotRecord): number | null {
  const { year, month } = recordPeriodParts(record);
  if (year) return year * 100 + (month ?? 0);
  if (month) return month;
  return null;
}

/**
 * Records for one reported period. With no period the latest returned period is used,
 * which is the long-standing behaviour. Passing a period id selects that period instead
 * and returns nothing when the dataset did not report it — absence stays visible rather
 * than silently falling back to another month.
 */
export function currentSnapshotRecords(snapshot: SnapshotEnvelope | undefined, periodId?: string | null): SnapshotRecord[] {
  if (!snapshot) return [];
  if (periodId) {
    const wanted = periodSortKey(periodId);
    return wanted === null ? [] : snapshot.records.filter((record) => recordPeriodSortKey(record) === wanted);
  }
  const keys = snapshot.records.map(recordPeriodSortKey).filter((value): value is number => value !== null);
  if (!keys.length) return snapshot.records;
  const latest = Math.max(...keys);
  return snapshot.records.filter((record) => recordPeriodSortKey(record) === latest);
}

/** `2026-07` → 202607, matching the numeric key records sort by. */
export function periodSortKey(periodId: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(periodId);
  if (!match) return null;
  return Number(match[1]) * 100 + Number(match[2]);
}

export function recordPeriodId(record: SnapshotRecord): string | null {
  const { year, month } = recordPeriodParts(record);
  if (!year || !month) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export interface PeriodOption {
  id: string;
  label: string;
  /** Datasets that returned at least one row in this period. */
  datasets: number;
  rows: number;
}

/**
 * Every fully-dated period actually present in the retained operational responses.
 * 2024 outcome rows carry a year with no month and are deliberately excluded — they are
 * a separate descriptive view, not an operational period a reviewer can select.
 */
export function operationalPeriodOptions(): PeriodOption[] {
  const byPeriod = new Map<string, { datasets: Set<string>; rows: number }>();
  for (const snapshot of governedSnapshots) {
    for (const record of snapshot.records) {
      const id = recordPeriodId(record);
      if (!id) continue;
      if (!byPeriod.has(id)) byPeriod.set(id, { datasets: new Set(), rows: 0 });
      const entry = byPeriod.get(id)!;
      entry.datasets.add(snapshot.responseMetadata.tableKey);
      entry.rows += 1;
    }
  }
  return [...byPeriod.entries()]
    .map(([id, entry]) => ({
      id,
      label: recordPeriodLabel({ year: id.slice(0, 4), month_number: id.slice(5) } as SnapshotRecord),
      datasets: entry.datasets.size,
      rows: entry.rows,
    }))
    .sort((left, right) => (periodSortKey(right.id) ?? 0) - (periodSortKey(left.id) ?? 0));
}

/** The most recent operational period, used as the default selection. */
export function latestOperationalPeriodId(): string | null {
  return operationalPeriodOptions()[0]?.id ?? null;
}

export function snapshotAvailablePeriods(snapshot: SnapshotEnvelope): { years: number[]; months: number[] } {
  const parts = snapshot.records.map(recordPeriodParts);
  return {
    years: [...new Set(parts.map((part) => part.year).filter((value): value is number => value !== null))].sort(),
    months: [...new Set(parts.map((part) => part.month).filter((value): value is number => value !== null))].sort((a, b) => a - b),
  };
}

export function snapshotPeriod(snapshot: SnapshotEnvelope): string {
  const current = currentSnapshotRecords(snapshot);
  return recordPeriodLabel(current[0] ?? snapshot.records[0] ?? {});
}

export function snapshotProvenance(snapshot: SnapshotEnvelope): string {
  return `Authenticated governed export · ${snapshot.responseMetadata.responseId} · ${snapshot.responseMetadata.generatedAt} · ${snapshot.records.length}/${snapshot.responseMetadata.totalRecordCount} rows retained`;
}
