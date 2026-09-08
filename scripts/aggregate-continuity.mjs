/**
 * Reporting continuity for the secretariat-day CDMA exports.
 *
 *   node scripts/aggregate-continuity.mjs
 *
 * These four datasets are ~64,500 rows each and git-ignored, so the app can only ever
 * see a rollup. The rollup worth having is not their totals — it is whether the rows
 * were actually reported.
 *
 * Each arrives 100% filled on every column, which passes every completeness check this
 * product has. The failure is different and harder to see: a value present but zero,
 * repeated across most entities and most days. `msw_door_to_door_collection_api` puts
 * 94.6% of all reported collection on one day of sixteen; `identification_of_bulk_
 * waste_generators_api` reports steadily but from only ~23% of secretariats. Those need
 * different warnings, so the verdict is measured per dataset rather than assumed.
 *
 * Output: data/aggregates/reporting-continuity.json (small, committed, bundled).
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LARGE = resolve(process.cwd(), 'data/large-snapshots');
const OUT = resolve(process.cwd(), 'data/aggregates');

/** Per dataset: what is being counted, and against what (if anything). */
const SPECS = {
  msw_door_to_door_collection_api: { label: 'MSW door-to-door collection', measure: 'collected_households', denominator: 'total_households', entity: 'sachivalayam_code', unit: 'households', measureLabel: 'collected households' },
  identification_of_bulk_waste_generators_api: { label: 'Bulk waste generator identification', measure: 'no_of_bwgs', denominator: null, entity: 'secretariat_code', unit: 'generators', measureLabel: 'bulk waste generators' },
  onsite_processing_of_wet_waste_bwg_api: { label: 'On-site wet waste processing', measure: 'wet_waste_processing_bwgs', denominator: null, entity: 'secretariat_code', unit: 'generators', measureLabel: 'generators processing wet waste on site' },
  waste_egregation_api: { label: 'Waste segregation', measure: 'garbage_segregation', denominator: 'total_households', entity: 'sachivalayam_code', unit: 'households', measureLabel: 'households segregating waste' },
};

const num = (value) => { const n = Number(String(value ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const first = (record, ...names) => names.find((name) => record[name] !== undefined);

async function loadRows(dir) {
  const rows = [];
  for (const file of (await readdir(dir)).filter((f) => f.startsWith('page-'))) {
    rows.push(...(JSON.parse(await readFile(resolve(dir, file), 'utf8')).records ?? []));
  }
  return rows;
}

async function summarise(tableKey) {
  const dir = resolve(LARGE, tableKey);
  if (!existsSync(resolve(dir, 'manifest.json'))) return null;
  const manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8'));
  const rows = await loadRows(dir);
  if (!rows.length) return null;

  const spec = SPECS[tableKey] ?? {};
  // Resolve the columns this export actually carries rather than trusting the spec.
  const measure = spec.measure && rows[0][spec.measure] !== undefined ? spec.measure
    : first(rows[0], 'collected_households', 'no_of_bwgs', 'wet_waste_processing_bwgs', 'garbage_segregation');
  const denominator = spec.denominator && rows[0][spec.denominator] !== undefined ? spec.denominator : first(rows[0], 'total_households');
  const entity = spec.entity && rows[0][spec.entity] !== undefined ? spec.entity : first(rows[0], 'sachivalayam_code', 'secretariat_code');

  const perDate = new Map();
  const perEntity = new Map();
  for (const record of rows) {
    const date = String(record.date1 ?? '').trim();
    const reported = measure ? num(record[measure]) > 0 : false;
    const day = perDate.get(date) ?? { date, rows: 0, reporting: 0, value: 0, denominator: 0 };
    day.rows += 1;
    if (reported) day.reporting += 1;
    if (measure) day.value += num(record[measure]);
    if (denominator) day.denominator += num(record[denominator]);
    perDate.set(date, day);

    if (entity) {
      const key = String(record[entity] ?? '').trim();
      const item = perEntity.get(key) ?? { days: 0, reporting: 0 };
      item.days += 1;
      if (reported) item.reporting += 1;
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
      : entities.length && entities.filter((e) => e.reporting > 0).length / entities.length < 0.6 ? 'partial-but-steady'
        : 'continuous';

  return {
    tableKey,
    label: spec.label ?? tableKey,
    unit: spec.unit ?? null,
    measureLabel: spec.measureLabel ?? spec.unit ?? 'value',
    rows: rows.length,
    measure,
    denominator,
    entityGrain: entity ? 'Secretariat' : null,
    entities: perEntity.size,
    entitiesNeverReporting: entities.filter((e) => e.reporting === 0).length,
    entitiesReportingEveryDay: entities.filter((e) => e.days > 0 && e.reporting === e.days).length,
    days: days.map((day) => ({
      date: day.date,
      rows: day.rows,
      reporting: day.reporting,
      reportingRatio: day.rows ? day.reporting / day.rows : null,
      value: day.value,
    })),
    busiestDate: busiest?.date ?? null,
    busiestDateShare: topShare,
    evenShare,
    verdict,
    // The ratio the data invites, and the same ratio on the busiest day alone. Recorded
    // so the product can show how far apart they are instead of publishing either.
    naiveRatio: totalDenominator > 0 ? totalValue / totalDenominator : null,
    busiestDayRatio: busiest && busiest.denominator > 0 ? busiest.value / busiest.denominator : null,
    totalValue,
    totalDenominator,
    retrievedAt: manifest.retrievedAt,
    pages: manifest.pages,
    reportedTotalRecordCount: manifest.reportedTotalRecordCount,
  };
}

async function main() {
  const keys = existsSync(LARGE) ? (await readdir(LARGE, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name) : [];
  const datasets = [];
  for (const key of keys.sort()) {
    const summary = await summarise(key);
    if (summary) { datasets.push(summary); console.log(`  ✓ ${key} · ${summary.rows.toLocaleString('en-IN')} rows · ${summary.verdict}`); }
    else console.log(`  · ${key} · incomplete, skipped`);
  }
  if (!datasets.length) { console.log('No complete large snapshots to summarise.'); return; }

  await mkdir(OUT, { recursive: true });
  // A paginated pull has no single responseId — it is hundreds of responses. The
  // identifying facts are the page count, the row count and when the pull ran.
  const generatedFrom = Object.fromEntries(datasets.map((dataset) => [dataset.tableKey, {
    generatedAt: dataset.retrievedAt,
    rows: dataset.rows,
    pages: dataset.pages,
    reportedTotalRecordCount: dataset.reportedTotalRecordCount,
  }]));

  await writeFile(resolve(OUT, 'reporting-continuity.json'), `${JSON.stringify({
    version: 1,
    grain: 'Dataset · reported day',
    sourceGrain: 'Secretariat · day',
    generatedFrom,
    datasets,
    boundary: 'Every one of these exports is 100% filled on every column. Filled is not reported: a present zero is counted here as a non-report, because that is what it is. No coverage ratio is published from them.',
  }, null, 2)}\n`, 'utf8');
  console.log(`\n${datasets.length} dataset(s) → data/aggregates/reporting-continuity.json`);
}

await main();
