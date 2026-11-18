import {getRankingDefinition, rankPrecision, rankSubject, type RankingInput} from './subject-rankings';
import {serviceSnapshot} from './ulb-service';
import {governedSnapshotByKey, governedSnapshots, normalizeSourceName, type SnapshotRecord} from './snapshots';
import {urbanBodyCode} from './urban-body-code';

/**
 * The cross-programme ULB atlas.
 *
 * Every measure here joins a ULB on the urban body code its own source supplies, never on a
 * name. That is what makes it safe to line programmes up side by side: a spelling that
 * differs between two sources cannot split one ULB in two, and a name two places share
 * cannot merge them. A source row without the code stays out and is counted, not guessed.
 *
 * Measures are kept separate. Each is positioned only against the ULBs that report that
 * same measure, from the same source and period. Nothing here adds measures together.
 */

export type AtlasMeasureId = 'reach' | 'segregation' | 'toilets' | 'fstp' | 'stp' | 'odf' | 'gfc' | 'rank';
export type AtlasKind = 'rate' | 'progress' | 'level' | 'rank';
export type AtlasFamily = 'Service day' | 'Delivery' | 'Treatment works' | 'Survey outcomes, 2024';

export interface AtlasMeasure {
  id: AtlasMeasureId;
  label: string;
  short: string;
  /** What the number reads, in the reader's words. */
  reads: string;
  kind: AtlasKind;
  family: AtlasFamily;
  period: string;
  source: string;
  /** For a level measure: the labels from the earliest stage to the furthest. */
  levels?: string[];
  /** What the measure does not establish. */
  boundary: string;
  /** Name of the shortfall this measure can express in units, when it can. */
  gapLabel?: string;
  reporting: number;
  held: number;
  /** Distinct source names whose rows carry no urban body code and so could not be placed. */
  uncoded: number;
  /** Of those, how many repeat the district, name and figures of a row that does carry the code. */
  uncodedRepeats: number;
  median: number | null;
}

export interface AtlasValue {
  state: 'value';
  value: number;
  display: string;
  /** Mid-rank position among the ULBs reporting this measure, 0 to 1, oriented so a larger position is further along. Sort key only. */
  position: number;
  /** Reporting ULBs this one is strictly further along than. */
  ahead: number;
  /** Other reporting ULBs with exactly the same value. */
  tied: number;
  /** ULBs reporting this measure, this one included. */
  of: number;
  /** Colour step 0 to 4 on the measure's own scale (fifths of 0–100% for a rate, the stage for a level). */
  step: Step;
  gap?: number;
  /** Units done and units in the denominator, where the measure has them. */
  count?: {done: number; of: number};
  detail?: string;
}
export type Step = 0 | 1 | 2 | 3 | 4;
export interface AtlasHeld { state: 'held'; reason: string }
/** `null` means the source returned no row carrying this ULB's code. */
export type AtlasEntry = AtlasValue | AtlasHeld | null;

export interface AtlasUlb {
  code: string;
  name: string;
  district: string;
  households: number;
  cells: Record<AtlasMeasureId, AtlasEntry>;
  /** Measures with a usable value. */
  placed: number;
  /** Distinct spellings of this ULB across every joined source, the register's own first. */
  spellings: string[];
}

export interface AtlasDistrict {
  district: string;
  /** The LGD district code every ULB in this district carries in the register, when they agree. */
  code: string | null;
  /** The LGD name for that code, read from retained rows that carry both; null when none does. */
  lgdName: string | null;
  ulbs: number;
  medians: Record<AtlasMeasureId, {value: number; reporting: number; step: Step; display: string} | null>;
}

export interface AtlasModel {
  measures: AtlasMeasure[];
  ulbs: AtlasUlb[];
  districts: AtlasDistrict[];
  stats: {
    ulbs: number;
    measures: number;
    sources: number;
    cells: number;
    placed: number;
    held: number;
    unreported: number;
    /** ULBs whose sources spell them more than one way, joined anyway because the code agrees. */
    respelled: number;
    /** ULBs with a usable value on every measure. */
    complete: number;
  };
}

type Raw = {state: 'value'; value: number; display: string; gap?: number; count?: {done: number; of: number}; detail?: string; spellings: string[]} | {state: 'held'; reason: string; spellings: string[]};

const SURVEY = 'swacch_survekshan_info_new1_api';
const FSTP = 'fstps_stps_cotreatment_new1_api';
const SEWAGE = 'sewage_treated_qty_new1_api';
const ODF_LEVELS = ['ODF', 'ODF+', 'ODF++', 'Water+'];
const GFC_LEVELS = ['No Star', '1 Star', '3 Star', '5 Star', '7 Star'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const whole = (value: number) => Math.round(value).toLocaleString('en-IN');
const percent = (value: number) => `${value.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`;
/** Source text fields arrive wrapped in literal quotes, e.g. "\"To be Grounded\"". */
const unquote = (value: unknown) => String(value ?? '').trim().replace(/^"+|"+$/g, '').trim();
const spellingOf = (record: SnapshotRecord) => unquote(record.ulb_nm ?? record.ulb_name);

export function formatAtlasDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1].slice(0, 3)} ${match[1]}`;
}

function records(tableKey: string): SnapshotRecord[] {
  const snapshot = governedSnapshotByKey.get(tableKey);
  if (!snapshot) throw new Error(`The atlas needs the retained ${tableKey} snapshot`);
  return snapshot.records;
}

/**
 * Group a source's rows by the urban body code each one declares. Rows without one are counted,
 * along with how many of them repeat a coded row exactly (same district, name and figures), so a
 * response that lists a ULB twice under two code systems is not reported as a gap it is not.
 */
function byCode(rows: SnapshotRecord[], figures: string[]) {
  const grouped = new Map<string, SnapshotRecord[]>();
  const uncodedRows: SnapshotRecord[] = [];
  const signature = (row: SnapshotRecord) => [normalizeSourceName(row.dstrt_nm ?? row.district_name), normalizeSourceName(spellingOf(row)), ...figures.map((field) => unquote(row[field]))].join('|');
  for (const row of rows) {
    const code = urbanBodyCode(row);
    if (!code) { uncodedRows.push(row); continue; }
    grouped.set(code, [...(grouped.get(code) ?? []), row]);
  }
  const codedSignatures = new Set([...grouped.values()].flat().map(signature));
  const names = new Map<string, boolean>();
  for (const row of uncodedRows) {
    const name = normalizeSourceName(spellingOf(row));
    if (!name) continue;
    names.set(name, (names.get(name) ?? false) || codedSignatures.has(signature(row)));
  }
  return {grouped, uncoded: names.size, uncodedRepeats: [...names.values()].filter(Boolean).length};
}

/** Delivery rates come from the governed ranking definitions, so the atlas and the rankings agree on every exclusion. */
function fromRanking(id: 'reach' | 'segregation' | 'toilets') {
  const definition = getRankingDefinition(id);
  const cohort = rankSubject(definition.inputs);
  const ranked = new Map(cohort.rows.map((row) => [row.key, row]));
  const excluded = new Map(cohort.excluded.map((row) => [row.key, row]));
  const grouped = new Map<string, RankingInput[]>();
  let uncoded = 0;
  for (const input of definition.inputs) {
    const code = input.identity?.startsWith('urban:') ? input.identity.slice('urban:'.length) : null;
    if (!code) { uncoded += 1; continue; }
    grouped.set(code, [...(grouped.get(code) ?? []), input]);
  }
  const out = new Map<string, Raw>();
  for (const [code, inputs] of grouped) {
    const spellings = inputs.map((input) => input.name);
    const pairs = new Set(inputs.map((input) => `${input.top}|${input.bottom}`));
    if (pairs.size > 1) {
      out.set(code, {state: 'held', reason: `${inputs.length} source rows carry this code with different figures`, spellings});
      continue;
    }
    const first = inputs[0];
    const row = ranked.get(first.key);
    if (row) {
      out.set(code, {state: 'value', value: row.rate, display: percent(row.rate), gap: row.bottom! - row.top!, count: {done: row.top!, of: row.bottom!}, detail: `${whole(row.top!)} of ${whole(row.bottom!)}`, spellings});
    } else {
      out.set(code, {state: 'held', reason: excluded.get(first.key)?.reasons.join('; ') ?? 'Not rankable', spellings});
    }
  }
  return {values: out, uncoded, uncodedRepeats: 0, period: definition.period};
}

function fstpProgress() {
  const {grouped, uncoded, uncodedRepeats} = byCode(records(FSTP), ['overall_progress', 'capacity_in_kld']);
  const out = new Map<string, Raw>();
  for (const [code, rows] of grouped) {
    const spellings = rows.map(spellingOf);
    const progress = new Set(rows.map((row) => Number(unquote(row.overall_progress).replace('%', ''))));
    const [value] = [...progress];
    if (progress.size !== 1 || !Number.isFinite(value) || value < 0 || value > 100) {
      out.set(code, {state: 'held', reason: progress.size > 1 ? 'The retained copies report different progress and their month cannot be established' : 'Progress missing or outside 0–100%', spellings});
      continue;
    }
    const capacity = Number(unquote(rows[0].capacity_in_kld));
    out.set(code, {state: 'value', value, display: percent(value), detail: Number.isFinite(capacity) ? `${capacity.toLocaleString('en-IN')} KLD configured` : undefined, spellings});
  }
  return {values: out, uncoded, uncodedRepeats};
}

function sewagePlants() {
  const rows = records(SEWAGE);
  const latest = Math.max(...rows.map((row) => Number(row.mnth_no)).filter(Number.isFinite));
  const month = rows.filter((row) => Number(row.mnth_no) === latest);
  const {grouped, uncoded, uncodedRepeats} = byCode(month, ['crnt_prgrs_tx', 'capacity_mld']);
  const out = new Map<string, Raw>();
  for (const [code, plants] of grouped) {
    const spellings = plants.map(spellingOf);
    const statuses = plants.map((plant) => unquote(plant.crnt_prgrs_tx));
    if (statuses.some((status) => status !== 'Work in Progress' && status !== 'To be Grounded')) {
      out.set(code, {state: 'held', reason: 'A plant carries a progress label this atlas does not recognise', spellings});
      continue;
    }
    const underWay = statuses.filter((status) => status === 'Work in Progress').length;
    const capacity = plants.reduce((sum, plant) => sum + (Number(unquote(plant.capacity_mld)) || 0), 0);
    out.set(code, {state: 'value', value: underWay / plants.length * 100, display: `${underWay} of ${plants.length} under way`, gap: plants.length - underWay, count: {done: underWay, of: plants.length},
      detail: `${capacity.toLocaleString('en-IN', {maximumFractionDigits: 1})} MLD configured across ${plants.length} plant${plants.length === 1 ? '' : 's'}`, spellings});
  }
  return {values: out, uncoded, uncodedRepeats, month: `${MONTHS[latest - 1]} ${month[0]?.year ?? ''}`.trim()};
}

function survey(kind: 'odf' | 'gfc' | 'rank') {
  const {grouped, uncoded, uncodedRepeats} = byCode(records(SURVEY), ['odf_status', 'gfc_status', 'national_rank']);
  const out = new Map<string, Raw>();
  for (const [code, rows] of grouped) {
    const spellings = rows.map(spellingOf);
    if (rows.length > 1) { out.set(code, {state: 'held', reason: `${rows.length} survey rows carry this code`, spellings}); continue; }
    const row = rows[0];
    if (kind === 'rank') {
      const rank = Number(unquote(row.national_rank));
      out.set(code, Number.isInteger(rank) && rank > 0
        ? {state: 'value', value: rank, display: `#${rank.toLocaleString('en-IN')}`, spellings}
        : {state: 'held', reason: 'No national rank returned', spellings});
      continue;
    }
    const levels = kind === 'odf' ? ODF_LEVELS : GFC_LEVELS;
    const label = unquote(kind === 'odf' ? row.odf_status : row.gfc_status);
    const index = levels.indexOf(label);
    out.set(code, index < 0 ? {state: 'held', reason: label ? `“${label}” is not a recognised status` : 'No status returned', spellings} : {state: 'value', value: index, display: label, spellings});
  }
  return {values: out, uncoded, uncodedRepeats};
}

/**
 * Where a value sits among the ULBs reporting the same measure. Ties are counted, not split:
 * fifty ULBs reporting 0% are each ahead of none, which a percentile would hide.
 */
function positioner(values: number[], largerIsFurther: boolean) {
  const oriented = values.map((value) => (largerIsFurther ? value : -value));
  return (value: number) => {
    const v = largerIsFurther ? value : -value;
    const ahead = oriented.filter((other) => rankPrecision(other) < rankPrecision(v)).length;
    const equal = oriented.filter((other) => rankPrecision(other) === rankPrecision(v)).length;
    return {ahead, tied: Math.max(0, equal - 1), of: oriented.length, position: (ahead + equal / 2) / oriented.length};
  };
}

/** Colour follows the value on its own scale, so a tie at the floor reads as the floor. */
function stepFor(kind: AtlasKind, value: number, levels: string[] | undefined, position: number): Step {
  if (kind === 'level') return Math.round(value / Math.max(1, levels!.length - 1) * 4) as Step;
  if (kind === 'rank') return Math.min(4, Math.floor(position * 5)) as Step;
  return Math.min(4, Math.max(0, Math.floor(value / 20))) as Step;
}

function median(values: number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function displayFor(measure: AtlasMeasure, value: number): string {
  if (measure.kind === 'level') return measure.levels![Math.round(value)] ?? '';
  if (measure.kind === 'rank') return `#${Math.round(value).toLocaleString('en-IN')}`;
  return percent(value);
}

/**
 * The LGD district name for each district code, read from every retained row that carries both.
 * A code that appears with more than one name is left out rather than resolved by choice.
 */
export function lgdDistrictNames(): Map<string, string> {
  const names = new Map<string, Set<string>>();
  for (const snapshot of governedSnapshots) {
    for (const row of snapshot.records) {
      const code = unquote(row.lgd_dist_code), name = unquote(row.district_name);
      if (!code || !name || code.toLowerCase() === 'null') continue;
      names.set(code, (names.get(code) ?? new Set()).add(name.toUpperCase()));
    }
  }
  return new Map([...names].filter(([, set]) => set.size === 1).map(([code, set]) => [code, [...set][0]]));
}

let cached: AtlasModel | null = null;

export function getUlbAtlas(): AtlasModel {
  if (cached) return cached;
  const reach = fromRanking('reach');
  const segregation = fromRanking('segregation');
  const toilets = fromRanking('toilets');
  const fstp = fstpProgress();
  const stp = sewagePlants();
  const odf = survey('odf');
  const gfc = survey('gfc');
  const rank = survey('rank');
  const day = formatAtlasDay(serviceSnapshot.day);

  const specs: Array<Omit<AtlasMeasure, 'reporting' | 'held' | 'median'> & {raw: Map<string, Raw>}> = [
    {id: 'reach', label: 'Collection reach', short: 'Reach', reads: 'Households collected from, as a share of all households', kind: 'rate', family: 'Service day', period: day, source: 'Paired urban collection and segregation exports',
      boundary: 'One reported day, not a typical day or a sustained service level.', gapLabel: 'households not collected from', uncoded: reach.uncoded, uncodedRepeats: reach.uncodedRepeats, raw: reach.values},
    {id: 'segregation', label: 'Segregation', short: 'Segregation', reads: 'Collected households segregating, as a share of those collected from', kind: 'rate', family: 'Service day', period: day, source: 'Paired urban collection and segregation exports',
      boundary: 'One reported day. The field is read as households, pending the department’s definition.', gapLabel: 'collected households not segregating', uncoded: segregation.uncoded, uncodedRepeats: segregation.uncodedRepeats, raw: segregation.values},
    {id: 'toilets', label: 'Toilet completion', short: 'Toilets', reads: 'Approved household toilets reported completed', kind: 'rate', family: 'Delivery', period: toilets.period, source: 'ihhl_new_identification_new1_api',
      boundary: 'Delivery against the approved number, not sanitation coverage or need. A ULB with nothing approved has no rate.', gapLabel: 'approved toilets not completed', uncoded: toilets.uncoded, uncodedRepeats: toilets.uncodedRepeats, raw: toilets.values},
    {id: 'fstp', label: 'Faecal sludge plant progress', short: 'FSTP', reads: 'Reported construction progress of the co-treatment plant', kind: 'progress', family: 'Treatment works', period: 'Month not established', source: FSTP,
      boundary: 'A construction status, not sludge received or treated. Rows numbered month 6 and month 7 are both labelled June.', uncoded: fstp.uncoded, uncodedRepeats: fstp.uncodedRepeats, raw: fstp.values},
    {id: 'stp', label: 'Sewage plants under way', short: 'STPs', reads: 'Share of the ULB’s planned sewage plants reported as work in progress rather than to be grounded', kind: 'progress', family: 'Treatment works', period: stp.month, source: SEWAGE,
      boundary: 'Planned capacity at a stated stage. No plant in this response is reported as operating, so no treated volume is read from it.', gapLabel: 'plants not yet grounded', uncoded: stp.uncoded, uncodedRepeats: stp.uncodedRepeats, raw: stp.values},
    {id: 'odf', label: 'Open-defecation-free status', short: 'ODF', reads: 'Swachh Survekshan certification level', kind: 'level', family: 'Survey outcomes, 2024', period: '2024 survey', source: SURVEY, levels: ODF_LEVELS,
      boundary: 'A 2024 certification, two years before the service measures. Context, not a result of 2026 delivery.', uncoded: odf.uncoded, uncodedRepeats: odf.uncodedRepeats, raw: odf.values},
    {id: 'gfc', label: 'Garbage-free city stars', short: 'GFC', reads: 'Swachh Survekshan garbage-free star rating', kind: 'level', family: 'Survey outcomes, 2024', period: '2024 survey', source: SURVEY, levels: GFC_LEVELS,
      boundary: 'A 2024 rating. Context, not a result of 2026 delivery.', uncoded: gfc.uncoded, uncodedRepeats: gfc.uncodedRepeats, raw: gfc.values},
    {id: 'rank', label: 'National rank', short: 'Rank', reads: 'Swachh Survekshan national rank as returned (a smaller number is a higher place)', kind: 'rank', family: 'Survey outcomes, 2024', period: '2024 survey', source: SURVEY,
      boundary: 'The response does not say which population category a rank is within, so two ranks may come from different lists.', uncoded: rank.uncoded, uncodedRepeats: rank.uncodedRepeats, raw: rank.values},
  ];

  const registry = serviceSnapshot.ulbs;
  const measures: AtlasMeasure[] = specs.map(({raw, ...spec}) => {
    const values = registry.map((ulb) => raw.get(ulb.code)).filter((entry): entry is Extract<Raw, {state: 'value'}> => entry?.state === 'value').map((entry) => entry.value);
    const held = registry.filter((ulb) => raw.get(ulb.code)?.state === 'held').length;
    return {...spec, reporting: values.length, held, median: median(values)};
  });

  const positions = new Map(specs.map((spec) => {
    const values = registry.map((ulb) => spec.raw.get(ulb.code)).filter((entry): entry is Extract<Raw, {state: 'value'}> => entry?.state === 'value').map((entry) => entry.value);
    return [spec.id, positioner(values, spec.kind !== 'rank')] as const;
  }));

  const ulbs: AtlasUlb[] = registry.map((ulb) => {
    const spellings = new Map<string, string>([[normalizeSourceName(ulb.name), ulb.name]]);
    const cells = {} as Record<AtlasMeasureId, AtlasEntry>;
    for (const spec of specs) {
      const raw = spec.raw.get(ulb.code);
      for (const spelling of raw?.spellings ?? []) if (spelling && !spellings.has(normalizeSourceName(spelling))) spellings.set(normalizeSourceName(spelling), spelling);
      if (!raw) { cells[spec.id] = null; continue; }
      if (raw.state === 'held') { cells[spec.id] = {state: 'held', reason: raw.reason}; continue; }
      const place = positions.get(spec.id)!(raw.value);
      cells[spec.id] = {state: 'value', value: raw.value, display: raw.display, ...place, step: stepFor(spec.kind, raw.value, spec.levels, place.position), gap: raw.gap, count: raw.count, detail: raw.detail};
    }
    return {code: ulb.code, name: ulb.name, district: ulb.district, households: ulb.households, cells,
      placed: Object.values(cells).filter((cell) => cell?.state === 'value').length, spellings: [...spellings.values()]};
  });

  const lgdNames = lgdDistrictNames();
  const districts = [...new Set(ulbs.map((ulb) => ulb.district))].sort((a, b) => a.localeCompare(b)).map<AtlasDistrict>((district) => {
    const members = ulbs.filter((ulb) => ulb.district === district);
    const codes = new Set(registry.filter((ulb) => ulb.district === district).map((ulb) => String(ulb.nativeDistrictCode ?? '')).filter(Boolean));
    const code = codes.size === 1 ? [...codes][0] : null;
    const medians = {} as AtlasDistrict['medians'];
    for (const measure of measures) {
      const values = members.map((ulb) => ulb.cells[measure.id]).filter((cell): cell is AtlasValue => cell?.state === 'value').map((cell) => cell.value);
      const value = median(values);
      if (value === null) { medians[measure.id] = null; continue; }
      medians[measure.id] = {value, reporting: values.length, step: stepFor(measure.kind, value, measure.levels, positions.get(measure.id)!(value).position), display: displayFor(measure, value)};
    }
    return {district, code, lgdName: code ? lgdNames.get(code) ?? null : null, ulbs: members.length, medians};
  });

  const all = ulbs.flatMap((ulb) => Object.values(ulb.cells));
  cached = {
    measures,
    ulbs,
    districts,
    stats: {
      ulbs: ulbs.length,
      measures: measures.length,
      sources: new Set(measures.map((measure) => measure.source)).size,
      cells: all.length,
      placed: all.filter((cell) => cell?.state === 'value').length,
      held: all.filter((cell) => cell?.state === 'held').length,
      unreported: all.filter((cell) => cell === null).length,
      respelled: ulbs.filter((ulb) => ulb.spellings.length > 1).length,
      complete: ulbs.filter((ulb) => ulb.placed === measures.length).length,
    },
  };
  return cached;
}

/** The ULBs carrying the largest shortfall in units on one measure: where the most households, toilets or plants are behind. */
export function largestGaps(model: AtlasModel, id: AtlasMeasureId, count = 5) {
  return model.ulbs
    .map((ulb) => ({ulb, cell: ulb.cells[id]}))
    .filter((entry): entry is {ulb: AtlasUlb; cell: AtlasValue & {gap: number}} => entry.cell?.state === 'value' && typeof entry.cell.gap === 'number' && entry.cell.gap > 0)
    .sort((a, b) => b.cell.gap - a.cell.gap || a.ulb.name.localeCompare(b.ulb.name))
    .slice(0, count);
}

/** A ULB's measures ordered from its furthest-behind position relative to peers. Each position is within one measure only. */
export function relativePositions(ulb: AtlasUlb, model: AtlasModel) {
  return model.measures
    .map((measure) => ({measure, cell: ulb.cells[measure.id]}))
    .filter((entry): entry is {measure: AtlasMeasure; cell: AtlasValue} => entry.cell?.state === 'value')
    .sort((a, b) => a.cell.position - b.cell.position || a.measure.label.localeCompare(b.measure.label));
}

/**
 * The one measure to look at first: the current (2026) measure where this ULB trails the most
 * peers, with ties counted as shared rather than as behind. A floor most ULBs share is therefore
 * not singled out, and 2024 survey context is never the first thing to act on.
 */
export function lookFirst(ulb: AtlasUlb, model: AtlasModel) {
  const order = relativePositions(ulb, model);
  return order.find((entry) => entry.measure.family !== 'Survey outcomes, 2024') ?? null;
}

const csvField = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function atlasCsv(model: AtlasModel, ulbs: AtlasUlb[] = model.ulbs): string {
  const header = ['Urban body code', 'ULB', 'District', ...model.measures.flatMap((measure) => [`${measure.label} (${measure.period})`, `${measure.short} position among ULBs reporting it`])];
  const rows = ulbs.map((ulb) => [ulb.code, ulb.name, ulb.district, ...model.measures.flatMap((measure) => {
    const cell = ulb.cells[measure.id];
    if (!cell) return ['Not reported', ''];
    if (cell.state === 'held') return [`Held out: ${cell.reason}`, ''];
    return [cell.display, `ahead of ${cell.ahead} of ${cell.of - 1} others${cell.tied ? `; ${cell.tied} report the same` : ''}`];
  })]);
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\n');
}

export interface AtlasHeadline {
  figure: number;
  decimals: number;
  suffix: string;
  /** Completes the figure as a sentence: "<figure> <sentence>". */
  sentence: string;
  tiles: Array<{label: string; value: string; sub: string}>;
}

const share = (part: number, whole_: number) => (whole_ ? part / whole_ * 100 : 0);
const count = (n: number, noun: string, plural = `${noun}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? noun : plural}`;

/** The one statewide reading each measure leads with, and the three figures that qualify it. */
export function measureHeadline(model: AtlasModel, id: AtlasMeasureId): AtlasHeadline {
  const measure = model.measures.find((entry) => entry.id === id)!;
  const cells = model.ulbs.map((ulb) => ulb.cells[id]).filter((cell): cell is AtlasValue => cell?.state === 'value');
  const held = model.ulbs.map((ulb) => ulb.cells[id]).filter((cell): cell is AtlasHeld => cell?.state === 'held');
  const done = cells.reduce((sum, cell) => sum + (cell.count?.done ?? 0), 0);
  const of = cells.reduce((sum, cell) => sum + (cell.count?.of ?? 0), 0);
  const gap = cells.reduce((sum, cell) => sum + (cell.gap ?? 0), 0);
  const med = measure.median === null ? '—' : displayFor(measure, measure.median);
  const heldTile = {label: 'Held out', value: count(held.length, 'ULB'), sub: held.length ? 'each with its reason stated' : 'none'};
  switch (id) {
    case 'reach':
    case 'segregation':
      return {figure: share(done, of), decimals: 1, suffix: '%',
        sentence: id === 'reach' ? `of households in the ${measure.reporting} reporting ULBs were collected from on ${measure.period}.` : `of households collected from in the ${measure.reporting} reporting ULBs were reported segregating on ${measure.period}.`,
        tiles: [{label: 'Median ULB', value: med, sub: 'the middle reporting ULB'}, {label: id === 'reach' ? 'Not collected from' : 'Collected, not segregating', value: whole(gap), sub: 'households, summed across ULBs'}, heldTile]};
    case 'toilets': {
      const none = cells.filter((cell) => cell.value === 0).length;
      return {figure: share(done, of), decimals: 1, suffix: '%',
        sentence: `of approved household toilets were reported completed in ${measure.period}, across the ${measure.reporting} ULBs with any approved.`,
        tiles: [{label: 'Reporting none completed', value: `${none} of ${measure.reporting}`, sub: 'ULBs with toilets approved'}, {label: 'Approved, not completed', value: whole(gap), sub: 'toilets, summed across ULBs'}, {label: 'Nothing approved', value: count(held.filter((cell) => cell.reason.includes('Zero denominator')).length, 'ULB'), sub: 'no rate to read'}]};
    }
    case 'fstp': {
      const finished = cells.filter((cell) => cell.value === 100).length;
      return {figure: finished, decimals: 0, suffix: ` of ${measure.reporting}`,
        sentence: 'faecal sludge co-treatment plants are reported at 100% construction progress. The month cannot be established.',
        tiles: [{label: 'Median progress', value: med, sub: 'the middle reporting plant'}, {label: 'Below half way', value: count(cells.filter((cell) => cell.value < 50).length, 'plant'), sub: 'under 50% progress'}, {label: 'Without the code', value: count(measure.uncoded, 'source name'), sub: 'left out, not guessed'}]};
    }
    case 'stp': {
      const idle = cells.filter((cell) => cell.count?.done === 0).length;
      return {figure: share(done, of), decimals: 0, suffix: '%',
        sentence: `of ${of} planned sewage plants across ${measure.reporting} ULBs are reported as work in progress in ${measure.period}. The rest are still to be grounded.`,
        tiles: [{label: 'ULBs with none under way', value: `${idle} of ${measure.reporting}`, sub: 'every plant still to be grounded'}, {label: 'Plants under way', value: `${done} of ${of}`, sub: 'work in progress'}, {label: 'Reported operating', value: '0', sub: 'the response has no such stage'}]};
    }
    case 'odf':
    case 'gfc': {
      const levels = measure.levels!;
      const tally = levels.map((label, index) => ({label, n: cells.filter((cell) => cell.value === index).length}));
      const above = cells.filter((cell) => cell.value >= 1).length;
      return {figure: share(above, cells.length), decimals: 0, suffix: '%',
        sentence: id === 'odf' ? `of the ${measure.reporting} ULBs placed by their code were certified ODF+ or higher in the 2024 survey.` : `of the ${measure.reporting} ULBs placed by their code held at least one garbage-free star in the 2024 survey.`,
        tiles: (id === 'odf' ? [tally[3], tally[2], tally[0]] : [{label: '3 stars or more', n: tally.slice(2).reduce((sum, entry) => sum + entry.n, 0)}, tally[1], tally[0]]).map((entry) => ({label: entry.label, value: count(entry.n, 'ULB'), sub: `of ${measure.reporting} placed`}))};
    }
    case 'rank': {
      const ranks = cells.map((cell) => cell.value);
      const top = model.ulbs.find((ulb) => ulb.cells.rank?.state === 'value' && ulb.cells.rank.value === Math.min(...ranks));
      return {figure: measure.median ?? 0, decimals: 0, suffix: '',
        sentence: `is the median national rank returned for the ${measure.reporting} ULBs placed by their code in the 2024 survey.`,
        tiles: [{label: 'Highest place', value: `#${Math.min(...ranks).toLocaleString('en-IN')}`, sub: top ? top.name : ''}, {label: 'Lowest place', value: `#${Math.max(...ranks).toLocaleString('en-IN')}`, sub: 'as returned'}, {label: 'Rank category', value: 'Not stated', sub: 'ranks may come from different lists'}]};
    }
  }
}

export interface AtlasMapRow { district: string; value: number | null; detail: string }

/**
 * What the district map shows for a measure: the median reporting ULB for a rate, or the share
 * of reporting ULBs at or past the first stage above the floor for a level. Ranks are not
 * mapped: the response does not say which list each rank is from, so a median would mix lists.
 */
export function districtMapRows(model: AtlasModel, id: AtlasMeasureId): {rows: AtlasMapRow[]; title: string} | null {
  const measure = model.measures.find((entry) => entry.id === id)!;
  if (measure.kind === 'rank') return null;
  const plural = (n: number) => `${n} reporting ULB${n === 1 ? '' : 's'}`;
  const rows = model.districts.map<AtlasMapRow>((district) => {
    const cells = model.ulbs.filter((ulb) => ulb.district === district.district).map((ulb) => ulb.cells[id]).filter((cell): cell is AtlasValue => cell?.state === 'value');
    if (!cells.length) return {district: district.district, value: null, detail: `No ULB in ${district.district} reports ${measure.label.toLowerCase()}.`};
    if (measure.kind === 'level') {
      const above = cells.filter((cell) => cell.value >= 1).length;
      return {district: district.district, value: above / cells.length * 100, detail: `${above} of ${plural(cells.length)} at ${measure.levels![1]} or higher · ${measure.period}`};
    }
    const median = district.medians[id]!;
    return {district: district.district, value: median.value, detail: `Median of ${plural(cells.length)} · ${measure.period}`};
  });
  const title = measure.kind === 'level' ? `Share at ${measure.levels![1]} or higher, by district` : `${measure.label}: median ULB by district`;
  return {rows, title};
}

/** The boundary name each district is drawn in: the LGD name its district code resolves to. */
export function districtPlacements(model: AtlasModel): Map<string, string> {
  return new Map(model.districts.filter((district) => district.lgdName).map((district) => [district.district, district.lgdName!]));
}
