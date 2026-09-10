/**
 * The monthly series at gram-panchayat grain, every month retained, compared honestly.
 *
 *   node --max-old-space-size=6144 scripts/aggregate-month-series.mjs
 *
 * Supersedes aggregate-july-august.mjs, which could only hold two months.
 *
 * The platform holds four months of this export and they are not the same length: May 31
 * days, June 30, July 31, August only 7. A series across months of different lengths is
 * the easiest way to publish a calendar artefact as programme performance, so this
 * reports two things and keeps them apart:
 *
 *   1. COMPARABLE, every month restricted to days 1..N, where N is the shortest month
 *      retained (7, set by August). Panchayat-days are paired on the same panchayat and
 *      the same day-of-month across every month in the series, and a panchayat is kept
 *      only where it carries a valid measurement in ALL of them. One cohort, one window.
 *   2. CONTEXT, each month's own rate over its own days, explicitly not comparable
 *      because the denominators differ.
 *
 * Every month is deduplicated on the declared key first. The paginator is stable (offset
 * 5,000 fetched three times returns identical rows), so the 1-46x multiplicity is the
 * source repeating itself rather than pages being re-served, but a panchayat-day handed
 * back three times is still one panchayat-day, and counting raw rows would weight it by
 * how often the source happens to repeat it.
 *
 * What this still cannot support, stated in the output rather than left to the reader:
 *   - day-of-month pairing does not control for weekday or holiday effects
 *   - no month is completely covered; observed-grid coverage is published per month
 *   - a change is a change in what was reported, not established programme effect
 *   - three or four points is a short series, and August contributes only its first week
 *
 * Output: data/aggregates/month-series.json (committed, bundled).
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceNumber, uniqueSourceRecords } from '../lib/record-contract.mjs';

const LARGE = resolve(process.cwd(), 'data/large-snapshots');
const OUT = resolve(process.cwd(), 'data/aggregates');
const text = (value) => String(value ?? '').trim();
const round = (value) => (value === null ? null : Math.round(value * 100000) / 100000);
const rate = (part, whole) => (whole > 0 ? round(part / whole) : null);
const keyOf = (row) => {
  const id = text(row.GRAM_PANCHAYAT_ID);
  const date = text(row.COLLECTION_DATE);
  return id && date ? `${id}|${date}` : null;
};

/** Every completed MONTH_ID-N pull on disk, newest month last. */
async function retainedMonths() {
  // A month may be spread over several directories: one whole-month offset pull, plus any
  // per-district pulls used to finish it. They are merged and deduplicated on the declared
  // key, so overlap between them collapses rather than double-counting.
  const byPeriod = new Map();
  for (const name of await readdir(LARGE)) {
    const match = /__(?=.*MONTH_ID-(\d+))(?=.*YEAR-(\d+))/.exec(name);
    if (!match) continue;
    const dir = resolve(LARGE, name);
    let manifest;
    try {
      manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8'));
    } catch { continue; }  // still pulling — no manifest, so not complete
    const period = `${match[2]}-${String(match[1]).padStart(2, '0')}`;
    if (!byPeriod.has(period)) byPeriod.set(period, { month: Number(match[1]), year: Number(match[2]), dirs: [], manifests: [] });
    byPeriod.get(period).dirs.push(dir);
    byPeriod.get(period).manifests.push(manifest);
  }
  return [...byPeriod.values()]
    .map((entry) => ({
      ...entry,
      manifest: {
        retainedRows: entry.manifests.reduce((n, m) => n + (m.retainedRows ?? 0), 0),
        pages: entry.manifests.reduce((n, m) => n + (m.pages ?? 0), 0),
        retrievedAt: entry.manifests.map((m) => m.retrievedAt).sort().pop(),
        parts: entry.manifests.length,
      },
    }))
    .sort((left, right) => left.year - right.year || left.month - right.month);
}

/** Blank is not "No", and a blank household count is not zero. */
function reading(row) {
  const collected = text(row.IS_COLLECTED).toLowerCase();
  const segregated = sourceNumber(row.SEGREGATED_WASTE_HOUSEHOLDS);
  return {
    day: Number(text(row.COLLECTION_DATE).slice(8, 10)),
    collectedValid: collected === 'yes' || collected === 'no',
    collected: collected === 'yes',
    segregatedValid: segregated !== null,
    segregated: segregated ?? 0,
    district: text(row.DISTRICT_NAME),
  };
}

const months = await retainedMonths();
if (months.length < 2) {
  console.log(`Only ${months.length} completed month pull(s) on disk. A series needs at least two.`);
  process.exit(0);
}

// Load one month at a time and keep only what the series needs, so four months of raw
// pages never sit in memory together.
const loaded = [];
for (const entry of months) {
  const raw = [];
  for (const dir of entry.dirs) {
    for (const file of (await readdir(dir)).filter((name) => /^page-\d+\.json$/.test(name))) {
      raw.push(...(JSON.parse(await readFile(resolve(dir, file), 'utf8')).records ?? []));
    }
  }
  const { records, quality } = uniqueSourceRecords(raw, keyOf);
  const days = new Set();
  const gps = new Set();
  const window = new Map();
  let fullValid = 0, fullCollected = 0;
  for (const row of records) {
    const value = reading(row);
    if (!Number.isInteger(value.day)) continue;
    days.add(value.day);
    gps.add(text(row.GRAM_PANCHAYAT_ID));
    if (value.collectedValid) { fullValid += 1; if (value.collected) fullCollected += 1; }
    window.set(`${text(row.GRAM_PANCHAYAT_ID)}|${value.day}`, value);
  }
  loaded.push({ ...entry, quality, days, gps, window, fullValid, fullCollected, distinct: quality.uniqueRows });
  console.log(`  loaded ${entry.year}-${String(entry.month).padStart(2, '0')}: ${quality.rawRows.toLocaleString('en-IN')} raw -> ${quality.uniqueRows.toLocaleString('en-IN')} distinct, ${days.size} days`);
}

// The comparable window is bounded by the shortest month retained.
const windowDays = Math.min(...loaded.map((entry) => entry.days.size));
const label = (entry) => `${entry.year}-${String(entry.month).padStart(2, '0')}`;

// A pair survives only where every month carries a valid measurement for that panchayat
// and day. One cohort across the whole series, not a different cohort per comparison.
const [first, ...rest] = loaded;
const cohortKeys = [];
for (const [pair, value] of first.window) {
  if (value.day > windowDays || !value.collectedValid) continue;
  if (rest.every((entry) => { const other = entry.window.get(pair); return other && other.day <= windowDays && other.collectedValid; })) cohortKeys.push(pair);
}

const districtOf = new Map();
for (const pair of cohortKeys) districtOf.set(pair, first.window.get(pair).district || '(not stated)');
const districts = [...new Set(districtOf.values())].sort();

// The cohort indexed by day-of-month. Reported collection has a weekly shape - every
// retained Sunday reports near zero - so a screen has to be able to separate the days
// collection was scheduled from the days it was not. Publishing the days rather than a
// holiday flag keeps that judgement in the open, where it can be labelled and argued with.
const cohortByDay = new Map();
for (const pair of cohortKeys) {
  const day = first.window.get(pair).day;
  if (!cohortByDay.has(day)) cohortByDay.set(day, []);
  cohortByDay.get(day).push(pair);
}
const cohortDays = [...cohortByDay.keys()].sort((a, b) => a - b);

const series = loaded.map((entry) => {
  let collected = 0, segregated = 0, segValid = 0;
  for (const pair of cohortKeys) {
    const value = entry.window.get(pair);
    if (value.collected) collected += 1;
    if (value.segregatedValid) { segregated += value.segregated; segValid += 1; }
  }
  return {
    period: label(entry),
    daysRetained: entry.days.size,
    distinctPanchayatDays: entry.distinct,
    observedGridCoverage: round(entry.distinct / (entry.gps.size * entry.days.size)),
    comparable: { pairs: cohortKeys.length, collected, collectionRate: rate(collected, cohortKeys.length), segregatedPerPanchayatDay: rate(segregated, segValid) },
    comparableByDay: cohortDays.map((day) => {
      const pairs = cohortByDay.get(day);
      let hit = 0;
      for (const pair of pairs) if (entry.window.get(pair).collected) hit += 1;
      return { day, pairs: pairs.length, collected: hit, collectionRate: rate(hit, pairs.length) };
    }),
    context: { validPanchayatDays: entry.fullValid, collectionRate: rate(entry.fullCollected, entry.fullValid) },
  };
});

const byDistrict = districts.map((district) => {
  const pairs = cohortKeys.filter((pair) => districtOf.get(pair) === district);
  const byDay = new Map();
  for (const pair of pairs) {
    const day = first.window.get(pair).day;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(pair);
  }
  const points = loaded.map((entry) => {
    const collected = pairs.reduce((n, pair) => n + (entry.window.get(pair).collected ? 1 : 0), 0);
    return {
      period: label(entry),
      collectionRate: rate(collected, pairs.length),
      // Carried per day so a district reads on the same basis as the statewide headline.
      byDay: cohortDays.map((day) => {
        const forDay = byDay.get(day) ?? [];
        let hit = 0;
        for (const pair of forDay) if (entry.window.get(pair).collected) hit += 1;
        return { day, pairs: forDay.length, collected: hit };
      }),
    };
  });
  const open = points[0].collectionRate;
  const close = points[points.length - 1].collectionRate;
  return {
    district, pairs: pairs.length, points,
    changePercentagePoints: open === null || close === null ? null : round((close - open) * 100),
  };
});

const out = {
  version: 1,
  grain: 'Gram panchayat · day',
  periods: loaded.map(label),
  comparableWindow: `days 1-${windowDays} of every month, set by the shortest retained month`,
  cohort: {
    key: 'GRAM_PANCHAYAT_ID | day-of-month',
    pairs: cohortKeys.length,
    rule: 'A panchayat-day is in the cohort only where every month in the series carries a valid collection measurement for it.',
  },
  generatedFrom: Object.fromEntries(loaded.map((entry) => [label(entry), {
    rows: entry.manifest.retainedRows, pages: entry.manifest.pages,
    generatedAt: entry.manifest.retrievedAt, distinctPanchayatDays: entry.distinct,
  }])),
  recordQuality: Object.fromEntries(loaded.map((entry) => [label(entry), entry.quality])),
  series,
  byDistrict,
  boundary: `Days 1-${windowDays} of ${loaded.map(label).join(', ')}, one cohort of ${cohortKeys.length.toLocaleString('en-IN')} panchayat-days present with a valid measurement in every month. Months of different lengths are never compared on their own denominators — those appear as context only. Every seven-day window holds exactly one Sunday, so the periods stay comparable, but the blended rate sits below the rate on days collection was scheduled; comparableByDay carries each day separately. No month is completely covered, and a change here is a change in what was reported rather than an established programme effect.`,
};

await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, 'month-series.json'), `${JSON.stringify(out)}\n`, 'utf8');
console.log(`\nSeries: ${out.periods.join(' -> ')}  ·  days 1-${windowDays}  ·  ${cohortKeys.length.toLocaleString('en-IN')} paired panchayat-days`);
for (const entry of series) console.log(`  ${entry.period}  comparable ${(entry.comparable.collectionRate * 100).toFixed(2)}%   (context, own ${entry.daysRetained} days: ${(entry.context.collectionRate * 100).toFixed(2)}%)`);
const movers = byDistrict.filter((d) => d.changePercentagePoints !== null).sort((a, b) => Math.abs(b.changePercentagePoints) - Math.abs(a.changePercentagePoints)).slice(0, 5);
console.log('  largest first-to-last district moves:');
for (const d of movers) console.log(`    ${d.district.padEnd(24)} ${d.points.map((p) => (p.collectionRate * 100).toFixed(1) + '%').join(' -> ')}  (${d.changePercentagePoints > 0 ? '+' : ''}${d.changePercentagePoints} pp, ${d.pairs.toLocaleString('en-IN')} pairs)`);
