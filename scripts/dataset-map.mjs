/**
 * Field mapping for large paginated datasets.
 *
 * The CDMA datasets are documented but not yet provisioned, and the column names are
 * expected to change once the standardisation pass adds LGD master columns. Everything
 * downstream — ingestion, aggregation, reconciliation — reads through this file, so a
 * rename is a one-line edit here rather than a rewrite of the pipeline.
 *
 * Each candidate field list is tried in order and the first present, non-empty key wins.
 * That lets a dataset be re-ingested across a rename without changing the map twice.
 */

/** A value that is present but carries no observation. Never treated as a zero. */
export const MISSING_TOKENS = new Set(['', 'null', 'NULL', 'NA', 'N/A', '-', 'null ']);

export const datasets = {
  msw_door_to_door_collection_api: {
    label: 'MSW door-to-door collection',
    grain: 'secretariat-day',
    // Documented as `Msw_door_to_door_collection_api` in the index and lowercase in the
    // request body. Lowercase is what the request examples actually send.
    tableKey: 'msw_door_to_door_collection_api',
    district: ['api_lgd_dist_code', 'lgd_district_code', 'district_code'],
    districtName: ['api_district_name', 'district_name', 'lgd_district_name'],
    ulb: ['api_lgd_mandal_code', 'lgd_mandal_code', 'ulb_code'],
    ulbName: ['ulb_name', 'api_mandal_name', 'mandal_name'],
    subEntity: ['sachivalayam_code', 'secretariat_code'],
    subEntityName: ['sachivalayam_name', 'secretariat_name'],
    date: ['date1'],
    measures: {
      totalHouseholds: ['total_households'],
      collectedHouseholds: ['collected_households'],
      segregation: ['garbage_segregation'],
    },
    /** Ratios are only computed where the denominator is a real, non-missing number. */
    ratios: { collectionCoverage: ['collectedHouseholds', 'totalHouseholds'] },
  },

  identification_of_bulk_waste_generators_api: {
    label: 'Bulk waste generator identification',
    grain: 'secretariat-day',
    tableKey: 'identification_of_bulk_waste_generators_api',
    district: ['api_lgd_dist_code', 'lgd_district_code', 'district_code'],
    districtName: ['api_district_name', 'district_name'],
    ulb: ['api_lgd_mandal_code', 'lgd_mandal_code', 'ulb_code'],
    ulbName: ['ulb_name', 'api_mandal_name'],
    subEntity: ['secretariat_code', 'sachivalayam_code'],
    subEntityName: ['secretariat_name', 'sachivalayam_name'],
    date: ['date1'],
    measures: { bwgs: ['no_of_bwgs'] },
    ratios: {},
  },

  onsite_processing_of_wet_waste_bwg_api: {
    label: 'On-site wet waste processing by BWGs',
    grain: 'secretariat-day',
    tableKey: 'onsite_processing_of_wet_waste_bwg_api',
    district: ['api_lgd_dist_code', 'lgd_district_code', 'district_code'],
    districtName: ['api_district_name', 'district_name'],
    ulb: ['api_lgd_mandal_code', 'lgd_mandal_code', 'ulb_code'],
    ulbName: ['ulb_name', 'api_mandal_name'],
    subEntity: ['secretariat_code', 'sachivalayam_code'],
    subEntityName: ['secretariat_name', 'sachivalayam_name'],
    date: ['date1'],
    measures: { processingBwgs: ['wet_waste_processing_bwgs'] },
    ratios: {},
  },

  waste_segregation_api: {
    label: 'Waste segregation',
    grain: 'secretariat-day',
    // The section index spells this `waste_egregation_api`; the heading, request body,
    // echo and tableName all say `waste_segregation_api`. Confirm before the first pull.
    tableKey: 'waste_segregation_api',
    alternateTableKeys: ['waste_egregation_api'],
    district: ['api_lgd_dist_code', 'lgd_district_code', 'district_code'],
    districtName: ['api_district_name', 'district_name'],
    ulb: ['api_lgd_mandal_code', 'lgd_mandal_code', 'ulb_code'],
    ulbName: ['ulb_name', 'api_mandal_name'],
    subEntity: ['sachivalayam_code', 'secretariat_code'],
    subEntityName: ['sachivalayam_name', 'secretariat_name'],
    date: ['date1'],
    measures: { totalHouseholds: ['total_households'], segregation: ['garbage_segregation'] },
    ratios: {},
  },
};

/** First present, non-missing value from a list of candidate column names. */
export function pick(record, candidates) {
  for (const key of candidates ?? []) {
    const value = record?.[key];
    if (value === undefined || value === null) continue;
    const trimmed = String(value).trim();
    if (trimmed === '' || MISSING_TOKENS.has(trimmed)) continue;
    return trimmed;
  }
  return null;
}

/**
 * Numeric parse that keeps missing distinct from zero. A blank, null or NA returns
 * `null`; a genuine "0" returns 0. Collapsing the two would make every coverage rate
 * in the daily data wrong, so it is kept explicit all the way through.
 */
export function pickNumber(record, candidates) {
  const raw = pick(record, candidates);
  if (raw === null) return null;
  const cleaned = raw.replace(/[",\s]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** ISO date (YYYY-MM-DD) → YYYY-MM, or null when the date is unusable. */
export function periodOf(record, config) {
  const raw = pick(record, config.date);
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})/.exec(raw);
  return match ? `${match[1]}-${match[2]}` : null;
}
