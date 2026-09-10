/**
 * The ULB service matrix across every retained day, not just the reference day.
 *
 *   node --max-old-space-size=4096 scripts/aggregate-ulb-service-series.mjs
 *
 * `aggregate-ulb-service.mjs` builds one carefully verified day (2026-08-12). Both source
 * exports actually hold sixteen, 12 to 27 August 2026, so the single day was an
 * aggregation choice, not a limit of the evidence.
 *
 * Sixteen days is the difference between a dot and a diagnosis. A ULB sitting at 16%
 * collection on one day cannot be distinguished from a ULB that had one bad day; across
 * sixteen it can. That is precisely the gate `lib/secretariat-cohort.ts` names as shut:
 * "One reported day. A single day describes a day; it does not establish how an entity
 * performs." This does not open it by itself, no policy thresholds are approved, and the
 * references below stay explicitly draft, but it removes the evidentiary half of it.
 *
 * This REUSES buildUlbServiceSnapshot rather than reimplementing it, so every identity,
 * containment and denominator assertion Codex wrote applies unchanged to all sixteen days.
 * A day that fails those assertions is reported and skipped, never silently dropped.
 *
 * Output: data/aggregates/ulb-service-series.json. The single-day snapshot it complements
 * is left byte-identical, so the existing screen is unaffected.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildUlbServiceSnapshot, serviceSources } from './aggregate-ulb-service.mjs';

/** Draft analytical references, matching the existing screen. Not departmental targets. */
const REFERENCE = { collection: 0.8, segregation: 0.8 };
const round = (value) => (value === null ? null : Math.round(value * 10000) / 10000);
const rate = (part, whole) => (whole > 0 ? round(part / whole) : null);

const sources = [];
for (const key of serviceSources) {
  const dir = resolve('data/large-snapshots', key);
  const manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8'));
  const files = (await readdir(dir)).filter((f) => /^page-.*\.json$/.test(f)).sort();
  const rows = [];
  const hash = createHash('sha256');
  for (const file of files) {
    const text = await readFile(resolve(dir, file), 'utf8');
    hash.update(file).update(text);
    rows.push(...JSON.parse(text).records);
  }
  sources.push({ key, rows, provenance: { generatedAt: manifest.retrievedAt, rows: rows.length, pages: files.length, sha256: hash.digest('hex') } });
}

const days = [...new Set(sources[0].rows.map((row) => row.date1).filter(Boolean))].sort();
console.log(`  ${days.length} retained day(s): ${days[0]} .. ${days[days.length - 1]}`);

const built = [];
const withheld = [];
for (const day of days) {
  try {
    built.push({ day, snapshot: buildUlbServiceSnapshot(sources[0].rows, sources[1].rows, day) });
  } catch (error) {
    // The assertions are the point. A day that cannot be verified is named, not dropped.
    withheld.push({ day, reason: String(error.message).replace('ULB snapshot withheld: ', '') });
  }
}
console.log(`  built ${built.length} day(s); withheld ${withheld.length}`);
for (const entry of withheld) console.log(`    ${entry.day}: ${entry.reason}`);
if (!built.length) { console.log('No day passed verification; nothing written.'); process.exit(0); }

// One ULB roster across the whole window, so a ULB absent on a day is visibly absent
// rather than quietly renumbering the series.
const roster = new Map();
for (const { snapshot } of built) {
  for (const ulb of snapshot.ulbs) {
    if (!roster.has(ulb.code)) roster.set(ulb.code, { code: ulb.code, name: ulb.name, district: ulb.district });
  }
}
const ulbs = [...roster.values()].sort((left, right) => left.name.localeCompare(right.name));
const index = new Map(ulbs.map((ulb, position) => [ulb.code, position]));

const series = {};
for (const { day, snapshot } of built) {
  const row = ulbs.map(() => null);
  for (const ulb of snapshot.ulbs) {
    // Mirror the single-day screen: a ULB whose native and enriched codes disagree is
    // held out of the matrix rather than plotted on an unverified identity.
    if (ulb.mappingReviewSecretariats > 0) continue;
    row[index.get(ulb.code)] = [ulb.households, ulb.collected, ulb.segregated];
  }
  series[day] = row;
}

/** Where a ULB sits over the whole window, and how steadily. */
const stability = ulbs.map((ulb, position) => {
  const observed = built
    .map(({ day }) => ({ day, cell: series[day][position] }))
    .filter((entry) => entry.cell !== null);
  const collectionRates = [], segregationRates = [];
  let aboveCollection = 0, aboveSegregation = 0, zeroCollectionDays = 0;
  for (const { cell } of observed) {
    const [households, collected, segregated] = cell;
    const coverage = rate(collected, households);
    const segregation = rate(segregated, collected);
    if (coverage !== null) { collectionRates.push(coverage); if (coverage >= REFERENCE.collection) aboveCollection += 1; }
    if (segregation === null) zeroCollectionDays += 1;
    else { segregationRates.push(segregation); if (segregation >= REFERENCE.segregation) aboveSegregation += 1; }
  }
  const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
  };
  const span = (values) => (values.length ? { low: round(Math.min(...values)), high: round(Math.max(...values)) } : null);
  return {
    code: ulb.code,
    daysObserved: observed.length,
    daysPossible: built.length,
    zeroCollectionDays,
    collection: { median: median(collectionRates), ...(span(collectionRates) ?? { low: null, high: null }), daysAtOrAboveReference: aboveCollection },
    segregation: { median: median(segregationRates), ...(span(segregationRates) ?? { low: null, high: null }), daysAtOrAboveReference: aboveSegregation },
    // The reading a single day cannot give: is this position characteristic or incidental?
    consistentlyBelowCollection: collectionRates.length > 0 && aboveCollection === 0,
    consistentlyBelowSegregation: segregationRates.length > 0 && aboveSegregation === 0,
  };
});

const out = {
  version: 1,
  grain: 'ULB · Day',
  identityKey: 'native ulb_code; paired on sachivalayam_code + date1',
  days: built.map((entry) => entry.day),
  daysWithheld: withheld,
  references: REFERENCE,
  ulbFields: ['code', 'name', 'district'],
  ulbs: ulbs.map((ulb) => [ulb.code, ulb.name, ulb.district]),
  cellFields: ['households', 'collected', 'segregated'],
  series,
  stability,
  generatedFrom: Object.fromEntries(sources.map((source) => [source.key, source.provenance])),
  boundary: `${built.length} source-reported days, ${built[0].day} to ${built[built.length - 1].day}. Every day is built by the same verified single-day derivation, so identity, containment and denominator assertions hold per day; a day that fails them is listed in daysWithheld rather than dropped. A ULB whose native and enriched codes disagree is held out of the matrix on that day. References are draft analytical lines, not departmental targets, so nothing here is an official performance classification. A longer window establishes whether a position is characteristic; it does not establish cause.`,
};

await writeFile(resolve('data/aggregates/ulb-service-series.json'), `${JSON.stringify(out)}\n`, 'utf8');
const consistent = stability.filter((entry) => entry.consistentlyBelowCollection).length;
console.log(`\n  ${ulbs.length} ULBs across ${built.length} days`);
console.log(`  ${consistent} ULB(s) below the collection reference on every observed day`);
