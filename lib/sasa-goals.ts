import {measurement, reportedSum, latestMonthlyRows} from './measurement';
import bwg from '@/data/aggregates/bwg-reference-day.json';
import {currentSnapshots} from './current-snapshots';
import {getEnvironmentSections} from './environment-ledger';
import {serviceSnapshot} from './ulb-service';
import {formatAtlasDay, getUlbAtlas, type AtlasHeld} from './ulb-atlas';
import {sameDistrict} from './crosswalk';
import {normalizeSourceName} from './snapshots';
import {authorizedCatalogue} from './catalogue';

/**
 * Swachha Andhra Swarna Andhra's stated targets, read against the department's own retained
 * evidence. A target is quoted only from a dated public report that was read in full; the
 * reading comes from the same retained sources the other screens use. Status is derived from
 * dates and values, never chosen: a reading taken before a deadline cannot show it was missed,
 * and a reading of a different measure is labelled as one.
 */

export type GoalStatus = 'short-after-deadline' | 'met' | 'before-deadline' | 'different-measure' | 'tracked' | 'not-measured';

export interface GoalSource { publisher: string; date: string; url: string; title: string }
export interface GoalReading {
  /** 0–100 share, where the measure is a share. */
  share: number | null;
  display: string;
  detail: string;
  /** ISO date the reading describes (end of month for a monthly figure). */
  asOf: string;
  asOfLabel: string;
  dataset: string;
  /** Distance to the stated target in the target's own terms; null where the measure differs or no target is set. */
  gap?: string | null;
}
export interface SasaGoal {
  id: string;
  theme: 'Collection' | 'Segregation' | 'Legacy waste' | 'Plastic' | 'Sanitation' | 'Green cover' | 'Composting' | 'Bulk generators' | 'Cleanliness' | 'Landfill';
  target: string;
  /** ISO date, or null when no deadline was stated. */
  deadline: string | null;
  deadlineLabel: string;
  source: GoalSource;
  reading: GoalReading | null;
  status: GoalStatus;
  /** What the reading does and does not show. */
  note: string;
  /** The data that would settle the target. */
  needs: string;
  /** Where the evidence sits in this app. */
  evidence: {label: string; href: string} | null;
}

const SOURCES = {
  dec2025: {publisher: 'Deccan Chronicle', date: '21 Dec 2025', title: 'Naidu sets October 2, 2026 deadline for plastic-free Andhra Pradesh', url: 'https://www.deccanchronicle.com/southern-states/andhra-pradesh/naidu-sets-october-2-2026-deadline-for-plastic-free-andhra-pradesh-1925315'},
  apr2026: {publisher: 'Deccan Chronicle', date: '17 Apr 2026', title: 'AP CM sets ambitious Swachh targets', url: 'https://www.deccanchronicle.com/southern-states/andhra-pradesh/ap-cm-sets-ambitious-swachh-targets-visakhapatnam-leads-state-rankings-1951057'},
  may2026: {publisher: 'Deccan Chronicle', date: '21 May 2026', title: 'Operation Clean Sweep to cover 123 urban local bodies', url: 'https://www.deccanchronicle.com/southern-states/andhra-pradesh/operation-clean-sweep-to-cover-123-urban-local-bodies-across-ap-1958250'},
  sep2026: {publisher: 'ThePrint', date: '15 Sep 2026', title: 'Andhra Pradesh targets zero landfill use by 2030', url: 'https://theprint.in/india/andhra-pradesh-targets-zero-landfill-use-by-2030-bets-rs-550-cr-on-segregation-to-clear-legacy-waste/3042819/'},
  datalake: {publisher: 'AP Data Lake catalogue', date: 'retrieved 18 Nov 2026', title: 'Identification of Bulk Waste Generators as per SWM Rules 2026', url: 'https://datalakes.ailivinglabs.ap.gov.in/datasets/identification_of_bulk_waste_generators_api'},
} satisfies Record<string, GoalSource>;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const whole = (n: number) => Math.round(n).toLocaleString('en-IN');
const pct = (n: number) => `${n.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`;
const share = (part: number, of: number) => (of ? part / of * 100 : 0);
const points = (share: number) => `${(100 - share).toLocaleString('en-IN', {maximumFractionDigits: 1})} points`;

/** "July 2026" → last day of July; "12 Aug 2026" style is handled by the caller. */
function monthEnd(label: string | null): string {
  const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(label ?? '');
  if (!match) return '';
  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[1].toLowerCase());
  if (month < 0) return '';
  const end = new Date(Date.UTC(Number(match[2]), month + 1, 0));
  return end.toISOString().slice(0, 10);
}

function status(reading: GoalReading | null, deadline: string | null, kind: 'direct' | 'proxy' | 'different' | 'tracked'): GoalStatus {
  if (!reading) return 'not-measured';
  if (kind === 'different') return 'different-measure';
  if (kind === 'tracked' || !deadline) return 'tracked';
  // A nearer measure can show progress but never that the goal itself was met.
  if (kind === 'proxy') return reading.asOf < deadline ? 'before-deadline' : 'different-measure';
  if (reading.share !== null && reading.share >= 100) return 'met';
  return reading.asOf < deadline ? 'before-deadline' : 'short-after-deadline';
}

type Row = Record<string, unknown>;
const snapshot = (key: string) => currentSnapshots.find((entry) => entry.requestEcho.tableKey === key);
const recordsOf = (key: string): Row[] => (snapshot(key)?.records ?? []) as Row[];
const num = measurement;
const formatMeasurement = (value: unknown) => { const parsed = num(value); return parsed === null ? 'Not reported' : whole(parsed); };

/** District-grain target/achievement table, latest month only, summed. */
function districtTable(key: string) {
  const rows = recordsOf(key);
  const monthOf = (row: Row) => Number(row.month ?? row.month_id ?? row.mnth_no ?? 0);
  const current = latestMonthlyRows(rows);
  const latest = current.length ? monthOf(current[0]) : 0;
  return {
    rows: current.map((row) => ({district: String(row.district_name ?? ''), target: num(row.target), achievement: num(row.achievement)})),
    target: reportedSum(current.map((row) => num(row.target))),
    achievement: reportedSum(current.map((row) => num(row.achievement))),
    month: latest,
    year: current[0] ? Number(current[0].year ?? 0) : 0,
  };
}

/**
 * The current ODF Plus copy. Unlike the July full copy (district x month, 3,569 targeted), it
 * comes from a different upstream table, carries no month, and targets far more villages, so it
 * is read as its own vintage and dated by the day it was generated.
 */
function odfPlusCurrent() {
  const entry = snapshot('sasa_declaration_of_odf_plus_model_villages_api');
  const rows = (entry?.records ?? []) as Row[];
  const generated = String((entry?.responseMetadata as {generatedAt?: string} | undefined)?.generatedAt ?? '').slice(0, 10);
  return {
    target: reportedSum(rows.map((row) => num(row.odf_vlges_declaration_target_units))),
    achievement: reportedSum(rows.map((row) => num(row.odf_vlges_declaration_achvmt))),
    districts: rows.length,
    generated,
    upstream: String((entry?.responseMetadata as {upstreamTableKey?: string} | undefined)?.upstreamTableKey ?? ''),
  };
}

/** The ULBs the Atlas places on the service day: those whose collection reach is a value, not held out. */
function placedService() {
  const atlas = getUlbAtlas();
  const placed = new Set(atlas.ulbs.filter((ulb) => ulb.cells.reach?.state === 'value').map((ulb) => ulb.code));
  const held = atlas.ulbs.filter((ulb) => ulb.cells.reach?.state === 'held').map((ulb) => ({code: ulb.code, name: ulb.name, district: ulb.district, reason: (ulb.cells.reach as AtlasHeld).reason}));
  return {ulbs: serviceSnapshot.ulbs.filter((ulb) => placed.has(String(ulb.code))), held};
}

let cached: ReturnType<typeof build> | null = null;
export function getSasaGoals() { return (cached ??= build()); }

function build() {
  const lines = getEnvironmentSections().flatMap((section) => section.lines);
  const line = (id: string) => lines.find((entry) => entry.id === id)!;
  const day = serviceSnapshot.day;
  const dayLabel = formatAtlasDay(day);
  const service = placedService();
  const households = service.ulbs.reduce((sum, ulb) => sum + ulb.households, 0);
  const collected = service.ulbs.reduce((sum, ulb) => sum + ulb.collected, 0);
  const segregated = service.ulbs.reduce((sum, ulb) => sum + ulb.segregated, 0);
  const allHouseholds = serviceSnapshot.ulbs.reduce((sum, ulb) => sum + ulb.households, 0);
  const allCollected = serviceSnapshot.ulbs.reduce((sum, ulb) => sum + ulb.collected, 0);
  const heldNames = service.held.map((ulb) => ulb.name).join(', ');

  const legacy = line('legacy-balance'), cover = line('green-cover'), compost = line('home-composting'), plasticBan = line('sup-ban');
  const legacyShare = legacy.target ? share(legacy.reported ?? 0, legacy.target) : null;
  const odf = odfPlusCurrent();

  const reading = (value: Omit<GoalReading, 'asOf' | 'asOfLabel'> & {asOf?: string}, asOfLabel: string): GoalReading => ({...value, asOf: value.asOf ?? monthEnd(asOfLabel), asOfLabel});

  const goals: SasaGoal[] = [
    {
      id: 'legacy', theme: 'Legacy waste', target: 'Clear 100% of urban legacy waste', deadline: '2026-06-30', deadlineLabel: 'June 2026', source: SOURCES.apr2026,
      reading: legacyShare === null ? null : reading({share: 100 - legacyShare, display: `${pct(legacyShare)} still on the ground`, detail: `${whole(legacy.reported ?? 0)} of ${whole(legacy.target ?? 0)} source units reported as balance`, gap: `${whole(legacy.reported ?? 0)} source units still reported as balance, ${pct(legacyShare)} of the programme`, dataset: legacy.tableKey}, legacy.period ?? ''),
      status: 'not-measured',
      note: 'The source states no unit for these quantities, and its balance column does not always equal target minus cleared. A January 2026 report gave March 2026 as the date; the April review moved it to June.',
      needs: 'A dated monthly balance in declared units, with the date each dump site was certified clear.',
      evidence: {label: 'Legacy waste ledger', href: '/environment'},
    },
    {
      id: 'collection', theme: 'Collection', target: 'Household garbage collection across rural and urban areas', deadline: '2026-02-15', deadlineLabel: '15 Feb 2026', source: SOURCES.dec2025,
      reading: reading({share: share(collected, households), display: `${pct(share(collected, households))} of urban households`, detail: `${whole(collected)} of ${whole(households)} households in the ${service.ulbs.length} ULBs the Atlas places, on one reported day`, gap: `${whole(households - collected)} households not collected from, ${points(share(collected, households))} short of every household`, dataset: 'msw_door_to_door_collection_api', asOf: day}, dayLabel),
      status: 'not-measured',
      note: `One reported day, urban only. ${service.held.length} ULBs are held out because their codes need review (${heldNames}); counting every household the register reports, held-out ULBs included, gives ${pct(share(allCollected, allHouseholds))}. Rural collection is reported as panchayat-days, a different measure.`,
      needs: 'Daily collection for every secretariat and panchayat across a full month, so a sustained rate can be read.',
      evidence: {label: 'Collection by ULB', href: '/atlas'},
    },
    {
      id: 'segregation', theme: 'Segregation', target: 'Full segregation of dry and wet waste', deadline: '2026-10-02', deadlineLabel: '2 Oct 2026', source: SOURCES.dec2025,
      reading: reading({share: share(segregated, households), display: `${pct(share(segregated, households))} of urban households`, detail: `${whole(segregated)} households segregating in the same ${service.ulbs.length} ULBs, ${pct(share(segregated, collected))} of those collected from`, gap: `${whole(households - segregated)} households not segregating, ${points(share(segregated, households))} short of full segregation`, dataset: 'waste_egregation_api', asOf: day}, dayLabel),
      status: 'not-measured',
      note: 'The reading predates the deadline, so it cannot show whether the target was met. The share is of all households, since a household not collected from is not segregating into the system; the Atlas reads segregation against those collected from. The 2026 rules ask for four-stream segregation; this source records one segregated count.',
      needs: 'Segregation by stream after 2 October 2026, at the same secretariat grain.',
      evidence: {label: 'Segregation by ULB', href: '/atlas'},
    },
    {
      id: 'plastic', theme: 'Plastic', target: 'A plastic-free Andhra Pradesh', deadline: '2026-10-02', deadlineLabel: '2 Oct 2026', source: SOURCES.dec2025,
      reading: reading({share: plasticBan.target ? share(plasticBan.reported ?? 0, plasticBan.target) : null, display: `${whole(plasticBan.reported ?? 0)} of ${whole(plasticBan.target ?? 0)} ULBs`, detail: 'enforcing the single-use plastic ban, the nearest retained measure', gap: `${whole((plasticBan.target ?? 0) - (plasticBan.reported ?? 0))} of ${whole(plasticBan.target ?? 0)} ULBs not yet enforcing the ban`, dataset: plasticBan.tableKey}, plasticBan.period ?? ''),
      status: 'not-measured',
      note: 'Enforcement of a ban in a ULB is a step toward the goal, not a measure of plastic in use. The reading predates the deadline.',
      needs: 'Plastic collected and recycled by ULB, and enforcement results, after 2 October 2026.',
      evidence: {label: 'Plastic and e-waste lines', href: '/environment'},
    },
    {
      id: 'odf-plus', theme: 'Sanitation', target: 'ODF Plus status for all villages', deadline: '2026-09-30', deadlineLabel: 'September 2026', source: SOURCES.apr2026,
      reading: odf.target && odf.achievement !== null ? reading({share: share(odf.achievement, odf.target), display: `${whole(odf.achievement)} of ${whole(odf.target ?? 0)} villages`, detail: `declared ODF Plus against targets in ${odf.districts} districts; the copy carries no month`, dataset: 'sasa_declaration_of_odf_plus_model_villages_api', asOf: odf.generated}, `copy of ${formatAtlasDay(odf.generated)}`) : null,
      status: 'not-measured',
      note: `The dataset is titled for model villages, and its July copy counted 3,569 of them; the current copy comes from another upstream table (${odf.upstream || 'not named'}) and targets ${whole(odf.target ?? 0)}. Which villages each counts is not defined, so this is read as a related measure, not the goal. A January report gave March 2026; the April review moved it to September.`,
      needs: 'ODF Plus status for every village, the definition of its target, and the verification date.',
      evidence: {label: 'Rural sanitation', href: '/operational-analytics?tab=rural'},
    },
    {
      id: 'green-cover', theme: 'Green cover', target: 'Raise green cover from 31.33% to 37% of area', deadline: '2030-12-31', deadlineLabel: '2030', source: SOURCES.apr2026,
      reading: cover.target ? reading({share: share(cover.reported ?? 0, cover.target), display: `${whole(cover.reported ?? 0)} of ${whole(cover.target)} km`, detail: 'of avenue planting reported in the urban programme', dataset: cover.tableKey}, cover.period ?? '') : null,
      status: 'not-measured',
      note: 'Kilometres planted is activity, not the share of land under canopy. A satellite green-cover series would measure the goal itself; the data lake now lists AWARE green-cover feeds.',
      needs: 'Green cover as a share of area, by district, from a dated satellite series.',
      evidence: {label: 'Green assets', href: '/environment'},
    },
    {
      id: 'compost', theme: 'Composting', target: 'Compost production in 10 lakh village households', deadline: null, deadlineLabel: 'No date stated', source: SOURCES.dec2025,
      reading: compost.target ? reading({share: share(compost.reported ?? 0, compost.target), display: `${whole(compost.reported ?? 0)} households`, detail: `of ${whole(compost.target)} targeted in the urban home-composting programme`, dataset: compost.tableKey}, compost.period ?? '') : null,
      status: 'not-measured',
      note: 'The retained programme is urban (MEPMA), not village households, so it is a related measure, not the goal.',
      needs: 'Household composting in villages, by panchayat.',
      evidence: {label: 'Home composting line', href: '/environment'},
    },
    {
      id: 'bulk-generators', theme: 'Bulk generators', target: 'Bulk waste generators identified and processing wet waste on site', deadline: '2026-04-01', deadlineLabel: 'SWM Rules 2026, in force 1 Apr 2026', source: SOURCES.datalake,
      reading: reading({share: share(bwg.processingOnSite, bwg.identified), display: `${whole(bwg.processingOnSite)} of ${whole(bwg.identified)} identified`, detail: `processing wet waste on site, in the ${whole(bwg.usableSecretariats)} of ${whole(bwg.registerSecretariats)} secretariats retained for ${formatAtlasDay(bwg.day)}`, gap: `${whole(bwg.identified - bwg.processingOnSite)} identified generators not processing on site; no numeric target is set`, dataset: bwg.sources[1], asOf: bwg.day}, formatAtlasDay(bwg.day)),
      status: 'not-measured',
      note: `No numeric target was found for this. Retrieval returned ${pct(share(bwg.usableSecretariats, bwg.registerSecretariats))} of the secretariats for the day, so the totals are a partial reading; missing secretariats are not zero. ${bwg.retainedSecretariats - bwg.usableSecretariats} retained secretariats were held out because a count was not a number or its rows disagreed.`,
      needs: 'A complete secretariat pull for one day, and the rule’s compliance threshold.',
      evidence: {label: 'Bulk generator view', href: '#swm-rules'},
    },
    {
      id: 'gvp', theme: 'Cleanliness', target: 'Eliminate garbage vulnerable points', deadline: '2026-06-20', deadlineLabel: '20 Jun 2026, Operation Clean Sweep', source: SOURCES.may2026,
      reading: null, status: 'not-measured',
      note: 'The campaign reported through a centralised system with geo-tagged photographs. None of it is in the data lake.',
      needs: 'The Clean Sweep register of points, with before-and-after dates.',
      evidence: null,
    },
    {
      id: 'roads', theme: 'Cleanliness', target: 'No visible garbage on roads', deadline: '2026-01-26', deadlineLabel: '26 Jan 2026', source: SOURCES.dec2025,
      reading: null, status: 'not-measured',
      note: 'No retained source observes roads.',
      needs: 'A periodic inspection or citizen-report series by ward.',
      evidence: null,
    },
    {
      id: 'landfill', theme: 'Landfill', target: 'Zero landfill dependency for industrial clusters', deadline: '2030-12-31', deadlineLabel: '2030', source: SOURCES.sep2026,
      reading: null, status: 'not-measured',
      note: 'Industrial-cluster waste is outside the retained municipal sources. Municipal processing capacity is shown on the Environment screen as configured and reported completed, not throughput.',
      needs: 'Industrial waste by destination, and municipal processing throughput.',
      evidence: {label: 'Processing capacity', href: '/environment'},
    },
  ];

  const kinds: Record<string, 'direct' | 'proxy' | 'different' | 'tracked'> = {legacy: 'direct', collection: 'direct', segregation: 'direct', plastic: 'proxy', 'odf-plus': 'different', 'green-cover': 'different', compost: 'different', 'bulk-generators': 'tracked'};
  for (const goal of goals) goal.status = status(goal.reading, goal.deadline, kinds[goal.id] ?? 'direct');
  const districts = districtStanding(service);
  const water = line('water-bodies');
  return {goals, districts, insights: insights(goals, districts, service), themes: themes(goals, water), swm: swmView(), dataAsOf: dayLabel, heldUlbs: service.held};
}

/**
 * The pooled district figures behind the welcome and overview maps: the same rows the Goals
 * district table shows, so a district reads one number on every screen. Each row counts the
 * district's placed ULBs; a district whose ULBs are all held out stays blank with its reason.
 */
export function pooledDistrictMap(column: 'collection' | 'segregation') {
  const placed = getUlbAtlas().ulbs.filter((ulb) => ulb.cells.reach?.state === 'value');
  return getSasaGoals().districts.rows.map((row) => ({
    district: row.district,
    value: row[column].value,
    detail: row[column].detail,
    ulbs: placed.filter((ulb) => ulb.district === row.district).length,
  }));
}

export interface DistrictCell { value: number | null; detail: string }
export interface DistrictGoalRow {
  district: string;
  collection: DistrictCell;
  segregation: DistrictCell;
  legacyOutstanding: DistrictCell;
  plasticBan: DistrictCell;
  bulkOnSite: DistrictCell;
}
export type DistrictColumn = Exclude<keyof DistrictGoalRow, 'district'>;
export interface DistrictColumnSpec { id: DistrictColumn; label: string; short: string; period: string; better: 'higher' | 'lower'; source: string; method: string }

/**
 * District standing on the measurable goals. Each column keeps its own source and period. A
 * district joins a source by code, by its exact label, or, where the label differs only in
 * spelling, by the single register district it resembles; a respelled join is listed, and a
 * label that resembles none, or more than one, is left blank rather than guessed.
 */
function districtStanding(service: ReturnType<typeof placedService>) {
  const names = [...new Set(serviceSnapshot.ulbs.map((ulb) => ulb.district))].sort((a, b) => a.localeCompare(b));
  const key = (name: string) => normalizeSourceName(name).replace(/[^a-z]/g, '');
  const registerKeys = new Map(names.map((name) => [key(name), name]));
  const respelled: Array<{source: string; register: string; column: string}> = [];
  const unmatched: Array<{source: string; column: string}> = [];
  /** Source district label → register district, or null. */
  const join = (label: string, column: string): string | null => {
    const exact = registerKeys.get(key(label));
    if (exact) return exact;
    const candidates = names.filter((name) => sameDistrict(label, name));
    if (candidates.length === 1) { respelled.push({source: label.trim(), register: candidates[0], column}); return candidates[0]; }
    unmatched.push({source: label.trim(), column});
    return null;
  };

  const legacyRows = recordsOf('sasa_100_percent_clearance_of_legacy_waste_api');
  const latestLegacy = latestMonthlyRows(legacyRows);
  const legacyMonth = latestLegacy[0];
  const legacyLatest = Number(legacyMonth?.month_id ?? 0);
  const legacyPeriod = legacyMonth ? `${MONTHS[legacyLatest - 1]} ${legacyMonth.year ?? ''}`.trim() : '';
  const legacyBy = new Map<string, {target: number; balance: number; ulbs: number; invalid: boolean}>();
  const legacyLabels = new Map<string, string>();
  for (const row of latestLegacy) {
    const label = String(row.district_name ?? '').replace(/"/g, '').trim();
    if (!legacyLabels.has(label)) legacyLabels.set(label, join(label, 'Legacy waste') ?? '');
    const district = legacyLabels.get(label);
    if (!district) continue;
    const entry = legacyBy.get(district) ?? {target: 0, balance: 0, ulbs: 0, invalid: false};
    const target = num(row.target), balance = num(row.balance);
    if (target === null || balance === null) entry.invalid = true;
    else { entry.target += target; entry.balance += balance; entry.ulbs += 1; }
    legacyBy.set(district, entry);
  }

  const ban = districtTable('sasa_cdma_ulbs_single_use_plastic_ban_api');
  const banPeriod = ban.month ? `${MONTHS[ban.month - 1]} ${ban.year || ''}`.trim() : '';
  const banBy = new Map<string, {target: number; achievement: number; invalid: boolean}>();
  for (const row of ban.rows) {
    const district = join(row.district, 'Plastic ban');
    if (!district) continue;
    const entry = banBy.get(district) ?? {target: 0, achievement: 0, invalid: false};
    if (row.target === null || row.achievement === null) entry.invalid = true;
    else { entry.target += row.target; entry.achievement += row.achievement; }
    banBy.set(district, entry);
  }

  // Bulk generators join on the urban body code: the source's own district code is "NULL" on some rows.
  const bulkByUlb = new Map(bwg.byUlbCode.map((entry) => [entry.ulbCode, entry]));
  const placedCodes = new Set(service.ulbs.map((ulb) => String(ulb.code)));
  const day = formatAtlasDay(serviceSnapshot.day);

  const rows = names.map<DistrictGoalRow>((district) => {
    const all = serviceSnapshot.ulbs.filter((ulb) => ulb.district === district);
    const placed = all.filter((ulb) => placedCodes.has(String(ulb.code)));
    const held = service.held.filter((ulb) => ulb.district === district);
    const households = placed.reduce((sum, ulb) => sum + ulb.households, 0);
    const heldNote = held.length ? ` · ${held.map((ulb) => ulb.name).join(', ')} held out` : '';
    const placedNote = `${placed.length} of ${all.length} ULB${all.length === 1 ? '' : 's'} placed${heldNote}`;
    const noneNote = held.length ? `${held.map((ulb) => `${ulb.name}: ${ulb.reason}`).join('; ')}` : 'No ULB reports this measure.';
    const collectedHere = placed.reduce((sum, ulb) => sum + ulb.collected, 0);
    const segregatedHere = placed.reduce((sum, ulb) => sum + ulb.segregated, 0);
    const bulkRows = all.map((ulb) => bulkByUlb.get(String(ulb.code))).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const bulk = bulkRows.length ? {identified: bulkRows.reduce((sum, entry) => sum + entry.identified, 0), processingOnSite: bulkRows.reduce((sum, entry) => sum + entry.processingOnSite, 0), secretariats: bulkRows.reduce((sum, entry) => sum + entry.secretariats, 0)} : undefined;
    const secretariats = all.reduce((sum, ulb) => sum + ulb.secretariats, 0);
    const legacy = legacyBy.get(district), banned = banBy.get(district);
    return {
      district,
      collection: households ? {value: share(collectedHere, households), detail: `${whole(collectedHere)} of ${whole(households)} households · ${placedNote} · ${day}`} : {value: null, detail: noneNote},
      segregation: households ? {value: share(segregatedHere, households), detail: `${whole(segregatedHere)} of ${whole(households)} households · ${placedNote} · ${day}`} : {value: null, detail: noneNote},
      legacyOutstanding: legacy && !legacy.invalid && legacy.target ? {value: share(legacy.balance, legacy.target), detail: `${whole(legacy.balance)} of ${whole(legacy.target)} source units reported as balance · ${legacyPeriod}`} : {value: null, detail: legacy?.invalid ? 'Held out: a target or balance is missing or invalid.' : legacy ? 'No legacy target reported.' : 'The source’s district label did not join this district.'},
      plasticBan: banned && !banned.invalid && banned.target ? {value: share(banned.achievement, banned.target), detail: `${whole(banned.achievement)} of ${whole(banned.target)} ULBs enforcing · ${banPeriod}`} : {value: null, detail: banned?.invalid ? 'Held out: a target or achievement is missing or invalid.' : banned ? 'No ULB targeted.' : 'The source’s district label did not join this district.'},
      bulkOnSite: bulk && bulk.identified ? {value: share(bulk.processingOnSite, bulk.identified), detail: `${whole(bulk.processingOnSite)} of ${whole(bulk.identified)} identified · ${whole(bulk.secretariats)} of ${whole(secretariats)} secretariats retained · ${formatAtlasDay(bwg.day)}`} : {value: null, detail: bulk ? 'No bulk generator identified in the retained secretariats.' : `Retrieval returned no secretariat in this district for ${formatAtlasDay(bwg.day)}.`},
    };
  });

  const columns: DistrictColumnSpec[] = [
    {id: 'collection', label: 'Households collected from', short: 'Collection', period: day, better: 'higher', source: 'msw_door_to_door_collection_api',
      method: 'Households collected from, divided by households in the register, summed over the district’s ULBs that the Atlas places, on one reported day. A ULB held out for code review is left out, never counted as zero.'},
    {id: 'segregation', label: 'Households segregating', short: 'Segregation', period: day, better: 'higher', source: 'waste_egregation_api',
      method: 'Households reported segregating, divided by households in the register, over the same ULBs and day as collection.'},
    {id: 'legacyOutstanding', label: 'Legacy waste still on the ground', short: 'Legacy left', period: legacyPeriod, better: 'lower', source: 'sasa_100_percent_clearance_of_legacy_waste_api',
      method: 'Reported balance divided by target, summed over the district’s ULB rows for the latest month. The source declares no unit. Lower is further along.'},
    {id: 'plasticBan', label: 'ULBs enforcing the plastic ban', short: 'Plastic ban', period: banPeriod, better: 'higher', source: 'sasa_cdma_ulbs_single_use_plastic_ban_api',
      method: 'ULBs reported enforcing the single-use plastic ban, divided by ULBs targeted, as the source reports them for the district in the latest month.'},
    {id: 'bulkOnSite', label: 'Bulk generators processing on site', short: 'Bulk on site', period: `${formatAtlasDay(bwg.day)}, partial`, better: 'higher', source: `${bwg.sources[0]} + ${bwg.sources[1]}`,
      method: 'Bulk waste generators processing wet waste on site, divided by generators identified, summed over the secretariats retrieval returned for the day and joined to the district by urban body code. Missing secretariats are not zero.'},
  ];
  return {rows, columns, respelled, unmatched, legacyLabels, legacyLatest, legacyPeriod, banPeriod, banLatest: ban.month};
}

/** One figure in a sentence, traced to the dataset, period and rows it was computed from. */
export interface Citation {
  figure: string;
  dataset: string;
  name: string;
  period: string;
  retrieved: string;
  href: string;
  /** How the figure is assembled from the rows. */
  basis: string;
  rows?: {columns: string[]; values: string[][]};
}
export interface GoalInsight { id: string; text: string; goalId: string; citations: Citation[] }

const datasetName = (key: string) => authorizedCatalogue.find((entry) => entry.tableKey === key)?.catalogueName ?? key;
const lakeLink = (key: string) => `https://datalakes.ailivinglabs.ap.gov.in/datasets/${key}`;
const retrievedOf = (key: string) => formatAtlasDay(String((snapshot(key)?.responseMetadata as {generatedAt?: string} | undefined)?.generatedAt ?? '').slice(0, 10));
const cite = (key: string, value: Omit<Citation, 'dataset' | 'name' | 'href' | 'retrieved'> & {retrieved?: string}): Citation =>
  ({...value, dataset: key, name: datasetName(key), href: lakeLink(key), retrieved: value.retrieved ?? retrievedOf(key)});

/**
 * Up to three sentences, each computed from a goal reading and its district spread, and each
 * figure in them carried with the rows it came from. No sentence is written by hand.
 */
function insights(goals: SasaGoal[], districts: ReturnType<typeof districtStanding>, service: ReturnType<typeof placedService>): GoalInsight[] {
  const out: GoalInsight[] = [];
  const goal = (id: string) => goals.find((entry) => entry.id === id)!;
  const spread = (column: DistrictColumn) => {
    const rows = districts.rows.filter((row) => row[column].value !== null).sort((a, b) => a[column].value! - b[column].value!);
    return rows.length > 1 ? {low: rows[0], high: rows.at(-1)!, count: rows.length} : null;
  };

  const legacy = goal('legacy');
  if (legacy.reading && legacy.status === 'short-after-deadline') {
    const worst = spread('legacyOutstanding');
    const key = 'sasa_100_percent_clearance_of_legacy_waste_api';
    const month = latestMonthlyRows(recordsOf(key));
    const label = (row: Row) => String(row.district_name ?? '').replace(/"/g, '').trim();
    const ofDistrict = worst ? month.filter((row) => districts.legacyLabels.get(label(row)) === worst.high.district) : [];
    const figure = legacy.reading.display.replace(' still on the ground', '');
    out.push({id: 'legacy', goalId: 'legacy',
      text: `${figure} of urban legacy waste was still reported on the ground in ${legacy.reading.asOfLabel}, after the ${legacy.deadlineLabel} deadline${worst ? `. ${worst.high.district} had the highest remaining share among matched districts, ${pct(worst.high.legacyOutstanding.value!)} of its own target` : ''}.`,
      citations: [
        cite(key, {figure, period: districts.legacyPeriod, basis: `Reported balance over target, summed across all ${month.length} ULB rows for the month.`}),
        ...(worst ? [cite(key, {figure: pct(worst.high.legacyOutstanding.value!), period: districts.legacyPeriod, basis: `Balance over target for the ${ofDistrict.length} ${worst.high.district} ULB rows.`,
          rows: {columns: ['ULB', 'Target', 'Balance'], values: ofDistrict.map((row) => [String(row.ulb_name ?? '').trim(), formatMeasurement(row.target), formatMeasurement(row.balance)])}})] : []),
      ]});
  }

  const collection = goal('collection');
  if (collection.reading) {
    const range = spread('collection');
    const key = 'msw_door_to_door_collection_api';
    const reference = (serviceSnapshot as {generatedFrom?: Record<string, {referenceDay?: {generatedAt?: string}}>}).generatedFrom?.[key]?.referenceDay?.generatedAt;
    const retrieved = reference ? formatAtlasDay(reference.slice(0, 10)) : '';
    const placed = new Set(service.ulbs.map((ulb) => String(ulb.code)));
    const ulbRows = (district: string) => serviceSnapshot.ulbs.filter((ulb) => ulb.district === district).map((ulb) => [ulb.name, whole(ulb.households), whole(ulb.collected), placed.has(String(ulb.code)) ? pct(share(ulb.collected, ulb.households)) : 'held out']);
    const columns = ['ULB', 'Households', 'Collected from', 'Share'];
    out.push({id: 'collection', goalId: 'collection',
      text: `On ${collection.reading.asOfLabel}, ${pct(collection.reading.share ?? 0)} of urban households in the placed ULBs were collected from${range ? `, from ${pct(range.low.collection.value!)} in ${range.low.district} to ${pct(range.high.collection.value!)} in ${range.high.district}` : ''}.`,
      citations: [
        cite(key, {figure: pct(collection.reading.share ?? 0), period: collection.reading.asOfLabel, retrieved, basis: `Households collected from over households, summed across the ${service.ulbs.length} placed ULBs; ${service.held.length} held out for code review.`}),
        ...(range ? [range.low, range.high].map((row) => cite(key, {figure: pct(row.collection.value!), period: collection.reading!.asOfLabel, retrieved, basis: `${row.district}: the district’s placed ULBs pooled.`, rows: {columns, values: ulbRows(row.district)}})) : []),
      ]});
  }

  const plastic = goal('plastic');
  if (plastic.reading && plastic.status === 'before-deadline') {
    const key = 'sasa_cdma_ulbs_single_use_plastic_ban_api';
    const month = latestMonthlyRows(recordsOf(key));
    out.push({id: 'plastic', goalId: 'plastic',
      text: `${plastic.reading.display} were enforcing the single-use plastic ban in ${plastic.reading.asOfLabel}, before the ${plastic.deadlineLabel} goal; enforcement is the nearest retained measure of it.`,
      citations: [cite(key, {figure: plastic.reading.display, period: districts.banPeriod, basis: `Achievement over target, summed across ${month.length} district rows; districts with none enforcing are not listed.`,
        rows: {columns: ['District', 'ULBs enforcing', 'ULBs targeted'], values: month.filter((row) => (num(row.achievement) ?? -1) > 0).map((row) => [String(row.district_name ?? ''), formatMeasurement(row.achievement), formatMeasurement(row.target)])}})]});
  }
  return out.slice(0, 3);
}

export interface SwmDistrict { district: string; identified: number; onSite: number; secretariats: number; registerSecretariats: number }
export interface SwmUlb { code: string; name: string; district: string; identified: number; onSite: number }

/**
 * Bulk waste generators under the Solid Waste Management Rules 2026, from the two retained
 * secretariat feeds, joined to districts by urban body code. On-site processing is one way a
 * generator can meet the rules; the feeds record no other, so none of this reads as compliance.
 */
function swmView() {
  const byUlb = new Map(bwg.byUlbCode.map((entry) => [entry.ulbCode, entry]));
  const ulbs: SwmUlb[] = serviceSnapshot.ulbs.flatMap((ulb) => {
    const entry = byUlb.get(String(ulb.code));
    return entry ? [{code: String(ulb.code), name: ulb.name, district: ulb.district, identified: entry.identified, onSite: entry.processingOnSite}] : [];
  });
  const names = [...new Set(serviceSnapshot.ulbs.map((ulb) => ulb.district))];
  const districts: SwmDistrict[] = names.map((district) => {
    const inDistrict = serviceSnapshot.ulbs.filter((ulb) => ulb.district === district);
    const rows = inDistrict.map((ulb) => byUlb.get(String(ulb.code))).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    return {district, identified: rows.reduce((sum, entry) => sum + entry.identified, 0), onSite: rows.reduce((sum, entry) => sum + entry.processingOnSite, 0),
      secretariats: rows.reduce((sum, entry) => sum + entry.secretariats, 0), registerSecretariats: inDistrict.reduce((sum, ulb) => sum + ulb.secretariats, 0)};
  }).sort((a, b) => b.identified - a.identified || a.district.localeCompare(b.district));
  const withIdentified = ulbs.filter((ulb) => ulb.identified > 0);
  const noneOnSite = withIdentified.filter((ulb) => ulb.onSite === 0).sort((a, b) => b.identified - a.identified || a.name.localeCompare(b.name));
  return {
    day: formatAtlasDay(bwg.day),
    identified: bwg.identified,
    onSite: bwg.processingOnSite,
    secretariats: bwg.usableSecretariats,
    registerSecretariats: bwg.registerSecretariats,
    ulbsRetained: ulbs.length,
    ulbsInRegister: serviceSnapshot.ulbs.length,
    districts,
    withIdentified: withIdentified.length,
    noneOnSite: noneOnSite.length,
    firstLook: noneOnSite.slice(0, 5),
    sources: bwg.sources.map((key) => ({key, name: datasetName(key), href: lakeLink(key)})),
    retrieved: formatAtlasDay(String(Object.values(bwg.generatedFrom ?? {})[0]?.generatedAt ?? '').slice(0, 10)),
  };
}

export interface SwachhaDayTheme { month: string; date: string; theme: string; meaning: string; venue: string; source: {publisher: string; url: string}; lens: {label: string; display: string; period: string; goalId: string | null; href: string} }

/**
 * Swachha Andhra Day themes found in a dated public circular, with the retained measure that
 * speaks to each. The measure describes the programme around the theme; it does not show the
 * day's effect.
 */
function themes(goals: SasaGoal[], water: {reported: number | null; target: number | null; period: string | null}): SwachhaDayTheme[] {
  const goal = (id: string) => goals.find((entry) => entry.id === id)!;
  const collection = goal('collection'), bulk = goal('bulk-generators');
  return [
    {month: 'February 2026', date: '2026-02-21', theme: 'Zero Litter Governance', meaning: 'clean public spaces, litter-free roads', venue: 'Vinukonda, Palnadu', source: {publisher: 'Circular, reposted by gsrmaths.in', url: 'https://www.gsrmaths.in/2026/02/swarna-andhra-swachha-andhra-day-february-2026-instructions-activities.html'},
      lens: {label: 'Households collected from', display: collection.reading ? pct(collection.reading.share ?? 0) : 'not measured', period: collection.reading?.asOfLabel ?? '', goalId: 'collection', href: '#goal-collection'}},
    {month: 'March 2026', date: '2026-03-28', theme: 'Zero Waste Institutions', meaning: 'offices, schools and campuses processing their own waste', venue: 'Chirala, Bapatla', source: {publisher: 'Circular, reposted by apbadi.net', url: 'https://www.apbadi.net/2026/03/swarna-andhra-swachha-andhra-day-march-2026.html'},
      lens: {label: 'Bulk generators processing on site', display: bulk.reading ? bulk.reading.display.replace(' identified', '') : 'not measured', period: bulk.reading ? `${bulk.reading.asOfLabel}, partial` : '', goalId: null, href: '#swm-rules'}},
    {month: 'April 2026', date: '2026-04-18', theme: 'Jalam – Jeevam', meaning: 'water conservation and reuse of treated water', venue: 'Nidadavole, East Godavari', source: {publisher: 'Circular, reposted by gsrmaths.in', url: 'https://www.gsrmaths.in/2026/04/swarna-andhra-swachha-andhra-day-april-2026-instructions-activities.html'},
      lens: {label: 'Water bodies rejuvenated', display: water.target ? `${whole(water.reported ?? 0)} of ${whole(water.target)}` : 'not measured', period: water.period ?? '', goalId: null, href: '/environment'}},
  ];
}

/** Short names for the timeline and the district table. */
export const goalShort: Record<string, string> = {legacy: 'Legacy waste', collection: 'Collection', segregation: 'Segregation', plastic: 'Plastic-free', 'odf-plus': 'ODF Plus', 'green-cover': 'Green cover', compost: 'Village compost', 'bulk-generators': 'Bulk generators', gvp: 'Garbage points', roads: 'Clean roads', landfill: 'Industrial landfill'};

export const statusLabel: Record<GoalStatus, string> = {
  'short-after-deadline': 'Below target after its date',
  met: 'Met',
  'before-deadline': 'Read before its date',
  'different-measure': 'Nearest measure differs',
  tracked: 'Tracked, no target',
  'not-measured': 'No retained measure',
};

/**
 * When the Data Lake was last checked for newer months of these measures, and what the check
 * found. Kept apart from the reading dates and the retention dates, which say other things.
 */
export const LAST_SOURCE_CHECK = {
  date: '18 Nov 2026',
  found: 'no newer month for collection, segregation, the plastic ban, legacy waste, toilets or sewage plants',
  record: 'audits/2026-11-18-catalogue-audit.md',
};

export function goalSummary(goals: SasaGoal[]) {
  const count = (state: GoalStatus) => goals.filter((goal) => goal.status === state).length;
  return {
    total: goals.length,
    measured: goals.filter((goal) => goal.reading).length,
    shortAfterDeadline: count('short-after-deadline'),
    beforeDeadline: count('before-deadline'),
    differentMeasure: count('different-measure'),
    notMeasured: count('not-measured'),
    met: count('met'),
    tracked: count('tracked'),
  };
}
