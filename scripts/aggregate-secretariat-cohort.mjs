/**
 * The first cohort in this product with a verified shared identity.
 *
 *   node scripts/aggregate-secretariat-cohort.mjs
 *
 * `msw_door_to_door_collection_api` and `waste_egregation_api` both report every
 * secretariat on 2026-08-12, keyed by a numeric `sachivalayam_code` rather than a name.
 * On that day the two agree exactly: 4,023 codes in both, none in only one, and the
 * household denominator matches on every single one. Nothing here is name-matched, so
 * nothing here rests on an inference.
 *
 * That makes a pairing possible that the rest of the product cannot do: collection
 * coverage against the share of collected waste that was segregated, same entities,
 * same day, same denominator. It is emphatically NOT a performance score, one day is
 * not a performance basis and no scoring policy exists, so the output carries positions
 * and the gates they clear, never a rank.
 *
 * Output: data/aggregates/secretariat-cohort.json (committed, bundled).
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadUrbanSource } from './urban-sources.mjs';

const OUT = resolve(process.cwd(), 'data/aggregates');
const DAY = '2026-08-12';
const COLLECTION = 'msw_door_to_door_collection_api';
const SEGREGATION = 'waste_egregation_api';

const num = (value) => { const n = Number(String(value ?? '').replace(/,/g, '')); return Number.isFinite(n) && n >= 0 ? n : null; };
const round = (value) => value === null ? null : Math.round(value * 10000) / 10000;

/** One row per secretariat. Identical repeats collapse; disagreeing repeats are held out. */
function byCode(rows, fields) {
  const groups = new Map();
  for (const row of rows) {
    const code = String(row.sachivalayam_code ?? '').trim();
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(row);
  }
  const kept = new Map();
  let disputed = 0;
  for (const [code, group] of groups) {
    const signatures = new Set(group.map((row) => JSON.stringify(fields.map((field) => String(row[field] ?? '').trim()))));
    if (signatures.size > 1) { disputed += 1; continue; }
    kept.set(code, group[0]);
  }
  return { kept, disputed, returned: groups.size };
}

async function main() {
  const collection = await loadUrbanSource(COLLECTION);
  const segregation = await loadUrbanSource(SEGREGATION);

  const collectionDay = collection.rows.filter((row) => row.date1 === DAY);
  const segregationDay = segregation.rows.filter((row) => row.date1 === DAY);
  const left = byCode(collectionDay, ['total_households', 'collected_households']);
  const right = byCode(segregationDay, ['total_households', 'garbage_segregation']);

  const points = [];
  let denominatorConflicts = 0;
  let unmatched = 0;
  let noCollection = 0;

  for (const [code, collected] of left.kept) {
    const segregated = right.kept.get(code);
    if (!segregated) { unmatched += 1; continue; }

    const households = num(collected.total_households);
    const otherHouseholds = num(segregated.total_households);
    // Two sources must agree on the denominator before either ratio means anything.
    if (households === null || households !== otherHouseholds) { denominatorConflicts += 1; continue; }

    const collectedHouseholds = num(collected.collected_households);
    const segregatedHouseholds = num(segregated.garbage_segregation);
    if (collectedHouseholds === null || segregatedHouseholds === null || households === 0) { noCollection += 1; continue; }

    points.push({
      code,
      district: String(collected.district_name ?? '').trim(),
      ulb: String(collected.ulb_name ?? '').trim(),
      households,
      collected: collectedHouseholds,
      segregated: segregatedHouseholds,
    });
  }

  const reporting = points.filter((point) => point.collected > 0);
  const containmentBreaches = points.filter((point) => point.segregated > point.collected).length;
  const totals = points.reduce((sum, point) => ({
    households: sum.households + point.households,
    collected: sum.collected + point.collected,
    segregated: sum.segregated + point.segregated,
  }), { households: 0, collected: 0, segregated: 0 });

  const manifest = {
    version: 1,
    day: DAY,
    grain: 'Secretariat',
    generatedFrom: {
      [COLLECTION]: collection.provenance,
      [SEGREGATION]: segregation.provenance,
    },
    identity: {
      key: 'sachivalayam_code',
      collectionCodes: left.returned,
      segregationCodes: right.returned,
      matched: points.length + noCollection,
      unmatched,
      disputedWithinCollection: left.disputed,
      disputedWithinSegregation: right.disputed,
      denominatorConflicts,
    },
    cohort: points.length,
    reporting: reporting.length,
    silent: points.length - reporting.length,
    containmentBreaches,
    totals,
    collectionCoverage: totals.households > 0 ? round(totals.collected / totals.households) : null,
    segregationCoverage: totals.households > 0 ? round(totals.segregated / totals.households) : null,
    segregationOfCollected: totals.collected > 0 ? round(totals.segregated / totals.collected) : null,
    boundary: 'One reported day, joined on a numeric secretariat code present in both sources. Identity, period and freshness are established; performance is not. A single day is not a basis for scoring, and no scoring policy has been approved.',
    points,
  };

  // One object per secretariat, with repeated keys and repeated district/ULB strings, was
  // ~486KB at 3,020 secretariats, a quarter of the whole client bundle. The same data as string tables plus tuple
  // rows is a fifth of that, and the ratios are trivially recomputed on read.
  const districts = [...new Set(points.map((point) => point.district))].sort();
  const ulbs = [...new Set(points.map((point) => point.ulb))].sort();
  const districtIndex = new Map(districts.map((name, index) => [name, index]));
  const ulbIndex = new Map(ulbs.map((name, index) => [name, index]));
  manifest.districts = districts;
  manifest.ulbs = ulbs;
  manifest.pointFields = ['code', 'district', 'ulb', 'households', 'collected', 'segregated'];
  manifest.points = points.map((point) => [
    point.code, districtIndex.get(point.district), ulbIndex.get(point.ulb),
    point.households, point.collected, point.segregated,
  ]);

  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, 'secretariat-cohort.json'), `${JSON.stringify(manifest)}\n`, 'utf8');
  console.log(`Cohort on ${DAY}: ${points.length} secretariats (${reporting.length} reporting collection).`);
  console.log(`  identity: ${left.returned} / ${right.returned} codes · ${unmatched} unmatched · ${denominatorConflicts} denominator conflicts · ${left.disputed + right.disputed} disputed`);
  console.log(`  containment breaches (segregated > collected): ${containmentBreaches}`);
  console.log('  data/aggregates/secretariat-cohort.json');
}

await main();
