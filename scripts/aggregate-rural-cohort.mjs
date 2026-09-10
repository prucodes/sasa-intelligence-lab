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
 * NO date column, so whether it describes August is unknown, it is a state of unknown
 * currency, not an August fact. And 2026-08-02 reports at 2% against 70-93% on the other
 * six days, so it is identified and excluded from the rate rather than dragging it down.
 *
 * Output: data/aggregates/rural-cohort.json (committed, bundled).
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sourceNumber, uniqueSourceRecords } from '../lib/record-contract.mjs';

const LARGE = resolve(process.cwd(), 'data/large-snapshots');
const OUT = resolve(process.cwd(), 'data/aggregates');
const SWPC = 'sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api_27_aug_2026';

const text = (value) => String(value ?? '').trim();
const num = sourceNumber;
const round = (value) => value === null ? null : Math.round(value * 10000) / 10000;
/** A day where almost nothing reported is a reporting outage, not a day of no collection. */
const LOW_ACTIVITY_THRESHOLD = 0.2;

async function main() {
  const collectionDir = resolve(LARGE, (await readdir(LARGE)).find((name) => name.includes('MONTH_ID-8')) ?? '');
  if (!existsSync(resolve(collectionDir, 'manifest.json'))) { console.log('August collection pull is not complete.'); return; }
  const manifest = JSON.parse(await readFile(resolve(collectionDir, 'manifest.json'), 'utf8'));
  const rawCollection = [];
  for (const file of (await readdir(collectionDir)).filter((f) => f.startsWith('page-'))) {
    rawCollection.push(...(JSON.parse(await readFile(resolve(collectionDir, file), 'utf8')).records ?? []));
  }
  // The paginator re-serves rows. The August pull holds 280,371 raw rows carrying only
  // 91,427 distinct panchayat-days, and 187,791 of those repeats span pages rather than
  // sitting inside one, the shape of an unstably ordered offset window, not of a source
  // that genuinely repeats itself. Counting raw rows would weight a panchayat-day by how
  // many times the API happened to hand it back. Collapse exact repeats on the declared
  // key, and hold every conflicting variant out rather than choosing between them.
  const { records: collection, quality: recordQuality } = uniqueSourceRecords(rawCollection, (row) => {
    const id = text(row.GRAM_PANCHAYAT_ID);
    const date = text(row.COLLECTION_DATE);
    return id && date ? `${id}|${date}` : null;
  });
  const gridCeiling = new Set(collection.map((row) => text(row.GRAM_PANCHAYAT_ID))).size
    * new Set(collection.map((row) => text(row.COLLECTION_DATE))).size;
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
  const usableDays = days;
  const anomalousDays = days.filter((day) => day.reportingRatio < LOW_ACTIVITY_THRESHOLD);
  const outageDays = [];
  const usable = new Set(usableDays.map((day) => day.date));

  // Per panchayat, over the usable days only.
  const activity = new Map();
  for (const row of collection) {
    if (!usable.has(text(row.COLLECTION_DATE))) continue;
    const id = text(row.GRAM_PANCHAYAT_ID);
    if (!id) continue;
    const entry = activity.get(id) ?? { days: 0, collectedDays: 0, segregated: 0, validDays:0, segregationDays:0, district: text(row.DISTRICT_NAME), block: text(row.BLOCK_NAME), name: text(row.GRAM_PANCHAYAT_NAME) };
    entry.days += 1;
    if(['yes','no'].includes(text(row.IS_COLLECTED).toLowerCase())) entry.validDays++;
    if (text(row.IS_COLLECTED).toLowerCase() === 'yes') entry.collectedDays += 1;
    if(num(row.SEGREGATED_WASTE_HOUSEHOLDS)!==null) entry.segregationDays++;
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
      validDays:act.validDays,
      segregationDays:act.segregationDays,
      collectedDays: act.collectedDays,
      segregatedHouseholds: act.segregated,
    });
  }

  const withCentre = points.filter((point) => point.hasCentre === true);
  const withoutCentre = points.filter((point) => point.hasCentre === false);
  const rate = (group) => {
    const days = group.reduce((sum, point) => sum + point.validDays, 0);
    const collected = group.reduce((sum, point) => sum + point.collectedDays, 0);
    return days > 0 ? round(collected / days) : null;
  };

  const districts = [...new Set(points.map((point) => point.district))].sort();

  /** One group's reported activity. Rates are over panchayat-days actually reported. */
  const summarise = (group) => {
    const days = group.reduce((sum, point) => sum + point.days, 0);
    const validDays = group.reduce((sum, point) => sum + point.validDays, 0);
    const segregationDays=group.reduce((sum,point)=>sum+point.segregationDays,0);
    const collected = group.reduce((sum, point) => sum + point.collectedDays, 0);
    const segregated = group.reduce((sum, point) => sum + point.segregatedHouseholds, 0);
    return {
      panchayats: group.length,
      panchayatDays: days,
      validCollectionDays:validDays,
      collectedDays:collected,
      missingActivityDays:days-validDays,
      segregatedHouseholds:segregated,
      validSegregationDays:segregationDays,
      collectionRate: validDays > 0 ? round(collected / validDays) : null,
      segregatedPerPanchayatDay: segregationDays > 0 ? round(segregated / segregationDays) : null,
      anySegregation: group.length > 0 ? round(group.filter((point) => point.segregatedHouseholds > 0).length / group.length) : null,
    };
  };

  const out = {
    version: 2,
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
    /**
     * Raw rows against distinct panchayat-days, and what the difference is made of.
     * `completeness` is the limit that matters: the pull stopped when raw rows matched
     * the reported total, which under this paginator shows only that enough requests
     * were made, not that every distinct record was served.
     */
    recordQuality: {
      key: 'GRAM_PANCHAYAT_ID|COLLECTION_DATE',
      ...recordQuality,
      gridCeiling,
      gridCoverage: round(recordQuality.uniqueRows / gridCeiling),
      completeness: 'unproven — the final full block of 100 pages still returned 1,705 previously unseen panchayat-days when the run stopped',
    },
    days, usableDays: usableDays.map((day) => day.date), outageDays: outageDays.map((day) => day.date),
    anomalousDays:anomalousDays.map(d=>d.date),
    cohort: points.length,
    withCentre: withCentre.length,
    withoutCentre: withoutCentre.length,
    centreNotStated: points.filter((point) => point.hasCentre === null).length,
    collectionRateWithCentre: rate(withCentre),
    collectionRateWithoutCentre: rate(withoutCentre),
    // The register carries no date, so it is a state of unknown currency, not an
    // August fact. Every reading below inherits that limit.
    registerCurrency: 'unknown — the SWPC register has no date column',
    boundary: `Undated facility register joined by GP ID to ${days.length} observed days of August 2026. Exact repeated GP/date records are collapsed. All observed days are included; a low-activity day is not assumed to be an outage. This descriptive comparison does not establish a programme effect or the absence of a relationship.`,
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
    byCondition: [...new Set(withCentre.map((point) => point.condition))]
      .filter(Boolean).sort()
      .map((condition) => ({ condition, ...summarise(withCentre.filter((point) => point.condition === condition)) }))
      .concat([{ condition: null, ...summarise(withCentre.filter((point) => !point.condition)) }]),
    byDistrict: districts.map((name) => ({ district: name, ...summarise(points.filter((point) => point.district === name)) })),
  };

  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, 'rural-cohort.json'), `${JSON.stringify(out)}\n`, 'utf8');
  console.log(`Rural cohort: ${points.length.toLocaleString('en-IN')} gram panchayats over ${usableDays.length} usable days.`);
  console.log(`  records: ${recordQuality.rawRows.toLocaleString('en-IN')} raw \u00b7 ${recordQuality.uniqueRows.toLocaleString('en-IN')} distinct panchayat-days \u00b7 ${recordQuality.duplicateRows.toLocaleString('en-IN')} exact repeats collapsed \u00b7 ${recordQuality.conflictingKeys} conflicting keys held out`);
  console.log(`  identity: ${register.size} registered · ${points.length} matched · ${registeredWithoutActivity} without activity · ${registerDisputed} disputed`);
  console.log(`  all days included; low-activity anomalies: ${anomalousDays.map((d) => d.date).join(', ') || 'none'}`);
  console.log(`  collection rate — with a centre: ${(out.collectionRateWithCentre * 100).toFixed(1)}% · without: ${(out.collectionRateWithoutCentre * 100).toFixed(1)}%`);
}

await main();
