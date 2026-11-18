import bwg from '@/data/aggregates/bwg-reference-day.json';
import ruralMonths from '@/data/aggregates/month-series.json';
import {sameDistrict} from './crosswalk';
import {districtMapRows, getUlbAtlas, measureHeadline, type AtlasMeasureId} from './ulb-atlas';
import {getSasaGoals, statusLabel} from './sasa-goals';
import {getEnvironmentSections} from './environment-ledger';

/**
 * Ask the evidence: answers questions from the records this app already retains, and from
 * nothing else. Every answer is assembled from facts, each fact is one sentence computed by the
 * same functions the screens use, and every fact carries its dataset and period. When the
 * question cannot be matched to a fact, the answer says so; it never fills the gap.
 */

export type Topic = AtlasMeasureId | 'legacy' | 'plastic' | 'bulk' | 'targets' | 'environment' | 'rural';

export interface EvidenceFact {
  id: string;
  kind: 'ulb' | 'district' | 'state';
  subject: string;
  district: string | null;
  topics: Topic[];
  label: string;
  /** For ordering only; null when held out or not a number. */
  value: number | null;
  display: string;
  sentence: string;
  period: string;
  dataset: string;
  screen: string;
  better: 'higher' | 'lower' | null;
  held?: boolean;
  /** Words from the fact's own label, for matching ledger lines the topic table does not name. */
  words?: string[];
}

export interface AnswerRow { label: string; sub?: string; value: string; bar?: number; factId: string }
export interface EvidenceAnswer {
  question: string;
  status: 'answered' | 'partial' | 'not-found';
  lead: string;
  rows: AnswerRow[];
  notes: string[];
  facts: EvidenceFact[];
  suggestions: string[];
  /** Charts drawn from the same facts and retained series; never from anything the answer does not cite. */
  charts?: AnswerChart[];
}

export interface ChartPoint { label: string; value: number; highlight: boolean }
export type AnswerChart =
  | {kind: 'strip'; title: string; caption: string; points: ChartPoint[]; median: number | null}
  | {kind: 'columns'; title: string; caption: string; bars: ChartPoint[]; median: number | null; lowerIsBetter: boolean}
  | {kind: 'line'; title: string; caption: string; x: string[]; series: Array<{label: string; values: Array<number | null>; highlight: boolean}>};

const TOPICS: Record<Topic, {label: string; words: string[]; dataset: string; screen: string}> = {
  reach: {label: 'Collection reach', words: ['collect', 'collection', 'collected', 'collecting', 'door to door', 'doorstep', 'pickup', 'reach', 'd2d'], dataset: 'msw_door_to_door_collection_api', screen: '/atlas'},
  segregation: {label: 'Segregation', words: ['segregat', 'sorting', 'wet and dry', 'source separation'], dataset: 'waste_egregation_api', screen: '/atlas'},
  toilets: {label: 'Household toilets', words: ['toilet', 'toilets', 'ihhl', 'latrine', 'latrines'], dataset: 'ihhl_new_identification_new1_api', screen: '/atlas'},
  fstp: {label: 'Faecal sludge plant', words: ['fstp', 'fstps', 'faecal', 'fecal', 'sludge', 'septage'], dataset: 'fstps_stps_cotreatment_new1_api', screen: '/atlas'},
  stp: {label: 'Sewage plants', words: ['stp', 'stps', 'sewage', 'sewerage', 'wastewater'], dataset: 'sewage_treated_qty_new1_api', screen: '/atlas'},
  odf: {label: 'ODF status', words: ['odf', 'open defecation', 'defecation'], dataset: 'swacch_survekshan_info_new1_api', screen: '/atlas'},
  gfc: {label: 'Garbage-free city stars', words: ['gfc', 'garbage free', 'star rating', 'stars'], dataset: 'swacch_survekshan_info_new1_api', screen: '/atlas'},
  rank: {label: 'Swachh Survekshan rank', words: ['rank', 'ranking', 'ranked', 'survekshan'], dataset: 'swacch_survekshan_info_new1_api', screen: '/atlas'},
  legacy: {label: 'Legacy waste', words: ['legacy', 'dump', 'dumps', 'dumpsite', 'dumpsites', 'biomining', 'dumped'], dataset: 'sasa_100_percent_clearance_of_legacy_waste_api', screen: '/goals'},
  plastic: {label: 'Plastic ban', words: ['plastic', 'single use', 'sup ban'], dataset: 'sasa_cdma_ulbs_single_use_plastic_ban_api', screen: '/goals'},
  bulk: {label: 'Bulk waste generators', words: ['bulk', 'bwg', 'bwgs', 'generator', 'generators', 'swm rules', 'hotels', 'institutions'], dataset: `${bwg.sources[0]} + ${bwg.sources[1]}`, screen: '/goals#swm-rules'},
  targets: {label: 'SASA targets', words: ['target', 'targets', 'goal', 'goals', 'deadline', 'deadlines', 'swarna'], dataset: 'stated targets', screen: '/goals'},
  environment: {label: 'Environment ledger', words: ['carbon', 'emission', 'emissions', 'methane', 'environment'], dataset: 'environment ledger', screen: '/environment'},
  rural: {label: 'Rural collection', words: ['rural', 'panchayat', 'panchayats', 'village', 'villages', 'gram', 'gp', 'gps'], dataset: 'sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026', screen: '/operational-analytics?tab=rural'},
};
const ULB_TOPICS: AtlasMeasureId[] = ['reach', 'segregation', 'toilets', 'fstp', 'stp', 'odf', 'gfc', 'rank'];

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'was', 'were', 'to', 'by', 'with', 'what', 'how', 'show', 'me', 'tell', 'about', 'doing', 'does', 'do', 'its', 'it', 'their', 'there', 'this', 'that', 'has', 'have', 'had', 'from', 'at', 'as', 'be', 'much', 'many', 'any', 'all', 'which', 'who', 'where', 'when', 'than', 'vs', 'versus', 'compare', 'between', 'status', 'district', 'districts', 'ulb', 'ulbs', 'city', 'cities', 'town', 'towns', 'state', 'andhra', 'pradesh', 'ap', 'data', 'figure', 'figures', 'level', 'rate', 'share', 'percent', 'percentage']);

export const normalize = (text: string) => text.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const whole = (n: number) => Math.round(n).toLocaleString('en-IN');
const pct = (n: number) => `${n.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`;
const share = (part: number, of: number) => (of ? part / of * 100 : 0);

/** Names a reader might type for a district, beyond the register's own spelling. */
const DISTRICT_ALIASES: Record<string, string[]> = {
  'Anantapuram': ['anantapur', 'ananthapur', 'ananthapuramu', 'anantapuramu'],
  'Visakhapatnam': ['vizag', 'vishakapatnam', 'visakha', 'vishakhapatnam'],
  'Sri Potti Sriramulu Nellore': ['spsr nellore', 'nellore district'],
  'Dr. B.R. Ambedkar Konaseema': ['konaseema', 'ambedkar konaseema'],
  'YSR Kadapa': ['kadapa', 'cuddapah', 'ysr'],
  'Sri Sathya Sai': ['sathya sai', 'satya sai', 'sri satya sai', 'puttaparthi district'],
  'Parvathipuram Manyam': ['manyam', 'parvathipuram manyam'],
  'NTR': ['ntr district'],
};

/* ---------------------------------------------------------------------------------------- */

let cachedIndex: ReturnType<typeof buildIndex> | null = null;
export function getEvidenceIndex() { return (cachedIndex ??= buildIndex()); }

function buildIndex() {
  const atlas = getUlbAtlas();
  const goals = getSasaGoals();
  const facts: EvidenceFact[] = [];
  const measure = (id: AtlasMeasureId) => atlas.measures.find((entry) => entry.id === id)!;

  // ULB facts: every Atlas cell, value or held, joined on the urban body code.
  for (const ulb of atlas.ulbs) {
    for (const id of ULB_TOPICS) {
      const m = measure(id), cell = ulb.cells[id];
      const base = {kind: 'ulb' as const, subject: ulb.name, district: ulb.district, topics: [id], label: m.label, period: m.period, dataset: m.source.includes('_api') ? m.source : TOPICS[id].dataset, screen: `/atlas?ulb=${encodeURIComponent(ulb.code)}&measure=${id}`, better: m.kind === 'rank' ? null : 'higher' as const};
      if (cell?.state === 'value') {
        const count = cell.count ? ` (${whole(cell.count.done)} of ${whole(cell.count.of)})` : '';
        const others = cell.of - 1;
        const position = cell.comparable && others > 0 ? ` Further along than ${cell.ahead} of the ${others} other reporting ULBs${cell.tied ? `, level with ${cell.tied}` : ''}.` : '';
        facts.push({...base, id: `ulb:${ulb.code}:${id}`, value: cell.value, display: cell.display,
          sentence: `${ulb.name}, ${ulb.district}: ${m.label.toLowerCase()} ${cell.display}${count}, ${m.period}.${position}`});
      } else if (cell?.state === 'held') {
        facts.push({...base, id: `ulb:${ulb.code}:${id}`, value: null, display: 'held out', held: true, better: null,
          sentence: `${ulb.name}, ${ulb.district}: ${m.label.toLowerCase()} is held out, ${cell.reason.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())}.`});
      }
    }
    const bulk = bwg.byUlbCode.find((entry) => entry.ulbCode === ulb.code);
    if (bulk) {
      facts.push({id: `ulb:${ulb.code}:bulk`, kind: 'ulb', subject: ulb.name, district: ulb.district, topics: ['bulk'], label: 'Bulk generators processing on site', value: bulk.identified ? share(bulk.processingOnSite, bulk.identified) : null,
        display: `${whole(bulk.processingOnSite)} of ${whole(bulk.identified)}`, period: `${goals.swm.day}, partial`, dataset: TOPICS.bulk.dataset, screen: TOPICS.bulk.screen, better: 'higher',
        sentence: `${ulb.name}, ${ulb.district}: ${whole(bulk.processingOnSite)} of ${whole(bulk.identified)} identified bulk waste generators processing wet waste on site, in the ${bulk.secretariats} secretariats retained for ${goals.swm.day}.`});
    }
  }

  // District facts: the SASA Goals columns (pooled), then Atlas district medians for the other measures.
  const columnTopic: Record<string, Topic> = {collection: 'reach', segregation: 'segregation', legacyOutstanding: 'legacy', plasticBan: 'plastic', bulkOnSite: 'bulk'};
  for (const row of goals.districts.rows) {
    for (const column of goals.districts.columns) {
      const cell = row[column.id], topic = columnTopic[column.id];
      facts.push({id: `district:${row.district}:${column.id}`, kind: 'district', subject: row.district, district: row.district, topics: [topic], label: column.label,
        value: cell.value, display: cell.value === null ? 'not available' : pct(cell.value), period: column.period, dataset: column.source, screen: column.id === 'bulkOnSite' ? TOPICS.bulk.screen : '/goals#goal-districts', better: column.better, held: cell.value === null,
        sentence: cell.value === null ? `${row.district} district: ${column.label.toLowerCase()} is not available. ${cell.detail}` : `${row.district} district: ${column.label.toLowerCase()} ${pct(cell.value)}, ${column.period}. ${cell.detail.split(' · ').slice(0, -1).join(', ') || cell.detail}.`});
    }
  }
  for (const id of ['toilets', 'fstp', 'stp', 'odf', 'gfc'] as AtlasMeasureId[]) {
    const m = measure(id);
    const map = districtMapRows(atlas, id);
    for (const row of map?.rows ?? []) {
      facts.push({id: `district:${row.district}:${id}`, kind: 'district', subject: row.district, district: row.district, topics: [id], label: m.label, value: row.value,
        display: row.value === null ? 'not reported' : m.kind === 'level' ? pct(row.value) : `${row.value.toLocaleString('en-IN', {maximumFractionDigits: 1})}${m.kind === 'rate' || m.kind === 'progress' ? '%' : ''}`,
        period: m.period, dataset: m.source.includes('_api') ? m.source : TOPICS[id].dataset, screen: `/atlas?measure=${id}&district=${encodeURIComponent(row.district)}`, better: 'higher', held: row.value === null,
        sentence: `${row.district} district, ${m.label.toLowerCase()}: ${row.detail}${row.value === null ? '' : ` Value ${m.kind === 'level' ? pct(row.value) : `${row.value.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`}.`}`});
    }
  }

  // State facts: the stated targets, the Atlas headlines, the SWM view and the environment ledger.
  const goalTopic: Record<string, Topic[]> = {legacy: ['legacy', 'targets'], collection: ['reach', 'targets'], segregation: ['segregation', 'targets'], plastic: ['plastic', 'targets'], 'odf-plus': ['odf', 'targets'], 'bulk-generators': ['bulk', 'targets']};
  for (const goal of goals.goals) {
    const reading = goal.reading;
    facts.push({id: `target:${goal.id}`, kind: 'state', subject: 'Andhra Pradesh', district: null, topics: goalTopic[goal.id] ?? ['targets'], label: `Target: ${goal.target}`,
      value: reading?.share ?? null, display: reading?.display ?? 'no retained measure', period: reading?.asOfLabel ?? goal.deadlineLabel, dataset: reading?.dataset ?? 'none retained', screen: `/goals#goal-${goal.id}`, better: null,
      words: normalize(`${goal.theme} ${goal.target}`).split(' '),
      sentence: `Stated target "${goal.target}" (${goal.deadline ? `due ${goal.deadlineLabel}` : goal.deadlineLabel}; ${goal.source.publisher}, ${goal.source.date}): ${reading ? `latest reading ${reading.display}, ${reading.asOfLabel}` : 'no retained source measures it'}. Status: ${statusLabel[goal.status].toLowerCase()}.${reading?.gap ? ` Gap: ${reading.gap}.` : ''}`});
  }
  for (const id of ULB_TOPICS) {
    const m = measure(id), head = measureHeadline(atlas, id);
    facts.push({id: `state:${id}`, kind: 'state', subject: 'Andhra Pradesh', district: null, topics: [id], label: id === 'rank' ? 'ULBs with a reported rank' : m.label, value: id === 'rank' ? null : head.figure, display: `${head.figure.toLocaleString('en-IN', {maximumFractionDigits: head.decimals})}${head.suffix}`,
      period: m.period, dataset: m.source.includes('_api') ? m.source : TOPICS[id].dataset, screen: '/atlas', better: null,
      sentence: `Across the state, ${m.label.toLowerCase()}: ${head.figure.toLocaleString('en-IN', {maximumFractionDigits: head.decimals})}${head.suffix} ${head.sentence} ${m.boundary}`});
  }
  const swm = goals.swm;
  facts.push({id: 'state:bulk', kind: 'state', subject: 'Andhra Pradesh', district: null, topics: ['bulk'], label: 'Bulk waste generators', value: share(swm.onSite, swm.identified), display: `${whole(swm.onSite)} of ${whole(swm.identified)}`,
    period: `${swm.day}, partial`, dataset: TOPICS.bulk.dataset, screen: TOPICS.bulk.screen, better: null,
    sentence: `Across the state, ${whole(swm.onSite)} of ${whole(swm.identified)} identified bulk waste generators were processing wet waste on site on ${swm.day}, in ${whole(swm.secretariats)} of ${whole(swm.registerSecretariats)} secretariats retained; ${swm.noneOnSite} of the ${swm.withIdentified} ULBs with generators identified report none on site. On-site processing is one route under the SWM Rules 2026; the feeds record no other.`});
  for (const line of getEnvironmentSections().flatMap((section) => section.lines)) {
    if (line.reported === null) continue;
    facts.push({id: `env:${line.id}`, kind: 'state', subject: 'Andhra Pradesh', district: null, topics: ['environment'], label: line.label, value: line.target ? share(line.reported, line.target) : null,
      display: `${whole(line.reported)}${line.target ? ` of ${whole(line.target)}` : ''} ${line.unit}`, period: line.period ?? 'period not stated', dataset: line.tableKey, screen: '/environment', better: null,
      words: normalize(line.label).split(' ').filter((word) => word.length > 3 && !STOP.has(word)),
      sentence: `${line.label}: ${whole(line.reported)}${line.target ? ` of ${whole(line.target)}` : ''} ${line.unit} reported${line.period ? `, ${line.period}` : ''}.`});
  }

  // Rural collection: one fixed panchayat-day cohort, days 1-7 of every retained month, so months compare.
  const months = ruralMonths.series.map((entry) => entry.period);
  const monthName = (period: string) => new Date(`${period}-01T00:00:00Z`).toLocaleDateString('en-GB', {month: 'short', timeZone: 'UTC'});
  const span = `${monthName(months[0])}–${monthName(months.at(-1)!)} ${months.at(-1)!.slice(0, 4)}, days 1–7`;
  const ratesText = (rates: number[]) => rates.map((rate, i) => `${pct(rate * 100)} in ${monthName(months[i])}`).join(', ');
  const stateRates = ruralMonths.series.map((entry) => entry.comparable.collectionRate);
  facts.push({id: 'state:rural', kind: 'state', subject: 'Andhra Pradesh', district: null, topics: ['rural'], label: 'Rural collection, common cohort', value: stateRates.at(-1)! * 100, display: pct(stateRates.at(-1)! * 100),
    period: span, dataset: TOPICS.rural.dataset, screen: TOPICS.rural.screen, better: null,
    sentence: `Rural door-to-door collection in the common cohort of ${whole(ruralMonths.cohort.pairs)} panchayat-days: ${ratesText(stateRates)}. Every month counts the same panchayat-days, days 1–7.`});
  const registerDistricts = [...new Set(atlas.ulbs.map((ulb) => ulb.district))];
  const ruralNames = new Map<string, string>();
  for (const row of ruralMonths.byDistrict) {
    const exact = registerDistricts.find((name) => normalize(name) === normalize(row.district));
    const similar = registerDistricts.filter((name) => sameDistrict(row.district, name));
    const name = exact ?? (similar.length === 1 ? similar[0] : row.district);
    ruralNames.set(row.district, name);
    const rates = row.points.map((point) => point.collectionRate);
    facts.push({id: `rural:${row.district}`, kind: 'district', subject: name, district: name, topics: ['rural'], label: 'Rural collection, common cohort', value: rates.at(-1)! * 100, display: pct(rates.at(-1)! * 100),
      period: span, dataset: TOPICS.rural.dataset, screen: TOPICS.rural.screen, better: 'higher',
      sentence: `${name} district, rural collection in its ${whole(row.pairs)} common panchayat-days: ${ratesText(rates)}.`});
  }

  // Entity names a question can match, longest first.
  const entities: Array<{alias: string; kind: 'ulb' | 'district'; name: string; district: string; code?: string}> = [];
  for (const ulb of atlas.ulbs) {
    const names = new Set<string>([ulb.name, ...ulb.spellings]);
    for (const name of names) {
      const full = normalize(name);
      if (full) entities.push({alias: full, kind: 'ulb', name: ulb.name, district: ulb.district, code: ulb.code});
      const before = normalize(name.split('(')[0]);
      if (before && before !== full) entities.push({alias: before, kind: 'ulb', name: ulb.name, district: ulb.district, code: ulb.code});
      const inside = /\(([A-Z]{3,6})\)/.exec(name)?.[1];
      if (inside) entities.push({alias: inside.toLowerCase(), kind: 'ulb', name: ulb.name, district: ulb.district, code: ulb.code});
    }
  }
  for (const district of new Set(atlas.ulbs.map((ulb) => ulb.district))) {
    for (const alias of [normalize(district), ...(DISTRICT_ALIASES[district] ?? [])]) entities.push({alias, kind: 'district', name: district, district});
  }
  for (const name of new Set(ruralNames.values())) if (!registerDistricts.includes(name)) entities.push({alias: normalize(name), kind: 'district', name, district: name});
  const unique = new Map(entities.map((entity) => [`${entity.kind}|${entity.name}|${entity.alias}`, entity]));
  return {facts, ruralMonths: months.map(monthName), ruralNames, entities: [...unique.values()].sort((a, b) => b.alias.length - a.alias.length), measures: atlas.measures, ulbCount: atlas.ulbs.length, districtCount: goals.districts.rows.length};
}

/* ---------------------------------------------------------------------------------------- */

const LOW_VALUE = /\b(lowest|least|fewest|smallest|minimum|bottom)\b/;
const HIGH_VALUE = /\b(highest|most|largest|biggest|maximum|top)\b/;
const WORST = /\b(worst|weakest|poorest|lagging|laggards?|behind|struggling|slowest)\b/;
const BEST = /\b(best|strongest|leading|leaders?|ahead|fastest|performing well|doing well)\b/;
const TREND = /\b(trends?|over time|changed?|changing|movement|month by month|monthly|daily|day by day|series|history)\b/;
const WHY = /\b(why|cause|causes|reason|reasons|because|blame|should|recommend|predict|forecast|will|next year)\b/;

function matchTopics(q: string): Topic[] {
  const tokens = q.split(' ');
  const hit = (word: string) => word.includes(' ') ? ` ${q} `.includes(` ${word} `) : word.length >= 6 ? tokens.some((token) => token.startsWith(word)) : tokens.includes(word);
  return (Object.keys(TOPICS) as Topic[]).filter((topic) => TOPICS[topic].words.some(hit));
}

function matchEntities(q: string, entities: ReturnType<typeof buildIndex>['entities']) {
  const found: typeof entities = [];
  let rest = ` ${q} `;
  for (const entity of entities) {
    if (entity.alias.length < 3) continue;
    const needle = ` ${entity.alias} `;
    if (!rest.includes(needle)) continue;
    // Both a ULB and a district can carry the same name (Guntur, Kurnool); keep both, and let a longer name consume its words.
    found.push(entity);
    const sameName = entities.filter((other) => other.alias === entity.alias && other !== entity);
    found.push(...sameName.filter((other) => !found.includes(other)));
    rest = rest.split(needle).join(' ');
  }
  const seen = new Set<string>();
  return found.filter((entity) => { const key = `${entity.kind}|${entity.name}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

const rowFor = (fact: EvidenceFact, max = 100): AnswerRow => ({
  label: fact.subject, sub: fact.kind === 'ulb' ? fact.district ?? undefined : fact.kind === 'district' ? 'district' : undefined, value: fact.display,
  bar: fact.value !== null && fact.better !== null && max > 0 && !fact.topics.includes('rank') ? Math.max(0, Math.min(100, fact.value / max * 100)) : undefined, factId: fact.id,
});

/** Answers one question from the index. Deterministic: the same question always gives the same answer. */
/** Answers one question from the index, with its charts. */
export function askEvidence(question: string): EvidenceAnswer {
  return withCharts(askEvidenceCore(question), question);
}

function askEvidenceCore(question: string): EvidenceAnswer {
  const index = getEvidenceIndex();
  const q = normalize(question);
  const notes: string[] = [];
  const suggestions = suggestedQuestions();
  const empty = (lead: string): EvidenceAnswer => ({question, status: 'not-found', lead, rows: [], notes, facts: [], suggestions});
  if (!q) return empty('Ask about collection, segregation, toilets, legacy waste, plastic, bulk generators or the SASA targets, for the state, a district or a ULB.');

  let entities = matchEntities(q, index.entities);
  let topics = matchTopics(q);
  // Ledger lines the topic table does not name ("water bodies", "green cover", "compost").
  const ledger = index.facts.filter((fact) => fact.words?.length && fact.words.filter((word) => ` ${q} `.includes(` ${word}`)).length >= Math.min(2, fact.words.length));
  if (!topics.length && ledger.length) topics = [...new Set(ledger.flatMap((fact) => fact.topics))];
  const wantsDistricts = /\bdistricts?\b/.test(q);
  const wantsUlbs = /\b(ulbs?|towns?|city|cities|municipal\w*|corporations?|councils?)\b/.test(q);
  const superlative = LOW_VALUE.test(q) || HIGH_VALUE.test(q) || WORST.test(q) || BEST.test(q);
  const urban = /\b(urban|ulbs?|city|cities|towns?|municipal\w*)\b/.test(q);
  if (topics.includes('rural') && !urban) { topics = topics.filter((topic) => topic !== 'reach'); entities = entities.filter((entity) => entity.kind === 'district'); }
  if (wantsDistricts && !wantsUlbs) entities = entities.filter((entity) => entity.kind === 'district');
  if (wantsUlbs && !wantsDistricts) entities = entities.filter((entity) => entity.kind === 'ulb');
  if (entities.some((entity) => entity.kind === 'ulb') && entities.some((entity) => entity.kind === 'district') && !wantsDistricts && !wantsUlbs)
    return empty('That name matches a city and a district. Include “city” or “district” so the answer uses the right population.');
  if (topics.includes('rank') && (superlative || /\b(compare|better|ahead|median)\b/.test(q)))
    return empty('Rank comparison is withheld: the 2024 source does not identify population categories. Ask for a named city’s reported rank instead.');
  const requestedYears = q.match(/\b20\d{2}\b/g) ?? [];
  if ((requestedYears.length || /\b(today|current|latest|yesterday|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(q)) && !topics.includes('rural') && !TREND.test(q))
    return empty('This question asks for a time-specific reading. Use the source’s period controls to select an available observation; the question view only summarizes its labelled retained periods.');
  if (WHY.test(q)) return empty('The retained records cannot establish causes, forecasts or the effect of an intervention. Ask what was reported for a place or measure.');
  if (superlative && topics.includes('legacy') && !/\b(share|percent|percentage|rate)\b/.test(q))
    return empty('Do you mean the largest quantity or the highest remaining share? This question view supports remaining share; ask “Which district has the highest remaining share of legacy waste?”');

  if (!entities.length && /\b(in|for)\s+/.test(q) && !/\b(in|for) (the )?(state|andhra pradesh|ap|all ulbs|all districts|retained records)\b/.test(q))
    return empty('I could not identify that place in the retained register. Use a named ULB or district from the Atlas; I will not substitute a statewide figure.');
  if (/\b(compare|versus|vs)\b/.test(q) && (entities.length < 2 || new Set(entities.map(entity => entity.kind)).size > 1))
    return empty('Name two recognized cities or two recognized districts to compare the same measure. Both places must be recognized and use the same population level.');
  if (superlative && /\b(count|number|quantity|tonnes|households|most toilets|most generators)\b/.test(q))
    return empty('This question view compares reported rates and shares. Use the programme review or Atlas shortfall list for quantities, with their own units and populations.');

  const forTopic = (topic: Topic, kind?: EvidenceFact['kind']) => index.facts.filter((fact) => fact.topics.includes(topic) && (!kind || fact.kind === kind));
  const boundaryFor = (topic: Topic) => index.measures.find((m) => m.id === topic)?.boundary;

  // 1. A ranking: which district or ULB is highest, lowest, best or worst on a measure.
  if (superlative && topics.length && !entities.length) {
    const topic = topics.find((entry) => entry !== 'targets' && entry !== 'environment') ?? topics[0];
    const ulbFacts = forTopic(topic, 'ulb'), districtFacts = forTopic(topic, 'district');
    const kind: 'ulb' | 'district' = wantsDistricts || (!wantsUlbs && !ulbFacts.length) ? 'district' : 'ulb';
    const pool = (kind === 'ulb' ? ulbFacts : districtFacts).filter((fact) => fact.value !== null && fact.better !== null);
    if (!pool.length) return {...empty(`Nothing retained ranks ${kind === 'ulb' ? 'ULBs' : 'districts'} on ${TOPICS[topic].label.toLowerCase()}.`), facts: forTopic(topic, 'state'), status: forTopic(topic, 'state').length ? 'partial' : 'not-found'};
    const better = pool[0].better!;
    const wantsHigh = HIGH_VALUE.test(q) ? true : LOW_VALUE.test(q) ? false : BEST.test(q) ? better === 'higher' : better === 'lower';
    const sorted = [...pool].sort((a, b) => (wantsHigh ? b.value! - a.value! : a.value! - b.value!) || a.subject.localeCompare(b.subject));
    const extreme = sorted[0].value!;
    const tied = sorted.filter((fact) => fact.value === extreme);
    const shown = sorted.slice(0, Math.max(5, Math.min(tied.length, 8)));
    const label = (topic === 'bulk' ? 'bulk generators processing on site' : pool[0].label.toLowerCase());
    const direction = wantsHigh ? 'highest' : 'lowest';
    const plural = kind === 'ulb' ? 'ULBs' : 'districts';
    const lead = tied.length > 1
      ? `${tied.length} of the ${pool.length} ${plural} with a value share the ${direction} ${label}, ${tied[0].display}: ${tied.slice(0, 6).map((fact) => fact.subject).join(', ')}${tied.length > 6 ? ' and others' : ''}. ${pool[0].period}.`
      : `${sorted[0].subject}${kind === 'ulb' ? `, ${sorted[0].district},` : ''} has the ${direction} ${label} of the ${pool.length} ${plural} with a value: ${sorted[0].display}, ${pool[0].period}.`;
    const held = (kind === 'ulb' ? ulbFacts : districtFacts).filter((fact) => fact.value === null).length;
    if (held) notes.push(`${held} ${kind === 'ulb' ? 'ULBs are' : 'districts are'} held out or not reported on this measure and are not ranked.`);
    if (topic === 'rank') notes.push('A smaller rank is a higher place. The response does not say which population category each rank is within.');
    const boundary = boundaryFor(topic); if (boundary) notes.push(boundary);
    if (topic === 'bulk') notes.push('A partial reading: only secretariats retrieved for the day are counted.');
    const max = Math.max(...pool.map((fact) => fact.value!), 1);
    return {question, status: 'answered', lead, rows: shown.map((fact) => rowFor(fact, topic === 'bulk' || topic === 'legacy' || pool[0].display.endsWith('%') ? 100 : max)), notes, facts: shown, suggestions};
  }

  // 2. Named places: one or more ULBs or districts, on the named measures or on everything retained.
  if (entities.length) {
    const used: EvidenceFact[] = [];
    const rows: AnswerRow[] = [];
    const lines: string[] = [];
    for (const entity of entities.slice(0, 4)) {
      const own = index.facts.filter((fact) => fact.kind === entity.kind && fact.subject === entity.name);
      const wanted = topics.length ? own.filter((fact) => fact.topics.some((topic) => topics.includes(topic))) : own;
      if (wanted.length) {
        used.push(...wanted);
        if (wanted.length === 1 || (topics.length && wanted.length <= 2)) lines.push(...wanted.map((fact) => fact.sentence));
        else {
          lines.push(`${entity.name}${entity.kind === 'district' ? ' district' : `, ${entity.district}`}: ${wanted.filter((fact) => !fact.held).length} measures with a value${wanted.some((fact) => fact.held) ? `, ${wanted.filter((fact) => fact.held).length} held out` : ''}.`);
          rows.push(...wanted.map((fact) => ({...rowFor(fact), label: `${fact.label}${entities.length > 1 ? ` · ${fact.subject}` : ''}`, sub: fact.period})));
        }
      }
      // A measure kept only at district grain: answer from the ULB's district and say why.
      if (entity.kind === 'ulb' && topics.length) {
        for (const topic of topics.filter((entry) => !wanted.some((fact) => fact.topics.includes(entry)) && entry !== 'targets' && entry !== 'environment')) {
          const districtFact = index.facts.find((fact) => fact.kind === 'district' && fact.subject === entity.district && fact.topics.includes(topic));
          if (districtFact) {
            used.push(districtFact); lines.push(districtFact.sentence);
            notes.push(`${TOPICS[topic].label} is not joined to single ULBs${topic === 'legacy' ? ', because its rows carry no urban body code' : ''}, so ${entity.name} is answered at district level.`);
          }
        }
      }
    }
    if (!used.length) return empty(`${entities.map((entity) => entity.name).join(' and ')} ${entities.length > 1 ? 'have' : 'has'} no retained figure for ${topics.map((topic) => TOPICS[topic].label.toLowerCase()).join(' or ') || 'that'}.`);
    for (const topic of topics) { const boundary = boundaryFor(topic); if (boundary && used.some((fact) => fact.kind === 'ulb' && fact.topics.includes(topic))) notes.push(boundary); }
    if (entities.some((entity) => entity.kind === 'ulb') && entities.some((entity) => entity.kind === 'district') && new Set(entities.map((entity) => entity.name.toLowerCase())).size < entities.length)
      notes.push('The name matches both a ULB and a district, so both are shown.');
    return {question, status: 'answered', lead: lines[0], rows: [...lines.slice(1).map((line, i) => ({label: line, value: '', factId: used[i + 1]?.id ?? used[0].id})), ...rows].slice(0, 16), notes: [...new Set(notes)], facts: [...new Map(used.map(fact => [fact.id, fact])).values()], suggestions};
  }

  // 3. A measure with no place: the statewide reading, and the stated target where there is one.
  if (topics.length) {
    const state = topics.flatMap((topic) => forTopic(topic, 'state'));
    const facts = (ledger.length && topics.includes('environment') ? [...ledger, ...state] : state).filter((fact, i, all) => all.indexOf(fact) === i).slice(0, 6);
    if (!facts.length) return empty(`Nothing retained gives a statewide figure for ${topics.map((topic) => TOPICS[topic].label.toLowerCase()).join(' or ')}.`);
    const [first, ...rest] = facts;
    if (topics.some((topic) => ULB_TOPICS.includes(topic as AtlasMeasureId) || topic === 'legacy' || topic === 'plastic' || topic === 'bulk')) notes.push('Ask which district or ULB is lowest or highest to see the spread.');
    return {question, status: 'answered', lead: first.sentence, rows: rest.map((fact) => ({label: fact.sentence, value: '', factId: fact.id})), notes, facts, suggestions};
  }

  return empty('I could not match that to a measure or a place in the retained records. They cover collection, segregation, household toilets, sludge and sewage plants, the 2024 survey, legacy waste, the plastic ban, bulk waste generators and the SASA targets.');
}

/** Questions the index can answer today, built from its own names so none of them dead-ends. */
export function suggestedQuestions(): string[] {
  const index = getEvidenceIndex();
  const has = (name: string) => index.entities.some((entity) => entity.kind === 'ulb' && entity.name === name);
  const city = ['VIJAYAWADA', 'GUNTUR', 'NELLORE', 'KURNOOL'].find(has) ?? index.entities.find((entity) => entity.kind === 'ulb')!.name;
  const title = city.charAt(0) + city.slice(1).toLowerCase();
  return [
    'Which district has the highest remaining share of legacy waste?',
    `How is ${title} city doing on collection and segregation?`,
    'Which ULBs have the lowest toilet completion?',
    'Bulk waste generators in Visakhapatnam city',
    'Where does the plastic-free target stand?',
    'How has rural collection changed?',
  ];
}

/* ---------------------------------------------------------------------------------------- */

/**
 * Accept only exact cited fact sentences. Number membership alone cannot verify a claim.
 * Kept as a validation boundary for callers; the question UI uses deterministic answers.
 */
export function checkWrittenAnswer(text: string, citations: string[], facts: EvidenceFact[], question: string): {ok: true; cited: EvidenceFact[]} | {ok: false; reason: string} {
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const cited = [...new Set(citations)].map((id) => byId.get(id)).filter((fact): fact is EvidenceFact => Boolean(fact));
  if (!cited.length) return {ok: false, reason: 'no citation matched a supplied record'};
  if (cited.length !== new Set(citations).size) return {ok: false, reason: 'a citation named a record that was not supplied'};
  void question;
  const allowed = cited.map((fact) => fact.sentence.trim());
  const normalized = text.trim().replace(/\s+/g, ' ');
  const assembled = allowed.join(' ').replace(/\s+/g, ' ');
  if (normalized !== assembled) return {ok: false, reason: 'Only the exact cited fact sentences are accepted; matching numbers does not verify meaning'};
  return {ok: true, cited};
}

/** The records sent with a question to the optional backend: the facts behind the assembled answer, then the nearest others. */
export function evidencePack(answer: EvidenceAnswer, limit = 40): EvidenceFact[] {
  const index = getEvidenceIndex();
  const subjects = new Set(answer.facts.map((fact) => fact.subject));
  const topics = new Set(answer.facts.flatMap((fact) => fact.topics));
  const near = index.facts.filter((fact) => !answer.facts.includes(fact) && (fact.kind === 'state' ? fact.topics.some((topic) => topics.has(topic)) : subjects.has(fact.subject) && fact.topics.some((topic) => topics.has(topic))));
  return [...answer.facts, ...near].slice(0, limit);
}

export const topicLabel = (topic: Topic) => TOPICS[topic].label;

/* ---------------------------------------------------------------------------------------- */

/** What the optional Claude backend is sent: the records behind the assembled answer and their nearest neighbours, as id and sentence only. */
export function modelRecords(answer: EvidenceAnswer, limit = 40): Array<{id: string; text: string}> {
  return evidencePack(answer, limit).map((fact) => ({id: fact.id, text: `${fact.sentence} [${fact.period}; ${fact.dataset}]`}));
}

const FRAMING_BANNED = /\b(because|due to|caus\w*|prov\w*|success\w*|fail\w*|should|must|recommend\w*|will|expect\w*|likely|probabl\w*|better|worse|best|worst|good|poor\w*|strong\w*|weak\w*|lag\w*|lead\w*|excellent|concern\w*|alarm\w*|impressive|improv\w*|declin\w*|progress\w*|missed)\b/i;

/**
 * The backend writes one framing sentence; every figure the reader sees still comes from a cited
 * record, shown verbatim beneath it. So the framing may carry no digits, no judgement and no
 * cause, and it must stay short. Anything else is discarded and the assembled answer stands.
 */
export function checkFraming(text: string): {ok: true} | {ok: false; reason: string} {
  const trimmed = text.trim();
  if (!trimmed) return {ok: false, reason: 'empty'};
  if (/\d/.test(trimmed)) return {ok: false, reason: 'the wording carried a figure of its own'};
  if (trimmed.split(/\s+/).length > 40) return {ok: false, reason: 'the wording was too long'};
  const banned = FRAMING_BANNED.exec(trimmed);
  if (banned) return {ok: false, reason: `the wording made a judgement (“${banned[0]}”)`};
  return {ok: true};
}

/** Scope of what the assistant can draw on, for its header. */
export function evidenceScope() {
  const index = getEvidenceIndex();
  return {ulbs: index.ulbCount, districts: index.districtCount, measures: index.measures.length, facts: index.facts.length};
}

/* ---------------------------------------------------------------------------------------- */

const CHART_TOPICS: Topic[] = ['reach', 'segregation', 'toilets', 'fstp', 'stp', 'legacy', 'plastic', 'bulk', 'rural'];
const medianOf = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Charts for an answer, drawn only from facts of the same measure and period as the ones it
 * cites: where the named places sit among every place with a value, a district profile, or the
 * rural monthly series. No urban daily trend is drawn: outside 12 August the retained window is
 * mostly stored zeros, which the Gap Radar already explains.
 */
function withCharts(answer: EvidenceAnswer, question: string): EvidenceAnswer {
  const q = normalize(question);
  const index = getEvidenceIndex();
  const notes = [...answer.notes];
  const asked = matchTopics(q);
  if (TREND.test(q) && (asked.includes('reach') || asked.includes('segregation')) && !asked.includes('rural'))
    notes.push('No urban trend is drawn. The retained urban window carries substantial collection only on 12 Aug 2026; the other 15 days are mostly stored zeros, which do not show that collection stopped. Rural collection has a monthly series: ask about rural collection.');
  if (answer.status !== 'answered') return {...answer, notes: [...new Set(notes)]};
  const charts: AnswerChart[] = [];
  const primary = [...new Set(answer.facts.map((fact) => fact.topics[0]))].filter((topic) => CHART_TOPICS.includes(topic));
  for (const topic of primary) {
    if (charts.length >= 2) break;
    const cited = answer.facts.filter((fact) => fact.topics[0] === topic);
    const named = new Set(cited.filter((fact) => fact.kind !== 'state').map((fact) => fact.subject));
    if (topic === 'rural') { charts.push(ruralChart(index, named)); continue; }
    const ulbPool = index.facts.filter((fact) => fact.kind === 'ulb' && fact.topics[0] === topic && fact.value !== null && !fact.held && fact.better !== null);
    const districtPool = index.facts.filter((fact) => fact.kind === 'district' && fact.topics[0] === topic && fact.value !== null && !fact.held);
    const citesUlb = cited.some((fact) => fact.kind === 'ulb'), citesDistrict = cited.some((fact) => fact.kind === 'district');
    const label = TOPICS[topic].label;
    if ((citesUlb || (!citesDistrict && ulbPool.length)) && ulbPool.length > 4) {
      const points = ulbPool.map((fact) => ({label: fact.subject, value: Math.max(0, Math.min(100, fact.value!)), highlight: named.has(fact.subject)}));
      const who = named.size === 1 ? [...named][0] : named.size ? 'the named ULBs' : null;
      charts.push({kind: 'strip', title: who ? `${label}: where ${who} ${named.size === 1 ? 'sits' : 'sit'} among ${points.length} ULBs` : `${label} across ${points.length} ULBs`,
        caption: `${ulbPool[0].period} · one dot per ULB with a value; held-out and unreported ULBs are not drawn`, points, median: medianOf(points.map((point) => point.value))});
    } else if (districtPool.length > 3) {
      const bars = [...districtPool].sort((a, b) => b.value! - a.value! || a.subject.localeCompare(b.subject)).map((fact) => ({label: fact.subject, value: Math.max(0, Math.min(100, fact.value!)), highlight: named.has(fact.subject)}));
      charts.push({kind: 'columns', title: `${label} by district`, caption: `${districtPool[0].period} · ${bars.length} districts with a value, highest first${districtPool[0].better === 'lower' ? '; lower is further along' : ''}`,
        bars, median: medianOf(bars.map((bar) => bar.value)), lowerIsBetter: districtPool[0].better === 'lower'});
    }
  }
  return {...answer, notes: [...new Set(notes)], charts};
}

function ruralChart(index: ReturnType<typeof getEvidenceIndex>, named: Set<string>): AnswerChart {
  const series: Array<{label: string; values: Array<number | null>; highlight: boolean}> = [
    {label: 'Andhra Pradesh', values: ruralMonths.series.map((entry) => entry.comparable.collectionRate * 100), highlight: named.size === 0},
  ];
  for (const row of ruralMonths.byDistrict) {
    const name = index.ruralNames.get(row.district) ?? row.district;
    if (named.has(name) && series.length < 4) series.push({label: name, values: ruralMonths.series.map((entry) => { const point = row.points.find((item) => item.period === entry.period); return point ? point.collectionRate * 100 : null; }), highlight: true});
  }
  return {kind: 'line', title: named.size ? `Rural collection: ${[...named].slice(0, 3).join(', ')} against the state` : 'Rural collection, month by month',
    caption: `Common panchayat-day cohort, days 1–7 of each month · the axis is zoomed to the range shown, not from zero`, x: index.ruralMonths, series};
}
