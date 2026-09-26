/**
 * Environment and carbon ledger.
 *
 * Nothing new was ingested for this screen. Seventeen of the retained routes already
 * describe the three municipal levers that decide an urban carbon position: waste kept
 * out of the landfill pathway, sewage and faecal sludge treated instead of discharged,
 * and green cover held as a sink. They were catalogued as sanitation programmes, which is
 * why nobody read them as an environment account.
 *
 * The screen keeps two things apart, and the separation is the whole design:
 *
 *   The physical ledger is retained evidence. Every figure is a quantity a source
 *   reported, at the grain it reported it, for one declared period. Concentration is
 *   named because a statewide ratio cannot tell an officer which town to call.
 *
 *   The estimate layer is arithmetic. It converts two of those physical quantities into
 *   tonnes of CO2 equivalent using published default factors, and it is labelled an
 *   estimate everywhere it appears. A carbon claim is audited, so the parameters are
 *   listed with their sources and the derivation is shown, letting a reviewer challenge
 *   a factor instead of the result. Where a conversion would need data we do not hold,
 *   the line stays unconverted and names the missing input. That list is the data ask.
 *
 * The cap in `capacityBound` is the point of the exercise. Reported doorstep segregation
 * implies a wet tonnage far above the wet capacity that any source reports as completed,
 * so the avoided-emissions figure this evidence can carry is set by the plants that exist,
 * not by the collection reports. An estimate layer that did not say so would be flattery.
 */

import { currentSnapshots } from './current-snapshots';
import { serviceSnapshot } from './ulb-service';
import { sourceNumber, sourceText, uniqueSourceRecords } from './record-contract.mjs';

type Row = Record<string, unknown>;

interface Prepared {
  entity: string | null;
  district: string | null;
  period: string | null;
  periodSort: string | null;
  key: string | null;
  target: number | null;
  reported: number | null;
  status: string | null;
}

/** One named entity carrying part of a shortfall or part of the progress. */
export interface LedgerEntity {
  name: string;
  district: string;
  value: number;
}

export interface LedgerLine {
  id: string;
  tableKey: string;
  label: string;
  /** What the quantity is counted in, lower case, as it reads after a number. */
  unit: string;
  grain: 'ULB' | 'District' | 'Facility';
  /**
   * Whether a bigger number is progress or a shortfall. The legacy waste line reports the
   * balance still on the ground, so drawing it as progress against the programme total
   * would say "9.4% done" about a figure that means "9.4% left", which is the opposite.
   */
  polarity: 'progress' | 'shortfall';
  period: string | null;
  target: number | null;
  reported: number | null;
  /** reported / target, only where a source returned both. */
  ratio: number | null;
  /** Entities that returned a target for this period. */
  entities: number;
  /**
   * Entities carrying a positive figure in the counted measure. On a shortfall line that
   * reads as the number of towns holding the problem, which is the actionable count; on a
   * progress line it reads as the number that moved.
   */
  reporting: number;
  /** Entities carrying a target that reported no progress at all. */
  silent: number;
  /** Share of all reported progress held by the named entities, and who they are. */
  concentration: { share: number; top: LedgerEntity[] } | null;
  /** What this figure does not establish. Shown with the figure, never below the fold. */
  boundary: string;
  /** A source condition a reader has to know before quoting the line. */
  caution: string | null;
  quality: { rawRows: number; uniqueRows: number; duplicateRows: number; conflictingKeys: number };
  retainedAt: string;
}

export interface LedgerSection {
  id: 'diversion' | 'treatment' | 'sinks';
  title: string;
  lede: string;
  lines: LedgerLine[];
}

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const MONTH_LABEL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const envelope = (tableKey: string) => currentSnapshots.find((snapshot) => snapshot.requestEcho.tableKey === tableKey);

function snapshotRows(tableKey: string): { rows: Row[]; retainedAt: string } {
  const source = envelope(tableKey);
  if (!source) return { rows: [], retainedAt: 'not retained' };
  return { rows: source.records as Row[], retainedAt: source.responseMetadata.generatedAt.slice(0, 10) };
}

/**
 * A row's declared reporting period. A month name with a separate year is preferred over a
 * numeric month, because several routes carry both and disagree: the FSTP response labels
 * month 7 as JUNE. Reading the name keeps the disagreement visible instead of resolving it
 * silently in favour of whichever field happens to be checked first.
 */
function resolvePeriod(row: Row): { label: string; sort: string } | null {
  const name = sourceText(row.month_name ?? row.mnth_nm);
  const year = sourceText(row.year);
  if (name && year) {
    const index = MONTHS.indexOf(name.toUpperCase());
    if (index >= 0) return { label: `${MONTH_LABEL[index]} ${year}`, sort: `${year}-${String(index + 1).padStart(2, '0')}` };
  }
  const packed = sourceText(row.month_id ?? row.month ?? row.kpi_month);
  if (packed && /^\d{6}$/.test(packed)) {
    const index = Number(packed.slice(4)) - 1;
    if (index >= 0 && index < 12) return { label: `${MONTH_LABEL[index]} ${packed.slice(0, 4)}`, sort: `${packed.slice(0, 4)}-${packed.slice(4)}` };
  }
  // A numeric month with a year, which is all the CDMA routes return.
  const numeric = sourceNumber(row.mnth_no ?? row.month_number ?? row.month_id ?? row.month);
  if (numeric !== null && year && numeric >= 1 && numeric <= 12) {
    return { label: `${MONTH_LABEL[numeric - 1]} ${year}`, sort: `${year}-${String(numeric).padStart(2, '0')}` };
  }
  if (name && !year) {
    const index = MONTHS.indexOf(name.toUpperCase());
    if (index >= 0) return { label: MONTH_LABEL[index], sort: String(index + 1).padStart(2, '0') };
  }
  return null;
}

interface LineSpec {
  id: string;
  tableKey: string;
  label: string;
  unit: string;
  grain: 'ULB' | 'District' | 'Facility';
  /** Fields holding the entity name, in the order they should be tried. */
  entityFields: string[];
  /**
   * A record identifier, for registries that hold several facilities in one town. The
   * sewage response carries 121 plants across 47 ULBs, so keying on the town name would
   * throw eight plants out as conflicting and silently drop two thirds of the capacity.
   */
  identityFields?: string[];
  targetFields?: string[];
  reportedFields?: string[];
  statusFields?: string[];
  /** Only rows whose status matches count towards `reported`, for a facility registry. */
  countStatus?: (status: string | null) => boolean;
  polarity?: 'progress' | 'shortfall';
  boundary: string;
  caution?: string;
}

const DISTRICT_FIELDS = ['dstrt_nm', 'district_name', 'lgd_district_name'];

function firstText(row: Row, fields: string[]): string | null {
  for (const field of fields) {
    const value = sourceText(row[field]);
    if (value !== null) return value;
  }
  return null;
}

function firstNumber(row: Row, fields: string[] | undefined): number | null {
  if (!fields) return null;
  for (const field of fields) {
    const value = sourceNumber(row[field]);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Prepare, select one period, then collapse exact repeats.
 *
 * The green programme response repeats most of its ULBs verbatim inside a single month, so
 * summing raw rows overstates every green figure by about two thirds. Repeats collapse and
 * rows that disagree on the measure are held out rather than averaged, because there is no
 * basis in the response for preferring one of them.
 */
function buildLine(spec: LineSpec): LedgerLine {
  const { rows, retainedAt } = snapshotRows(spec.tableKey);
  const prepared: Prepared[] = rows.map((row) => {
    const period = resolvePeriod(row);
    const entity = firstText(row, spec.entityFields);
    const district = firstText(row, DISTRICT_FIELDS);
    const identity = spec.identityFields ? firstText(row, spec.identityFields) : entity && `${district ?? 'no district'}|${entity}`;
    return {
      entity,
      district,
      period: period?.label ?? null,
      periodSort: period?.sort ?? null,
      key: identity ? `${identity}|${period?.label ?? 'undated'}` : null,
      target: firstNumber(row, spec.targetFields),
      reported: firstNumber(row, spec.reportedFields),
      status: firstText(row, spec.statusFields ?? []),
    };
  });

  const periods = [...new Set(prepared.map((row) => row.periodSort).filter((sort): sort is string => Boolean(sort)))].sort();
  const latest = periods.at(-1) ?? null;
  const selected = latest === null ? prepared : prepared.filter((row) => row.periodSort === latest);

  const unique = uniqueSourceRecords(selected, (row: Prepared) => row.key, (row: Prepared) => JSON.stringify([row.target, row.reported, row.status]));
  const entityRows = unique.records as Prepared[];

  const counted = spec.countStatus ? entityRows.filter((row) => spec.countStatus!(row.status)) : entityRows;
  const targetTotal = entityRows.some((row) => row.target !== null) ? entityRows.reduce((sum, row) => sum + (row.target ?? 0), 0) : null;
  const reportedTotal = counted.some((row) => row.reported !== null) ? counted.reduce((sum, row) => sum + (row.reported ?? 0), 0) : null;

  const withTarget = entityRows.filter((row) => (row.target ?? 0) > 0);
  const silent = withTarget.filter((row) => (row.reported ?? 0) === 0).length;

  const progress = counted.filter((row) => (row.reported ?? 0) > 0).sort((a, b) => (b.reported ?? 0) - (a.reported ?? 0));
  const top = progress.slice(0, 5);
  const topTotal = top.reduce((sum, row) => sum + (row.reported ?? 0), 0);
  // A 'top five' over a registry of three is not a concentration, it is the registry. The
  // panel is withheld below eight reporting entities so the shape claim stays a real one.
  const concentration = reportedTotal && reportedTotal > 0 && progress.length >= 8
    ? { share: topTotal / reportedTotal, top: top.map((row) => ({ name: row.entity ?? 'Name not supplied', district: row.district ?? 'District not supplied', value: row.reported ?? 0 })) }
    : null;

  return {
    id: spec.id,
    tableKey: spec.tableKey,
    label: spec.label,
    unit: spec.unit,
    grain: spec.grain,
    polarity: spec.polarity ?? 'progress',
    period: entityRows[0]?.period ?? null,
    target: targetTotal,
    reported: reportedTotal,
    ratio: targetTotal !== null && targetTotal > 0 && reportedTotal !== null ? reportedTotal / targetTotal : null,
    entities: withTarget.length || entityRows.length,
    reporting: progress.length,
    silent,
    concentration,
    boundary: spec.boundary,
    caution: spec.caution ?? null,
    quality: { rawRows: selected.length, uniqueRows: entityRows.length, duplicateRows: unique.quality.duplicateRows, conflictingKeys: unique.quality.conflictingKeys },
    retainedAt,
  };
}

/** Legacy waste is the one line whose shortfall, not its progress, is the finding. */
function legacyWasteBalance(): LedgerLine {
  const line = buildLine({
    id: 'legacy-balance',
    tableKey: 'sasa_100_percent_clearance_of_legacy_waste_api',
    label: 'Legacy waste still on the ground',
    unit: 'reported units',
    grain: 'ULB',
    polarity: 'shortfall',
    entityFields: ['ulb_name', 'ulb_nm'],
    targetFields: ['target'],
    reportedFields: ['balance'],
    boundary: 'The source reports a quantity with no unit label, and reports a balance rather than a measured survey. An uncleared dump is a live methane source, so this is a standing liability, not an outstanding task.',
    caution: 'No unit is declared anywhere in the response. Every conversion below treats the figure as metric tonnes, which is an assumption and not a reading.',
  });
  return { ...line, silent: 0 };
}

function processingRegistry(): LedgerLine {
  const configured = buildLine({
    id: 'iswm-configured',
    tableKey: 'sasa_sac_msw_processing_facilities_iswm_facilities_api',
    label: 'Solid waste processing capacity configured',
    unit: 'TPD',
    grain: 'Facility',
    entityFields: ['ulb_name', 'ulb_nm'],
    reportedFields: ['total_tpd'],
    statusFields: ['status_tx'],
    boundary: 'Configured capacity is what a facility record states, not throughput. A facility that has commenced is not processing waste.',
  });
  return configured;
}

function processingCompleted(): LedgerLine {
  return buildLine({
    id: 'iswm-completed',
    tableKey: 'sasa_sac_msw_processing_facilities_iswm_facilities_api',
    label: 'Of that, capacity at facilities reported completed',
    unit: 'TPD',
    grain: 'Facility',
    entityFields: ['ulb_name', 'ulb_nm'],
    reportedFields: ['total_tpd'],
    statusFields: ['status_tx'],
    countStatus: (status) => (status ?? '').replace(/"/g, '').trim().toLowerCase() === 'completed',
    boundary: 'Completed is a reported construction status. It does not establish that the facility is operating, nor at what load.',
  });
}

/** Wet capacity at completed facilities, which is what bounds any composting estimate. */
export function completedWetCapacity() {
  const { rows, retainedAt } = snapshotRows('sasa_sac_msw_processing_facilities_iswm_facilities_api');
  const prepared = rows.map((row) => {
    const period = resolvePeriod(row);
    const entity = firstText(row, ['ulb_name', 'ulb_nm']);
    return {
      key: entity ? `${firstText(row, DISTRICT_FIELDS) ?? 'no district'}|${entity}|${period?.label ?? 'undated'}` : null,
      period: period?.label ?? null,
      periodSort: period?.sort ?? null,
      entity,
      status: (sourceText(row.status_tx) ?? '').replace(/"/g, '').trim(),
      total: sourceNumber(row.total_tpd),
      wet: sourceNumber(row.wet_tpd),
    };
  });
  const periods = [...new Set(prepared.map((row) => row.periodSort).filter((sort): sort is string => Boolean(sort)))].sort();
  const latest = periods.at(-1) ?? null;
  const selected = prepared.filter((row) => row.periodSort === latest);
  const unique = uniqueSourceRecords(selected, (row: typeof prepared[number]) => row.key, (row: typeof prepared[number]) => JSON.stringify([row.total, row.wet, row.status]));
  const facilities = unique.records as typeof prepared;
  const completed = facilities.filter((row) => row.status.toLowerCase() === 'completed');
  return {
    period: selected[0]?.period ?? null,
    retainedAt,
    facilities: facilities.length,
    completedFacilities: completed.length,
    completedTotalTpd: completed.reduce((sum, row) => sum + (row.total ?? 0), 0),
    completedWetTpd: completed.reduce((sum, row) => sum + (row.wet ?? 0), 0),
    configuredWetTpd: facilities.reduce((sum, row) => sum + (row.wet ?? 0), 0),
    largest: completed.slice().sort((a, b) => (b.wet ?? 0) - (a.wet ?? 0))[0]?.entity ?? null,
    statuses: [...facilities.reduce((counts, row) => counts.set(row.status || 'Status not supplied', (counts.get(row.status || 'Status not supplied') ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count })),
  };
}

/** Doorstep segregation on the one urban day that survived retention complete. */
export function segregationAtSource() {
  const totals = serviceSnapshot.totals;
  const points = serviceSnapshot.points as unknown[][];
  const silent = points.filter((point) => Number(point[3] ?? 0) === 0).length;
  return {
    day: serviceSnapshot.day,
    secretariats: points.length,
    ulbs: serviceSnapshot.ulbs.length,
    households: totals.households,
    collected: totals.collected,
    segregated: totals.segregated,
    reach: totals.households > 0 ? totals.collected / totals.households : null,
    segregationOfCollected: totals.collected > 0 ? totals.segregated / totals.collected : null,
    silentSecretariats: silent,
    boundary: serviceSnapshot.boundary,
  };
}

export function getEnvironmentSections(): LedgerSection[] {
  return [
    {
      id: 'diversion',
      title: 'Keeping waste out of the landfill pathway',
      lede: 'Unsegregated wet waste on an unmanaged site is the largest methane source a municipality controls. These are the quantities the state reports against it.',
      lines: [
        legacyWasteBalance(),
        processingRegistry(),
        processingCompleted(),
        buildLine({
          id: 'cbg',
          tableKey: 'msw_cbg_units_new1_api',
          label: 'Compressed biogas capacity contracted',
          unit: 'TPD',
          grain: 'Facility',
          entityFields: ['ulb_nm', 'ulb_name'],
          reportedFields: ['total_tpd'],
          statusFields: ['status_tx'],
          boundary: 'Contracted capacity. No unit in this response carries a status that reports it as operating.',
        }),
        buildLine({
          id: 'cd-waste',
          tableKey: 'cd_waste_process_plants_revival_new1_api',
          label: 'Construction and demolition waste plant capacity',
          unit: 'TPD',
          grain: 'Facility',
          entityFields: ['ulb_nm', 'ulb_name'],
          reportedFields: ['plnt_cpcty_in_tpd'],
          boundary: 'Plant capacity under a revival programme. The response carries no commissioning or throughput measure.',
        }),
        buildLine({
          id: 'plastic-units',
          tableKey: 'sasa_establishment_of_plastic_waste_management_units_api',
          label: 'Plastic waste management units established',
          unit: 'units',
          grain: 'District',
          entityFields: ['district_name', 'dstrt_nm'],
          targetFields: ['pwm_units_trgt_units', 'target'],
          reportedFields: ['pwm_units_achvmnt', 'achievement'],
          boundary: 'A district count of units, not tonnage recovered. Recovery cannot be derived from a unit count.',
          caution: 'The current response carries no reporting date, so this is a position rather than a month. An earlier dated vintage of the same route reported 88 units in May and June and 50 in July; a count of established units that falls needs a source explanation before it is quoted in either direction.',
        }),
        buildLine({
          id: 'sup-ban',
          tableKey: 'sasa_cdma_ulbs_single_use_plastic_ban_api',
          label: 'ULBs enforcing the single use plastic ban',
          unit: 'ULBs',
          grain: 'District',
          entityFields: ['district_name', 'dstrt_nm'],
          targetFields: ['target'],
          reportedFields: ['achievement'],
          boundary: 'Reported enforcement at district grain. It records a declaration, not an inspection.',
        }),
        buildLine({
          id: 'ewaste',
          tableKey: 'sasa_cdma_ulbs_ewaste_collection_mechanism_api',
          label: 'ULBs with an e-waste collection mechanism',
          unit: 'ULBs',
          grain: 'District',
          entityFields: ['district_name', 'dstrt_nm'],
          targetFields: ['target'],
          reportedFields: ['achievement'],
          boundary: 'A mechanism reported in place. No quantity of e-waste collected is returned by this route.',
        }),
        buildLine({
          id: 'home-composting',
          tableKey: 'sasa_mepma_households_promoted_for_home_composite_api',
          label: 'Households promoted for home composting',
          unit: 'households',
          grain: 'ULB',
          entityFields: ['ulb_name', 'ulb_nm'],
          targetFields: ['target'],
          reportedFields: ['achievement'],
          boundary: 'Households promoted in the selected month, not households composting. The target repeats unchanged across all five retained months.',
          caution: 'In the latest month 79 of 123 ULB rows report an achievement of zero while carrying a positive achievement percentage in the same row. The two fields are not consistent, so the percentage column is not used here.',
        }),
        buildLine({
          id: 'gobardhan',
          tableKey: 'sasa_establishment_of_gobardhan_units_api',
          label: 'Gobardhan units established',
          unit: 'units',
          grain: 'District',
          entityFields: ['dstrt_nm', 'lgd_district_name'],
          targetFields: ['gobardhan_trgt_uniits'],
          reportedFields: ['gobardhan_achvmnt'],
          boundary: 'District counts with no reporting date in the response. It supports a position, not a trend.',
        }),
      ],
    },
    {
      id: 'treatment',
      title: 'Treating sewage and faecal sludge instead of discharging it',
      lede: 'Untreated sewage in a stagnant channel is a methane source as well as a water pollutant. These are the plants the state reports, and the stage each has reached.',
      lines: [
        buildLine({
          id: 'sewage',
          tableKey: 'sewage_treated_qty_new1_api',
          label: 'Sewage treatment capacity in the programme',
          unit: 'MLD',
          grain: 'Facility',
          entityFields: ['ulb_nm', 'ulb_name'],
          identityFields: ['rec_id'],
          reportedFields: ['capacity_mld'],
          statusFields: ['crnt_prgrs_tx'],
          boundary: 'Capacity in a package, at the progress stage each record states. No record in this response reports an operating plant, so no treated volume can be read from it.',
          caution: 'The route is named for treated quantity but returns planned capacity and a progress label. Treated volume is not in the payload.',
        }),
        buildLine({
          id: 'fstp',
          tableKey: 'fstps_stps_cotreatment_new1_api',
          label: 'Faecal sludge co-treatment capacity',
          unit: 'KLD',
          grain: 'Facility',
          entityFields: ['ulb_nm', 'ulb_name'],
          reportedFields: ['capacity_in_kld'],
          statusFields: ['overall_progress'],
          boundary: 'Configured capacity with a percentage progress label. Completion is a construction status, not evidence of sludge received.',
          caution: 'Period labels in this response disagree with themselves: rows carrying month number 7 are labelled JUNE. Both copies of each site report the same capacity, so the repeats collapse, but the reporting month cannot be established from the response.',
        }),
      ],
    },
    {
      id: 'sinks',
      title: 'Holding green cover and water bodies as a sink',
      lede: 'The green programme is the only part of this evidence that removes carbon rather than avoiding it. It is also the part with the widest gap between target and report.',
      lines: [
        buildLine({
          id: 'green-cover',
          tableKey: 'sasa_50_percent_greencover_api',
          label: 'Green cover planted',
          unit: 'km',
          grain: 'ULB',
          entityFields: ['ulb_nm', 'ulb_name'],
          targetFields: ['green_cover_trgts_in_kms'],
          reportedFields: ['green_cover_achvd_in_kms'],
          boundary: 'A length in kilometres of avenue planting, not a share of land area and not a canopy measurement. The programme is named for a fifty percent share; the data is a length.',
          caution: 'This response repeats most ULBs verbatim within the same month. The repeats are collapsed here; adding raw rows would overstate every green figure by about two thirds.',
        }),
        buildLine({
          id: 'water-bodies',
          tableKey: 'sasa_50_percent_rejuvenation_api',
          label: 'Water bodies rejuvenated',
          unit: 'water bodies',
          grain: 'ULB',
          entityFields: ['ulb_nm', 'ulb_name'],
          targetFields: ['rejuvenation_of_water_bodies_in_nos_targets'],
          reportedFields: ['rejuvenation_of_water_bodies_achived'],
          boundary: 'A count of water bodies. No area, depth or water quality measure is returned, so no storage or treatment effect can be derived.',
        }),
        buildLine({
          id: 'green-spaces',
          tableKey: 'sasa_50_percent_green_spaces_api',
          label: 'Green spaces created',
          unit: 'spaces',
          grain: 'ULB',
          entityFields: ['ulb_nm', 'ulb_name'],
          targetFields: ['green_spaces_target_in_nos'],
          reportedFields: ['green_spaces_achieved'],
          boundary: 'A count of spaces with no extent. Three routes serve this one merged table; the three measures are resolved separately and never added together.',
        }),
      ],
    },
  ];
}

/*
 * ---------------------------------------------------------------------------
 * The estimate layer. Everything below is arithmetic on the ledger above.
 * ---------------------------------------------------------------------------
 */

export interface EstimateAssumption {
  id: string;
  label: string;
  value: string;
  source: string;
  note: string;
}

/**
 * Published defaults, named so that a reviewer can argue with a parameter instead of the
 * result. None of these was measured in Andhra Pradesh, and that is the point of listing
 * them: an auditor should be able to substitute a local value and see the number move.
 */
export const estimateAssumptions: EstimateAssumption[] = [
  { id: 'gwp-ch4', label: 'Methane global warming potential', value: '28 tCO2e per tonne CH4', source: 'IPCC Fifth Assessment Report, 100 year horizon', note: 'National inventory reporting uses the 100 year value. A 20 year horizon would raise every methane figure here by roughly a factor of three.' },
  { id: 'gwp-n2o', label: 'Nitrous oxide global warming potential', value: '265 tCO2e per tonne N2O', source: 'IPCC Fifth Assessment Report, 100 year horizon', note: 'Applies only to the composting process emission below.' },
  { id: 'doc', label: 'Degradable organic carbon in mixed municipal waste', value: '0.15 tonnes C per tonne of wet waste', source: 'IPCC 2006 Guidelines, Volume 5, default for mixed MSW on a wet weight basis', note: 'The single most influential parameter. A waste characterisation study for Andhra Pradesh would replace it.' },
  { id: 'docf', label: 'Fraction of that carbon which decomposes', value: '0.5', source: 'IPCC 2006 Guidelines, Volume 5 default', note: 'Carbon locked in lignin does not convert to landfill gas.' },
  { id: 'mcf', label: 'Methane correction factor for the site type', value: '0.8 central, 0.4 to 1.0 range', source: 'IPCC 2006 Guidelines, Volume 5, unmanaged deep site over five metres', note: 'The range drives the low and high estimate. A shallow site sits near 0.4; a managed anaerobic site sits at 1.0.' },
  { id: 'f', label: 'Methane fraction of generated landfill gas', value: '0.5', source: 'IPCC 2006 Guidelines, Volume 5 default', note: 'The remainder is carbon dioxide of biogenic origin, which inventories do not count.' },
  { id: 'compost-ch4', label: 'Methane released by composting itself', value: '4 g CH4 per kg of waste treated', source: 'IPCC 2006 Guidelines, Volume 5, Chapter 4, wet weight default', note: 'Composting is not emission free. This is subtracted from the avoided figure.' },
  { id: 'compost-n2o', label: 'Nitrous oxide released by composting itself', value: '0.3 g N2O per kg of waste treated', source: 'IPCC 2006 Guidelines, Volume 5, Chapter 4, wet weight default', note: 'Small in mass, large in warming potential. Also subtracted.' },
  { id: 'legacy-unit', label: 'Unit of the legacy waste quantity', value: 'assumed metric tonnes', source: 'Not declared by the source', note: 'The response labels no unit. If the figure is cubic metres, the tonnage is lower by whatever the density of the deposited mass turns out to be, and every legacy estimate moves with it.' },
  { id: 'per-capita', label: 'Municipal solid waste generated per person per day', value: '0.45 kg', source: 'Central Pollution Control Board range for Indian urban areas', note: 'Used only to turn a count of households into a tonnage, because the household sources count households, not weight.' },
  { id: 'household-size', label: 'Persons per urban household in Andhra Pradesh', value: '3.8', source: 'Census of India 2011, urban average for the state', note: 'Fifteen years old. A current figure would change the implied tonnage directly.' },
  { id: 'wet-fraction', label: 'Wet share of household waste', value: '0.52', source: 'Typical Indian urban waste characterisation', note: 'Only the wet fraction carries the methane pathway that composting avoids.' },
];

/** Source precision, not float noise: a decimal is kept only where the source carried one. */
const amount = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });

const GWP_CH4 = 28;
const GWP_N2O = 265;
const DOC = 0.15;
const DOCF = 0.5;
const MCF_CENTRAL = 0.8;
const MCF_LOW = 0.4;
const MCF_HIGH = 1.0;
const F = 0.5;
const COMPOST_CH4_G_PER_KG = 4;
const COMPOST_N2O_G_PER_KG = 0.3;
const PER_CAPITA_KG = 0.45;
const HOUSEHOLD_SIZE = 3.8;
const WET_FRACTION = 0.52;
const DAYS = 365;

/** IPCC methane generation potential: DOC x DOCf x MCF x F x 16/12, in tonnes CH4 per tonne. */
const generationPotential = (mcf: number) => DOC * DOCF * mcf * F * (16 / 12);
const landfillPerTonne = (mcf: number) => generationPotential(mcf) * GWP_CH4;
const compostProcessPerTonne = (COMPOST_CH4_G_PER_KG / 1000) * GWP_CH4 + (COMPOST_N2O_G_PER_KG / 1000) * GWP_N2O;
const avoidedPerTonne = (mcf: number) => landfillPerTonne(mcf) - compostProcessPerTonne;
/** Wet waste a reporting household is assumed to put out each day, in tonnes. */
const wetTonnesPerHouseholdDay = (PER_CAPITA_KG * HOUSEHOLD_SIZE * WET_FRACTION) / 1000;

export interface Estimate {
  id: string;
  label: string;
  /** The retained quantity this rests on, in the source's own terms. */
  physical: string;
  /** The arithmetic, written out so it can be checked by hand. */
  derivation: string;
  low: number;
  central: number;
  high: number;
  unit: 'tCO2e' | 'tCO2e per year';
  assumptions: string[];
  boundary: string;
}

export interface Unconverted {
  id: string;
  label: string;
  physical: string;
  /** The measurement that would make a conversion possible. This list is the data ask. */
  missing: string;
}

export interface CarbonEstimates {
  factors: { landfillCentral: number; landfillLow: number; landfillHigh: number; compostProcess: number; avoidedCentral: number };
  estimates: Estimate[];
  unconverted: Unconverted[];
  /** Reported segregation against the wet capacity that exists to receive it. */
  capacityBound: {
    impliedWetTonnesPerDay: number;
    completedWetTpd: number;
    configuredWetTpd: number;
    coveredShare: number | null;
    largestCompletedSite: string | null;
  };
  boundary: string;
}

export function getCarbonEstimates(): CarbonEstimates {
  const sections = getEnvironmentSections();
  const lines = sections.flatMap((section) => section.lines);
  const legacy = lines.find((line) => line.id === 'legacy-balance');
  const capacity = completedWetCapacity();
  const segregation = segregationAtSource();
  const sewage = lines.find((line) => line.id === 'sewage');
  const greenCover = lines.find((line) => line.id === 'green-cover');
  const cbg = lines.find((line) => line.id === 'cbg');

  const legacyBalance = legacy?.reported ?? 0;
  const impliedWetTonnesPerDay = segregation.segregated * wetTonnesPerHouseholdDay;
  const cappedWetTonnesPerDay = Math.min(impliedWetTonnesPerDay, capacity.completedWetTpd);

  const estimates: Estimate[] = [
    {
      id: 'legacy-liability',
      label: 'Methane potential of the legacy waste still in place',
      physical: `${legacyBalance.toLocaleString('en-IN')} reported units still carried by ${legacy?.reporting ?? 0} ULBs, ${legacy?.period ?? 'period not established'}`,
      derivation: `${legacyBalance.toLocaleString('en-IN')} t x (0.15 x 0.5 x 0.8 x 0.5 x 16/12) t CH4/t x 28 = ${Math.round(legacyBalance * landfillPerTonne(MCF_CENTRAL)).toLocaleString('en-IN')} tCO2e`,
      low: legacyBalance * landfillPerTonne(MCF_LOW),
      central: legacyBalance * landfillPerTonne(MCF_CENTRAL),
      high: legacyBalance * landfillPerTonne(MCF_HIGH),
      unit: 'tCO2e',
      assumptions: ['legacy-unit', 'doc', 'docf', 'mcf', 'f', 'gwp-ch4'],
      boundary: 'This is the gross generation potential of the mass in place, released over decades of decay. It is not an annual emission, and a dump that has sat for years has already released part of it. Read it as the size of the standing liability, not as this year\'s number.',
    },
    {
      id: 'segregation-implied',
      label: 'What reported doorstep segregation would avoid, if every tonne were composted',
      physical: `${segregation.segregated.toLocaleString('en-IN')} households reported segregating on ${segregation.day}, the one complete urban day in retention`,
      derivation: `${segregation.segregated.toLocaleString('en-IN')} households x 0.45 kg x 3.8 persons x 0.52 wet = ${Math.round(impliedWetTonnesPerDay).toLocaleString('en-IN')} t/day x 365 x ${avoidedPerTonne(MCF_CENTRAL).toFixed(2)} tCO2e/t`,
      low: impliedWetTonnesPerDay * DAYS * avoidedPerTonne(MCF_LOW),
      central: impliedWetTonnesPerDay * DAYS * avoidedPerTonne(MCF_CENTRAL),
      high: impliedWetTonnesPerDay * DAYS * avoidedPerTonne(MCF_HIGH),
      unit: 'tCO2e per year',
      assumptions: ['per-capita', 'household-size', 'wet-fraction', 'doc', 'docf', 'mcf', 'f', 'gwp-ch4', 'compost-ch4', 'compost-n2o'],
      boundary: 'Two things make this an upper bound rather than a result. One day is annualised, and this product has already shown that daily reporting is not steady enough to support that. Separating waste at the doorstep also does not establish that it was composted; the next line is what the processing evidence will carry.',
    },
    {
      id: 'capacity-bound',
      label: 'What completed wet processing capacity can actually carry',
      physical: `${amount(capacity.completedWetTpd)} TPD of wet capacity at the ${capacity.completedFacilities} facilities reported completed, ${capacity.period ?? 'period not established'}`,
      derivation: `${amount(capacity.completedWetTpd)} t/day x 365 x ${avoidedPerTonne(MCF_CENTRAL).toFixed(2)} tCO2e/t`,
      low: capacity.completedWetTpd * DAYS * avoidedPerTonne(MCF_LOW),
      central: capacity.completedWetTpd * DAYS * avoidedPerTonne(MCF_CENTRAL),
      high: capacity.completedWetTpd * DAYS * avoidedPerTonne(MCF_HIGH),
      unit: 'tCO2e per year',
      assumptions: ['doc', 'docf', 'mcf', 'f', 'gwp-ch4', 'compost-ch4', 'compost-n2o'],
      boundary: `This is the defensible ceiling of the three, and it still assumes every completed facility runs at its configured wet capacity every day of the year, which no source in this catalogue reports. ${capacity.largest ? `${capacity.largest} alone holds the largest share of that capacity, so the figure depends heavily on one site.` : ''}`,
    },
  ];

  const unconverted: Unconverted[] = [
    {
      id: 'legacy-cleared',
      label: 'Legacy waste already cleared',
      physical: `${amount((legacy?.target ?? 0) - legacyBalance)} reported units remediated`,
      missing: 'Where the excavated fractions went. Removing mass from an unmanaged site avoids that pathway only if the organic fraction was processed rather than relanded; without a destination, no avoided figure can be claimed for work already done.',
    },
    {
      id: 'cbg-fuel',
      label: 'Compressed biogas displacing fossil fuel',
      physical: `${amount(cbg?.reported ?? 0)} TPD contracted, none reported operating`,
      missing: 'A commissioning date and gas yield. Fuel displacement is a second, additional benefit beyond avoided landfill methane, and it needs output data that no route returns.',
    },
    {
      id: 'sewage-load',
      label: 'Sewage treated instead of discharged',
      physical: `${amount(sewage?.reported ?? 0)} MLD in the programme, none reported operating`,
      missing: 'Organic load per volume, as BOD or COD. The IPCC wastewater method needs the load, not the flow; megalitres per day alone cannot be converted.',
    },
    {
      id: 'green-cover-sink',
      label: 'Sequestration by new green cover',
      physical: `${amount(greenCover?.reported ?? 0)} km planted`,
      missing: 'Saplings per kilometre, species and survival rate at a stated age. A length of planting says nothing about biomass, and a sapling that did not survive sequesters nothing.',
    },
    {
      id: 'fleet-fuel',
      label: 'Electric collection vehicles replacing diesel',
      physical: 'Vehicles reported supplied under the ULB service model',
      missing: 'The vehicle each one replaced, distance driven and fuel or electricity consumed. A vehicle count cannot be converted without a duty cycle.',
    },
    {
      id: 'dry-recovery',
      label: 'Materials recovered from dry waste',
      physical: 'Unit and mechanism counts for plastic, e-waste and the circular economy programmes',
      missing: 'Tonnage recovered by material. Every one of these routes returns a count of units or ULBs, and recycling benefit scales with mass.',
    },
  ];

  return {
    factors: {
      landfillCentral: landfillPerTonne(MCF_CENTRAL),
      landfillLow: landfillPerTonne(MCF_LOW),
      landfillHigh: landfillPerTonne(MCF_HIGH),
      compostProcess: compostProcessPerTonne,
      avoidedCentral: avoidedPerTonne(MCF_CENTRAL),
    },
    estimates,
    unconverted,
    capacityBound: {
      impliedWetTonnesPerDay,
      completedWetTpd: capacity.completedWetTpd,
      configuredWetTpd: capacity.configuredWetTpd,
      coveredShare: impliedWetTonnesPerDay > 0 ? cappedWetTonnesPerDay / impliedWetTonnesPerDay : null,
      largestCompletedSite: capacity.largest,
    },
    boundary: 'Every figure here is a published default factor applied to a retained physical quantity, and each one names the assumptions it rests on. None of it is a certified inventory, none of it has been verified against a weighbridge, and none of it should be quoted without the assumption it depends on.',
  };
}
