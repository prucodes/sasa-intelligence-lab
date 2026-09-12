/** Build daily evidence with exact-repeat collapse, conflicting-key holdout,
 * and separate positive, zero and missing measurement counts.
 * Raw-count reconciliation does not certify distinct source completeness.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sourceNumber, sourceText, uniqueSourceRecords } from '../lib/record-contract.mjs';
import { loadUrbanSource } from './urban-sources.mjs';
import { serviceSources } from './aggregate-ulb-service.mjs';

const LARGE = resolve(process.cwd(), 'data/large-snapshots');
const OUT = resolve(process.cwd(), 'data/aggregates');

/** Per dataset: what is being counted, and against what (if anything). */
const SPECS = {
  msw_door_to_door_collection_api: { label: 'MSW door-to-door collection', measure: 'collected_households', denominator: 'total_households', entity: 'sachivalayam_code', unit: 'households', measureLabel: 'collected households' },
  identification_of_bulk_waste_generators_api: { label: 'Bulk waste generator identification', measure: 'no_of_bwgs', denominator: null, entity: 'secretariat_code', unit: 'generators', measureLabel: 'bulk waste generators' },
  onsite_processing_of_wet_waste_bwg_api: { label: 'On-site wet waste processing', measure: 'wet_waste_processing_bwgs', denominator: null, entity: 'secretariat_code', unit: 'generators', measureLabel: 'generators processing wet waste on site' },
  waste_egregation_api: { label: 'Waste segregation', measure: 'garbage_segregation', denominator: 'total_households', entity: 'sachivalayam_code', unit: 'households', measureLabel: 'households segregating waste' },
};

const first = (record, ...names) => names.find((name) => record[name] !== undefined);

async function loadRows(dir) {
  const rows = [];
  for (const file of (await readdir(dir)).filter((f) => f.startsWith('page-'))) {
    rows.push(...(JSON.parse(await readFile(resolve(dir, file), 'utf8')).records ?? []));
  }
  return rows;
}

async function summarise(tableKey) {
  if (serviceSources.includes(tableKey)) {
    const { rows, provenance } = await loadUrbanSource(tableKey);
    const summary = summariseContinuity(rows, SPECS[tableKey], { tableKey, retrievedAt: provenance.generatedAt, pages: provenance.pages, reportedTotalRecordCount: provenance.reportedTotalRecordCount });
    return summary && provenance.referenceDay ? { ...summary, referenceDay: provenance.referenceDay } : summary;
  }
  const current = resolve(LARGE, 'current', tableKey);
  const dir = existsSync(resolve(current, 'manifest.json')) ? current : resolve(LARGE, tableKey);
  if (!existsSync(resolve(dir, 'manifest.json'))) return null;
  const manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8'));
  const rows = await loadRows(dir);
  if (!rows.length) return null;

  return summariseContinuity(rows, SPECS[tableKey], {tableKey, ...manifest});
}

export function summariseContinuity(rawRows, spec, manifest = {}) {
  const {tableKey = 'test'} = manifest;
  const key = (row) => sourceText(row[spec.entity]) && sourceText(row.date1) ? `${row[spec.entity]}|${row.date1}` : null;
  const {records:rows, quality} = uniqueSourceRecords(rawRows, key);
  if (!rows.length) return null;
  // Resolve the columns this export actually carries rather than trusting the spec.
  const measure = spec.measure && rows[0][spec.measure] !== undefined ? spec.measure
    : first(rows[0], 'collected_households', 'no_of_bwgs', 'wet_waste_processing_bwgs', 'garbage_segregation');
  const denominator = spec.denominator && rows[0][spec.denominator] !== undefined ? spec.denominator : first(rows[0], 'total_households');
  const entity = spec.entity && rows[0][spec.entity] !== undefined ? spec.entity : first(rows[0], 'sachivalayam_code', 'secretariat_code');

  const perDate = new Map();
  const perEntity = new Map();
  for (const record of rows) {
    const date = String(record.date1 ?? '').trim();
    const value = measure ? sourceNumber(record[measure]) : null;
    const bottom = denominator ? sourceNumber(record[denominator]) : null;
    const reported = value !== null;
    const day = perDate.get(date) ?? { date, rows: 0, reporting: 0, positive:0, zero:0, missing:0, value: 0, denominator: 0, pairedValue:0, pairedRows:0 };
    day.rows += 1;
    if (reported) day.reporting += 1;
    if (value === null) day.missing++;
    else if (value === 0) day.zero++;
    else day.positive++;
    day.value += value ?? 0;
    if (value !== null && bottom !== null) { day.denominator += bottom; day.pairedValue += value; day.pairedRows++; }
    perDate.set(date, day);

    if (entity) {
      const key = String(record[entity] ?? '').trim();
      const item = perEntity.get(key) ?? { days: 0, reporting: 0, positive:0 };
      item.days += 1;
      if (reported) item.reporting += 1;
      if (value !== null && value > 0) item.positive++;
      perEntity.set(key, item);
    }
  }

  const days = [...perDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totalValue = days.reduce((sum, day) => sum + day.value, 0);
  const totalDenominator = days.reduce((sum, day) => sum + day.denominator, 0);
  const busiest = days.reduce((top, day) => day.value > (top?.value ?? -1) ? day : top, null);
  const topShare = totalValue > 0 && busiest ? busiest.value / totalValue : null;
  const evenShare = days.length ? 1 / days.length : null;

  const entities = [...perEntity.values()];
  // A burst is one day carrying most of the evidence; thin-but-steady is every day
  // reporting at a similar, low rate. They mislead differently and are labelled apart.
  const verdict = topShare === null ? 'no-measure'
    : topShare >= 0.5 ? 'single-day-concentration'
      : entities.length && entities.filter((e) => e.positive > 0).length / entities.length < 0.6 ? 'partial-but-steady'
        : 'continuous';

  return {
    tableKey,
    label: spec.label ?? tableKey,
    unit: spec.unit ?? null,
    measureLabel: spec.measureLabel ?? spec.unit ?? 'value',
    rows: rows.length,
    rawRows:rawRows.length,
    quality,
    measure,
    denominator,
    entityGrain: entity ? 'Secretariat' : null,
    entities: perEntity.size,
    entitiesNeverReporting: entities.filter((e) => e.reporting === 0).length,
    entitiesReportingEveryDay: entities.filter((e) => e.reporting === days.length).length,
    entitiesWithPositiveActivity:entities.filter(e=>e.positive>0).length,
    missingExpectedRecords:entities.length * days.length - rows.length,
    days: days.map((day) => ({
      date: day.date,
      rows: day.rows,
      reporting: day.reporting,
      reportingRatio: day.rows ? day.reporting / day.rows : null,
      positive:day.positive,
      zero:day.zero,
      missing:day.missing,
      positiveRatio:day.rows?day.positive/day.rows:null,
      denominator:day.denominator,
      pairedValue:day.pairedValue,
      pairedRows:day.pairedRows,
      value: day.value,
    })),
    busiestDate: busiest?.date ?? null,
    busiestDateShare: topShare,
    evenShare,
    verdict,
    // The ratio the data invites, and the same ratio on the busiest day alone. Recorded
    // so the product can show how far apart they are instead of publishing either.
    naiveRatio: totalDenominator > 0 ? days.reduce((s,d)=>s+d.pairedValue,0) / totalDenominator : null,
    busiestDayRatio: busiest && busiest.denominator > 0 ? busiest.pairedValue / busiest.denominator : null,
    totalValue,
    totalDenominator,
    retrievedAt: manifest.retainedAt ?? manifest.retrievedAt,
    pages: manifest.pages,
    reportedTotalRecordCount: manifest.reportedTotalRecordCount ?? manifest.liveRows,
  };
}

async function main() {
  const keys = Object.keys(SPECS);
  const datasets = [];
  for (const key of keys.sort()) {
    const summary = await summarise(key);
    if (summary) { datasets.push(summary); console.log(`  ✓ ${key} · ${summary.rows.toLocaleString('en-IN')} rows · ${summary.verdict}`); }
    else console.log(`  · ${key} · incomplete, skipped`);
  }
  if (!datasets.length) { console.log('No complete large snapshots to summarise.'); return; }

  await mkdir(OUT, { recursive: true });
  // A paginated pull has no single responseId, it is hundreds of responses. The
  // identifying facts are the page count, the row count and when the pull ran.
  const generatedFrom = Object.fromEntries(datasets.map((dataset) => [dataset.tableKey, {
    generatedAt: dataset.retrievedAt,
    rows: dataset.rawRows,
    pages: dataset.pages,
    reportedTotalRecordCount: dataset.reportedTotalRecordCount,
    referenceDay: dataset.referenceDay,
  }]));

  await writeFile(resolve(OUT, 'reporting-continuity.json'), `${JSON.stringify({
    version: 2,
    grain: 'Dataset · reported day',
    sourceGrain: 'Secretariat · day',
    generatedFrom,
    datasets,
    boundary: 'One retained record per secretariat and date. Exact repeats are collapsed and conflicting keys held out. Valid zero, positive activity, missing measurements and missing entity/date records are counted separately. The expected-record comparison uses entities and dates observed in this retained scope; it is not a certified population roster or an outage diagnosis.',
  }, null, 2)}\n`, 'utf8');
  console.log(`\n${datasets.length} dataset(s) → data/aggregates/reporting-continuity.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
