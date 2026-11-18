import {serviceCategory, serviceExclusions, serviceRates, serviceSnapshot} from './ulb-service';
import {createProvider} from './domain';
import {getRevisionInventory} from './source-revisions';
import {getCollectionProcurementSummary, getIHHLFunnel, getLegacyWasteSummary} from './analytics';
import {getRankingDefinition, rankSubject} from './subject-rankings';
import {getRuralMovement} from './rural-movement';
import {governedSnapshots} from './snapshots';
import {formatAtlasDay, getUlbAtlas, measureHeadline, type AtlasValue} from './ulb-atlas';
import {getEnvironmentSections, segregationAtSource} from './environment-ledger';

/**
 * The opening view of each screen: one accent line under the page name, up to four headline
 * figures, and the data its graphic draws. Every figure comes from the function the screen
 * itself reads, so the hero cannot disagree with what sits beneath it.
 */
export interface HeroFigure {
  label: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  context: string;
  /** Share 0–100 drawn as a thin bar under the figure, when the figure has one. */
  meter?: number;
  tone?: 'good' | 'warm';
}
export interface ScreenHeroData {
  eyebrow: string;
  title: string;
  accent: string;
  figures: HeroFigure[];
}

const share = (part: number, whole: number) => (whole ? part / whole * 100 : 0);

export function revisedRouteCount(): {revised: number; routes: number} {
  const inventory = getRevisionInventory();
  return {revised: inventory.filter((route) => route.changed).length, routes: inventory.length};
}

export function ruralChange() {
  const rural = getRuralMovement();
  const open = (rural.series[0]?.comparable.collectionRate ?? 0) * 100;
  const close = (rural.series.at(-1)?.comparable.collectionRate ?? 0) * 100;
  return {open, close, shift: close - open};
}

export function gapRadarHero(): ScreenHeroData & {points: Array<{x: number; y: number; category: string}>} {
  const eligible = serviceSnapshot.ulbs.filter((ulb) => !serviceExclusions(ulb).length);
  const both = eligible.filter((ulb) => serviceCategory(ulb, 80, 80) === 'both').length;
  const below = eligible.filter((ulb) => serviceCategory(ulb, 80, 80) === 'review').length;
  const reach = rankSubject(getRankingDefinition('reach').inputs);
  const rural = ruralChange();
  const day = formatAtlasDay(serviceSnapshot.day);
  return {
    eyebrow: 'Evidence-gated assessment',
    title: 'Gap Radar',
    accent: 'where each ULB sits among its peers.',
    figures: [
      {label: 'Met both draft guides', value: both, context: `of ${eligible.length} placed ULBs, collection and segregation at 80% or more · ${day}`, meter: share(both, eligible.length), tone: 'good'},
      {label: 'Below both guides', value: below, context: `of ${eligible.length} placed ULBs · ${day}`, meter: share(below, eligible.length), tone: 'warm'},
      {label: 'Ranked on collection reach', value: reach.rows.length, context: `of ${reach.population} ULBs; ${reach.excluded.length} held out, each with its reason`, meter: share(reach.rows.length, reach.population), tone: 'good'},
      {label: 'Rural collection, May to August', value: rural.shift, decimals: 2, prefix: rural.shift > 0 ? '+' : '', suffix: ' pp', context: `${rural.open.toFixed(2)}% to ${rural.close.toFixed(2)}% in the common panchayat-day cohort`, tone: rural.shift < 0 ? 'warm' : 'good'},
    ],
    points: eligible.map((ulb) => {
      const rates = serviceRates(ulb);
      return {x: rates.collection ?? 0, y: rates.segregation ?? 0, category: serviceCategory(ulb, 80, 80) ?? 'review'};
    }),
  };
}

export function atlasHero(): ScreenHeroData {
  const model = getUlbAtlas();
  const reach = measureHeadline(model, 'reach');
  const reachMeasure = model.measures.find((measure) => measure.id === 'reach')!;
  const notCollected = model.ulbs.map((ulb) => ulb.cells.reach).filter((cell): cell is AtlasValue => cell?.state === 'value').reduce((sum, cell) => sum + (cell.gap ?? 0), 0);
  return {
    eyebrow: 'Cross-programme ULB atlas',
    title: 'ULB Atlas',
    accent: 'every programme, one identity.',
    figures: [
      {label: 'Values placed', value: model.stats.placed, context: `of ${model.stats.cells.toLocaleString('en-IN')} ULB and measure cells; every empty cell says why`, meter: share(model.stats.placed, model.stats.cells), tone: 'good'},
      {label: 'Measures lined up', value: model.stats.measures, context: `from ${model.stats.sources} sources, each on its own period, none added together`},
      {label: 'ULBs joined across spellings', value: model.stats.respelled, context: 'a name join would have split each of these in two'},
      {label: 'Households not collected from', value: notCollected, context: `${reachMeasure.reporting} reporting ULBs · ${reachMeasure.period}`, meter: 100 - reach.figure, tone: 'warm'},
    ],
  };
}

/** `flow`: stages one after another (each a subset of the last). `split`: parts of one total. */
export interface Pipeline { label: string; period: string; kind: 'flow' | 'split'; stages: Array<{label: string; value: number}> }

/**
 * The Operational Analytics opening, bound to the period the reader has pinned. Each figure is
 * one programme's last reported stage against its own earlier stage, for that period only; a
 * programme with no retained rows for the period is named as missing, never shown at an older
 * month. Stages are drawn to exact scale against the programme's first stage, and no transition
 * between stages is implied: the source does not say one stage is a subset of the last.
 */
export function analyticsHero(period: string | null = null): ScreenHeroData & {pipelines: Pipeline[]; missing: string[]; periodLabel: string} {
  const collection = getCollectionProcurementSummary(period);
  const toilets = getIHHLFunnel(period);
  const legacy = getLegacyWasteSummary(period);
  const whole = (n: number) => n.toLocaleString('en-IN');
  const tone = (meter: number) => (meter < 50 ? 'warm' as const : 'good' as const);
  const figures: HeroFigure[] = [];
  const pipelines: Pipeline[] = [];
  const missing: string[] = [];
  const collectionPeriod = collection.rows[0]?.period ?? '';
  const toiletPeriod = toilets.rows[0]?.period ?? '';
  if (collection.rows.length) {
    const meter = share(collection.supplied, collection.workOrders);
    figures.push({label: 'E-autos supplied', value: collection.supplied, context: `of ${whole(collection.workOrders)} on work orders · ${collectionPeriod}`, meter, tone: tone(meter)});
    pipelines.push({label: 'E-auto procurement', kind: 'flow', period: collectionPeriod, stages: [{label: 'target', value: collection.target}, {label: 'work orders', value: collection.workOrders}, {label: 'supplied', value: collection.supplied}]});
  } else missing.push('E-auto procurement');
  if (toilets.rows.length) {
    const meter = share(toilets.completed, toilets.approved);
    figures.push({label: 'Household toilets completed', value: toilets.completed, context: `of ${whole(toilets.approved)} approved · ${toiletPeriod}`, meter, tone: tone(meter)});
    pipelines.push({label: 'Household toilets', kind: 'flow', period: toiletPeriod, stages: [{label: 'approved', value: toilets.approved}, {label: 'under construction', value: toilets.underConstruction}, {label: 'completed', value: toilets.completed}]});
  } else missing.push('Household toilets');
  if (legacy.rows.length) {
    const meter = share(legacy.achievement, legacy.target);
    figures.push({label: 'Legacy waste cleared', value: legacy.achievement, context: `of ${whole(legacy.target)} source units targeted · ${legacy.period}`, meter, tone: tone(meter)});
    pipelines.push({label: 'Legacy waste', kind: 'split', period: legacy.period, stages: [{label: 'target', value: legacy.target}, {label: 'cleared', value: legacy.achievement}, {label: 'reported balance', value: legacy.balance}]});
  } else missing.push('Legacy waste');
  return {
    eyebrow: period ? 'Pinned period' : 'Latest retained month per programme',
    title: 'Operational Analytics',
    accent: 'delivery, programme by programme.',
    figures,
    pipelines,
    missing,
    periodLabel: period ? (collectionPeriod || toiletPeriod || legacy.period || period) : 'each programme’s latest month',
  };
}

export function readinessHero(): ScreenHeroData & {gates: Array<{title: string; state: string}>} {
  const gates = createProvider('SAMPLE').getReadiness().gates;
  const met = gates.filter((gate) => gate.state === 'met').length;
  const blocked = gates.filter((gate) => gate.state === 'blocked');
  return {
    eyebrow: 'Activation evidence',
    title: 'Data Readiness',
    accent: 'what the evidence can support today.',
    figures: [
      {label: 'Readiness gates met', value: met, suffix: ` of ${gates.length}`, context: 'source access, totals, rural comparison and the ULB crosswalk', meter: share(met, gates.length), tone: 'good'},
      {label: 'Blocked', value: blocked.length, context: blocked.map((gate) => gate.title).join(', ') || 'none', meter: share(blocked.length, gates.length), tone: 'warm'},
      {label: 'Retained governed snapshots', value: governedSnapshots.length, context: 'complete pulls kept as dated evidence, never overwritten'},
    ],
    gates: gates.map((gate) => ({title: gate.title, state: gate.state})),
  };
}

export interface NatureAsset { id: 'green-cover' | 'water-bodies' | 'green-spaces'; label: string; reported: number; target: number; unit: string; period: string }

export function environmentHero(): ScreenHeroData & {pipelines: Pipeline[]; assets: NatureAsset[]; routes: {count: number; detail: string}} {
  const sections = getEnvironmentSections();
  const lines = sections.flatMap((section) => section.lines);
  const line = (id: string) => lines.find((entry) => entry.id === id)!;
  const day = segregationAtSource();
  const legacy = line('legacy-balance'), configured = line('iswm-configured'), completed = line('iswm-completed');
  // Each of these lines reports a quantity in the retained snapshot; a missing one reads as zero here only to keep the hero drawable.
  const legacyQty = legacy.reported ?? 0, configuredQty = configured.reported ?? 0, completedQty = completed.reported ?? 0;
  const routes = new Set(lines.map((entry) => entry.tableKey)).size + 2;
  const atlas = getUlbAtlas();
  const plants = atlas.ulbs.map((ulb) => ulb.cells.stp).filter((cell): cell is AtlasValue => cell?.state === 'value');
  const underWay = plants.reduce((sum, cell) => sum + (cell.count?.done ?? 0), 0);
  const planned = plants.reduce((sum, cell) => sum + (cell.count?.of ?? 0), 0);
  const stpPeriod = atlas.measures.find((measure) => measure.id === 'stp')!.period;
  const dayLabel = formatAtlasDay(day.day);
  return {
    eyebrow: 'Environment and carbon',
    title: 'Environment & Carbon Ledger',
    accent: 'start with what is reported, stop where measurement ends.',
    assets: (['green-cover', 'water-bodies', 'green-spaces'] as const).map((id) => {
      const asset = line(id);
      return {id, label: asset.label, reported: asset.reported ?? 0, target: asset.target ?? 0, unit: asset.unit, period: asset.period ?? ''};
    }),
    figures: [
      {label: 'Households segregating', value: day.segregated, context: `${share(day.segregated, day.collected).toFixed(1)}% of those collected from · ${dayLabel}`, meter: share(day.segregated, day.collected), tone: 'good'},
      {label: 'Processing capacity completed', value: completedQty, suffix: ' TPD', context: `of ${configuredQty.toLocaleString('en-IN')} TPD configured · ${completed.period ?? 'period not stated'}`, meter: share(completedQty, configuredQty), tone: 'warm'},
      {label: 'Legacy waste remaining', value: legacyQty, context: `source units, ${legacy.target === null ? '' : `${share(legacyQty, legacy.target).toFixed(1)}% of the programme · `}${legacy.period ?? ''}`, meter: legacy.target ? share(legacyQty, legacy.target) : undefined, tone: 'warm'},
    ],
    routes: {count: routes, detail: `${routes - 2} snapshots + 2 household feeds`},
    pipelines: [
      {label: 'Households', kind: 'flow', period: dayLabel, stages: [{label: 'in the register', value: day.households}, {label: 'collected from', value: day.collected}, {label: 'segregating', value: day.segregated}]},
      {label: 'Processing capacity (TPD)', kind: 'flow', period: completed.period ?? '', stages: [{label: 'configured', value: configuredQty}, {label: 'reported completed', value: completedQty}]},
      {label: 'Sewage treatment plants', kind: 'split', period: stpPeriod, stages: [{label: 'planned plants', value: planned}, {label: 'work in progress', value: underWay}, {label: 'still to be grounded', value: planned - underWay}]},
    ],
  };
}
