/**
 * The rural cohort: infrastructure against activity.
 *
 *   node scripts/aggregate-rural-cohort.mjs
 *
 * Two PR sources join on a numeric GRAM_PANCHAYAT_ID with nothing inferred: the SWPC
 * register (does this panchayat have a solid-waste processing centre, and does it work)
 * and the August collection export (did it collect, and how many households segregated).
 * All 12,874 registered panchayats appear in the collection data.
 *
 * That is a cleaner pairing than the urban cohort. There, collection and segregation are
 * both activities. Here the register is infrastructure and the collection export is what
 * happened, which is the implementation-versus-delivery shape the Gap Radar was specified
 * for in the first place.
 *
 * Two honest limits are carried in the output rather than smoothed over. The register has
 * NO date column, so whether it describes August is unknown — it is a state of unknown
 * currency, not an August fact. And 2026-08-02 reports at 2% against 70-93% on the other
 * six days, so it is identified and excluded from the rate rather than dragging it down.
 *
 * Output: data/aggregates/rural-cohort.json (committed, bundled).
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LARGE = resolve(process.cwd(), 'data/large-snapshots');
const OUT = resolve(process.cwd(), 'data/aggregates');
const SWPC = 'sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api_27_aug_2026';

const text = (value) => String(value ?? '').trim();
const num = (value) => { const n = Number(text(value).replace(/,/g, '')); return Number.isFinite(n) && n >= 0 ? n : null; };
const round = (value) => value === null ? null : Math.round(value * 10000) / 10000;
/** A day where almost nothing reported is a reporting outage, not a day of no collection. */
const OUTAGE_FLOOR = 0.2;

async function main() {
  const collectionDir = resolve(LARGE, (await readdir(LARGE)).find((name) => name.includes('MONTH_ID-8')) ?? '');
  if (!existsSync(resolve(collectionDir, 'manifest.json'))) { console.log('August collection pull is not complete.'); return; }
  const manifest = JSON.parse(await readFile(resolve(collectionDir, 'manifest.json'), 'utf8'));
  const collection = [];
  for (const file of (await readdir(collectionDir)).filter((f) => f.startsWith('page-'))) {
    collection.push(...(JSON.parse(await readFile(resolve(collectionDir, file), 'utf8')).records ?? []));
  }
  const swpcEnvelope = JSON.parse(await readFile(resolve(LARGE, `${SWPC}.json`), 'utf8'));

  // The register: one row per panchayat, identical repeats collapsed, disagreement held out.
  const register = new Map();
  let registerDisputed = 0;
  const registerGroups = new Map();
  for (const row of swpcEnvelope.records) {
    const id = text(row.GRAM_PANCHAYAT_ID);
    if (!id) continue;
    if (!registerGroups.has(id)) registerGroups.set(id, []);
    registerGroups.get(id).push(row);
  }
  for (const [id, group] of registerGroups) {
    const signatures = new Set(group.map((row) => `${text(row.GP_HAVING_SWPC)}|${text(row.WORKING_CONDITION)}`));
    if (signatures.size > 1) { registerDisputed += 1; continue; }
    register.set(id, group[0]);
  }

  // Which days are usable. A day reporting far below the others is an outage.
  const byDate = new Map();
  for (const row of collection) {
    const date = text(row.COLLECTION_DATE);
    const day = byDate.get(date) ?? { rows: 0, collected: 0 };
    day.rows += 1;
    if (text(row.IS_COLLECTED).toLowerCase() === 'yes') day.collected += 1;
    byDate.set(date, day);
  }
  const days = [...byDate.entries()].map(([date, day]) => ({
    date, rows: day.rows, collectedRows: day.collected,
    reportingRatio: day.rows ? day.collected / day.rows : 0,
  })).sort((a, b) => a.date.localeCompare(b.date));
  const usableDays = days.filter((day) => day.reportingRatio >= OUTAGE_FLOOR);
  const outageDays = days.filter((day) => day.reportingRatio < OUTAGE_FLOOR);
  const usable = new Set(usableDays.map((day) => day.date));

  // Per panchayat, over the usable days only.
  const activity = new Map();
  for (const row of collection) {
    if (!usable.has(text(row.COLLECTION_DATE))) continue;
    const id = text(row.GRAM_PANCHAYAT_ID);
    if (!id) continue;
    const entry = activity.get(id) ?? { days: 0, collectedDays: 0, segregated: 0, district: text(row.DISTRICT_NAME), block: text(row.BLOCK_NAME), name: text(row.GRAM_PANCHAYAT_NAME) };
    entry.days += 1;
    if (text(row.IS_COLLECTED).toLowerCase() === 'yes') entry.collectedDays += 1;
    entry.segregated += num(row.SEGREGATED_WASTE_HOUSEHOLDS) ?? 0;
    activity.set(id, entry);
  }

  const points = [];
  let registeredWithoutActivity = 0;
  for (const [id, entry] of register) {
    const act = activity.get(id);
    if (!act || act.days === 0) { registeredWithoutActivity += 1; continue; }
    const hasCentre = text(entry.GP_HAVING_SWPC).toLowerCase();
    points.push({
      id,
      name: act.name,
      district: act.district,
      block: act.block,
      // Infrastructure as the register states it. Blank is "not stated", never "No".
      hasCentre: hasCentre === 'yes' ? true : hasCentre === 'no' ? false : null,
      condition: text(entry.WORKING_CONDITION) || null,
      days: act.days,
      collectedDays: act.collectedDays,
      segregatedHouseholds: act.segregated,
    });
  }

  const withCentre = points.filter((point) => point.hasCentre === true);
  const withoutCentre = points.filter((point) => point.hasCentre === false);
  const rate = (group) => {
    const days = group.reduce((sum, point) => sum + point.days, 0);
    const collected = group.reduce((sum, point) => sum + point.collectedDays, 0);
    return days > 0 ? round(collected / days) : null;
  };

  const districts = [...new Set(points.map((point) => point.district))].sort();

  /** One group's reported activity. Rates are over panchayat-days actually reported. */
  const summarise = (group) => {
    const days = group.reduce((sum, point) => sum + point.days, 0);
    const collected = group.reduce((sum, point) => sum + point.collectedDays, 0);
    const segregated = group.reduce((sum, point) => sum + point.segregatedHouseholds, 0);
    return {
      panchayats: group.length,
      panchayatDays: days,
      collectionRate: days > 0 ? round(collected / days) : null,
      segregatedPerPanchayatDay: days > 0 ? round(segregated / days) : null,
      anySegregation: group.length > 0 ? round(group.filter((point) => point.segregatedHouseholds > 0).length / group.length) : null,
    };
  };

  const out = {
    version: 1,
    month: '2026-08',
    grain: 'Gram panchayat',
    generatedFrom: {
      [manifest.tableKey]: { generatedAt: manifest.retrievedAt, rows: manifest.retainedRows, pages: manifest.pages, filters: manifest.filters },
      [SWPC]: { generatedAt: swpcEnvelope.responseMetadata.generatedAt, rows: swpcEnvelope.records.length, responseId: swpcEnvelope.responseMetadata.responseId },
    },
    identity: {
      key: 'GRAM_PANCHAYAT_ID',
      registered: register.size,
      matched: points.length,
      registeredWithoutActivity,
      registerDisputed,
      activityOnlyPanchayats: activity.size - points.length,
    },
    days, usableDays: usableDays.map((day) => day.date), outageDays: outageDays.map((day) => day.date),
    cohort: points.length,
    withCentre: withCentre.length,
    withoutCentre: withoutCentre.length,
    centreNotStated: points.filter((point) => point.hasCentre === null).length,
    collectionRateWithCentre: rate(withCentre),
    collectionRateWithoutCentre: rate(withoutCentre),
    // The register carries no date, so it is a state of unknown currency — not an
    // August fact. Every reading below inherits that limit.
    registerCurrency: 'unknown — the SWPC register has no date column',
    boundary: 'Infrastructure as a dated-less register, activity over six reported days of August 2026, joined on a numeric gram panchayat id with nothing inferred. Identity and denominator are established; the register’s currency is not, and no scoring policy exists.',
    districts,
    // Per-panchayat points are deliberately NOT shipped. The comparison below shows no
    // relationship between the register and the activity, so 12,874 plotted points would
    // be a shapeless cloud that implies one. The group comparison is the finding; a
    // scatter would be decoration over a null result.
    groups: [
      { id: 'with-centre', label: 'Registered with a processing centre', ...summarise(withCentre) },
      { id: 'without-centre', label: 'Registered without one', ...summarise(withoutCentre) },
      { id: 'not-stated', label: 'Register does not state', ...summarise(points.filter((point) => point.hasCentre === null)) },
    ],
    byCondition: [...new Set(points.map((point) => point.condition))]
      .filter(Boolean).sort()
      .map((condition) => ({ condition, ...summarise(points.filter((point) => point.condition === condition)) }))
      .concat([{ condition: null, ...summarise(points.filter((point) => !point.condition)) }]),
    byDistrict: districts.map((name) => ({ district: name, ...summarise(points.filter((point) => point.district === name)) })),
  };

  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, 'rural-cohort.json'), `${JSON.stringify(out)}\n`, 'utf8');
  console.log(`Rural cohort: ${points.length.toLocaleString('en-IN')} gram panchayats over ${usableDays.length} usable days.`);
  console.log(`  identity: ${register.size} registered · ${points.length} matched · ${registeredWithoutActivity} without activity · ${registerDisputed} disputed`);
  console.log(`  outage days excluded: ${outageDays.map((d) => d.date).join(', ') || 'none'}`);
  console.log(`  collection rate — with a centre: ${(out.collectionRateWithCentre * 100).toFixed(1)}% · without: ${(out.collectionRateWithoutCentre * 100).toFixed(1)}%`);
}

await main();
