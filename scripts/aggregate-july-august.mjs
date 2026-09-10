/**
 * July against August at gram-panchayat grain, the product's first real period comparison.
 *
 *   node --max-old-space-size=4096 scripts/aggregate-july-august.mjs
 *
 * Built to the contract Codex set out in SECOND_ROUND_2026-09-09.md, because the honest
 * version of this comparison is narrower than the data tempts you to make it.
 *
 * The platform holds 31 days of July and only 7 of August. Comparing a full month against
 * a part month would attribute a calendar artefact to programme performance, so the
 * comparison is restricted to 1-7 of each month, paired on the SAME panchayat and the SAME
 * day-of-month, and a pair is kept only when BOTH sides carry a valid measurement. Full
 * July is reported alongside as context and is never a denominator for August's first week.
 *
 * Both months are deduplicated on the declared key first. The paginator re-serves rows:
 * July's 1,241,643 raw rows carry 401,838 distinct panchayat-days and August's 280,371
 * carry 91,427, with the repeats overwhelmingly spanning pages. Counting raw rows would
 * weight a panchayat-day by how many times the API happened to hand it back.
 *
 * What this CANNOT support, stated in the output rather than left to the reader:
 *   - two months is not a trend, and 1-7 is not a month
 *   - day-of-month pairing does not control for weekday or holiday effects
 *   - neither month's coverage is complete (97.09% and 97.83% of the observed grid)
 *   - a change here is a change in what was reported, not established programme effect
 *
 * Output: data/aggregates/july-august-comparison.json (committed, bundled).
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceNumber, uniqueSourceRecords } from '../lib/record-contract.mjs';

const LARGE = resolve(process.cwd(), 'data/large-snapshots');
const OUT = resolve(process.cwd(), 'data/aggregates');
const WINDOW = 7;                       // days present in the shorter month
const text = (value) => String(value ?? '').trim();
const round = (value) => (value === null ? null : Math.round(value * 100000) / 100000);
const keyOf = (row) => {
  const id = text(row.GRAM_PANCHAYAT_ID);
  const date = text(row.COLLECTION_DATE);
  return id && date ? `${id}|${date}` : null;
};

async function loadMonth(marker) {
  const dir = resolve(LARGE, (await readdir(LARGE)).find((name) => name.includes(marker)) ?? '');
  const manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8'));
  const raw = [];
  for (const file of (await readdir(dir)).filter((name) => /^page-\d+\.json$/.test(name))) {
    raw.push(...(JSON.parse(await readFile(resolve(dir, file), 'utf8')).records ?? []));
  }
  const { records, quality } = uniqueSourceRecords(raw, keyOf);
  return { manifest, records, quality };
}

/** One panchayat-day, reduced to the two measurements and whether each is actually present. */
function reading(row) {
  const collected = text(row.IS_COLLECTED).toLowerCase();
  const segregated = sourceNumber(row.SEGREGATED_WASTE_HOUSEHOLDS);
  return {
    day: Number(text(row.COLLECTION_DATE).slice(8, 10)),
    // Blank is not "No". Only an explicit yes/no is a collection measurement.
    collectedValid: collected === 'yes' || collected === 'no',
    collected: collected === 'yes',
    segregatedValid: segregated !== null,
    segregated: segregated ?? 0,
    district: text(row.DISTRICT_NAME),
  };
}

const july = await loadMonth('MONTH_ID-7');
const august = await loadMonth('MONTH_ID-8');

const index = (records) => {
  const byPair = new Map();
  const gps = new Set();
  for (const row of records) {
    const value = reading(row);
    if (!Number.isInteger(value.day) || value.day > WINDOW) continue;
    const gp = text(row.GRAM_PANCHAYAT_ID);
    gps.add(gp);
    byPair.set(`${gp}|${value.day}`, value);
  }
  return { byPair, gps };
};
const j = index(july.records);
const a = index(august.records);

let eligibleCollection = 0, jCollected = 0, aCollected = 0;
let eligibleSegregation = 0, jSegregated = 0, aSegregated = 0;
let julyOnly = 0, augustOnly = 0, droppedInvalid = 0;
const byDistrict = new Map();

for (const [pair, jv] of j.byPair) {
  const av = a.byPair.get(pair);
  if (!av) { julyOnly += 1; continue; }
  if (jv.collectedValid && av.collectedValid) {
    eligibleCollection += 1;
    if (jv.collected) jCollected += 1;
    if (av.collected) aCollected += 1;
    const name = jv.district || av.district || '(not stated)';
    const bucket = byDistrict.get(name) ?? { pairs: 0, july: 0, august: 0 };
    bucket.pairs += 1;
    if (jv.collected) bucket.july += 1;
    if (av.collected) bucket.august += 1;
    byDistrict.set(name, bucket);
  } else droppedInvalid += 1;
  // A separately matched denominator: segregation is only comparable where BOTH months
  // carry a numeric household count, which is not the same set of pairs as above.
  if (jv.segregatedValid && av.segregatedValid) {
    eligibleSegregation += 1;
    jSegregated += jv.segregated;
    aSegregated += av.segregated;
  }
}
for (const pair of a.byPair.keys()) if (!j.byPair.has(pair)) augustOnly += 1;

const rate = (part, whole) => (whole > 0 ? round(part / whole) : null);
const julyRate = rate(jCollected, eligibleCollection);
const augustRate = rate(aCollected, eligibleCollection);

const out = {
  version: 1,
  grain: 'Gram panchayat · day',
  comparison: { left: '2026-07', right: '2026-08', window: `days 1-${WINDOW} of each month` },
  generatedFrom: {
    '2026-07': { rows: july.manifest.retainedRows, pages: july.manifest.pages, generatedAt: july.manifest.retrievedAt, distinctPanchayatDays: july.quality.uniqueRows },
    '2026-08': { rows: august.manifest.retainedRows, pages: august.manifest.pages, generatedAt: august.manifest.retrievedAt, distinctPanchayatDays: august.quality.uniqueRows },
  },
  recordQuality: { '2026-07': july.quality, '2026-08': august.quality },
  pairing: {
    key: 'GRAM_PANCHAYAT_ID | day-of-month',
    eligibleCollectionPairs: eligibleCollection,
    eligibleSegregationPairs: eligibleSegregation,
    droppedForInvalidMeasure: droppedInvalid,
    julyOnlyPanchayatDays: julyOnly,
    augustOnlyPanchayatDays: augustOnly,
    panchayatsJuly: j.gps.size,
    panchayatsAugust: a.gps.size,
  },
  collection: {
    julyRate, augustRate,
    changePercentagePoints: julyRate === null || augustRate === null ? null : round((augustRate - julyRate) * 100),
  },
  segregation: {
    julyHouseholdsPerPanchayatDay: rate(jSegregated, eligibleSegregation),
    augustHouseholdsPerPanchayatDay: rate(aSegregated, eligibleSegregation),
  },
  julyFullMonthContext: {
    distinctPanchayatDays: july.quality.uniqueRows,
    days: 31,
    note: 'Context only. Never a denominator for August, which the platform holds for seven days.',
  },
  boundary: `Days 1-${WINDOW} of July and August 2026, paired on the same gram panchayat and day-of-month, keeping a pair only where both months carry a valid measurement. Two months is not a trend and seven days is not a month. Day-of-month pairing does not control for weekday or holiday effects. Neither month is completely covered — July holds 97.09% and August 97.83% of its observed panchayat-by-day grid — so a change here is a change in what was reported, not an established programme effect.`,
  byDistrict: [...byDistrict.entries()].sort((left, right) => left[0].localeCompare(right[0])).map(([district, bucket]) => {
    // Derive the change from the PUBLISHED rates, not the raw counts. The rates are
    // rounded for publication, so a change computed from the counts would not equal the
    // difference a reader gets from the two numbers on screen.
    const julyDistrict = rate(bucket.july, bucket.pairs);
    const augustDistrict = rate(bucket.august, bucket.pairs);
    return {
      district,
      pairs: bucket.pairs,
      julyRate: julyDistrict,
      augustRate: augustDistrict,
      changePercentagePoints: julyDistrict === null || augustDistrict === null ? null : round((augustDistrict - julyDistrict) * 100),
    };
  }),
};

await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, 'july-august-comparison.json'), `${JSON.stringify(out)}\n`, 'utf8');
console.log(`July vs August, days 1-${WINDOW}, paired on panchayat and day-of-month:`);
console.log(`  eligible pairs   : ${eligibleCollection.toLocaleString('en-IN')} collection · ${eligibleSegregation.toLocaleString('en-IN')} segregation`);
console.log(`  unmatched        : ${julyOnly.toLocaleString('en-IN')} July-only · ${augustOnly.toLocaleString('en-IN')} August-only · ${droppedInvalid.toLocaleString('en-IN')} invalid measure`);
console.log(`  collection rate  : July ${(julyRate * 100).toFixed(2)}% -> August ${(augustRate * 100).toFixed(2)}%  (${out.collection.changePercentagePoints > 0 ? '+' : ''}${out.collection.changePercentagePoints} pp)`);
console.log(`  districts        : ${out.byDistrict.length}`);
