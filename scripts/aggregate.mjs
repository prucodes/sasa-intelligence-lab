/**
 * Reduce raw paginated pages to a compact aggregate the application can read.
 *
 *   node scripts/aggregate.mjs <tableKey>
 *
 * `lib/snapshots.ts` imports every retained dataset straight into the client bundle.
 * That is fine for 4,359 rows and impossible for the CDMA datasets, which are roughly
 * 64,000 rows each. So the raw pages stay on disk (and out of git), and only per-entity
 * per-period aggregates are written for the app to consume.
 *
 * Missing is never folded into zero. A day that reported nothing and a day that reported
 * a genuine zero are counted separately all the way through, because at daily grain the
 * difference decides whether a coverage rate means anything.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { datasets, periodOf, pick, pickNumber } from './dataset-map.mjs';

const rawDir = (tableKey) => resolve(process.cwd(), 'data/large-snapshots', tableKey);
const outDir = resolve(process.cwd(), 'data/aggregates');

/** Accumulator for one entity in one period. */
function emptyBucket(config) {
  const measures = {};
  for (const name of Object.keys(config.measures)) {
    measures[name] = { sum: 0, reported: 0, zero: 0, missing: 0, max: null };
  }
  return { rows: 0, days: new Set(), measures };
}

export function aggregateRecords(records, config) {
  const byEntity = new Map();
  const skipped = { noPeriod: 0, noEntity: 0 };

  for (const record of records) {
    const period = periodOf(record, config);
    if (!period) { skipped.noPeriod += 1; continue; }

    const ulb = pick(record, config.ulb);
    const sub = pick(record, config.subEntity);
    const entityKey = [pick(record, config.district) ?? '?', ulb ?? '?', sub ?? '?'].join('|');
    if (!ulb && !sub) { skipped.noEntity += 1; continue; }

    const mapKey = `${entityKey}::${period}`;
    if (!byEntity.has(mapKey)) {
      byEntity.set(mapKey, {
        district: pick(record, config.district),
        districtName: pick(record, config.districtName),
        ulb,
        ulbName: pick(record, config.ulbName),
        subEntity: sub,
        subEntityName: pick(record, config.subEntityName),
        period,
        ...emptyBucket(config),
      });
    }
    const bucket = byEntity.get(mapKey);
    bucket.rows += 1;
    const day = pick(record, config.date);
    if (day) bucket.days.add(day);

    for (const [name, candidates] of Object.entries(config.measures)) {
      const value = pickNumber(record, candidates);
      const slot = bucket.measures[name];
      if (value === null) { slot.missing += 1; continue; }
      slot.reported += 1;
      slot.sum += value;
      if (value === 0) slot.zero += 1;
      slot.max = slot.max === null ? value : Math.max(slot.max, value);
    }
  }

  const rows = [...byEntity.values()].map((bucket) => {
    const measures = {};
    for (const [name, slot] of Object.entries(bucket.measures)) {
      measures[name] = { sum: slot.sum, reported: slot.reported, zero: slot.zero, missing: slot.missing, max: slot.max };
    }
    const ratios = {};
    for (const [name, [numerator, denominator]] of Object.entries(config.ratios ?? {})) {
      const top = measures[numerator];
      const bottom = measures[denominator];
      // A ratio is only meaningful where the denominator was actually reported.
      ratios[name] = bottom && bottom.reported > 0 && bottom.sum > 0 ? top.sum / bottom.sum : null;
    }
    return {
      district: bucket.district,
      districtName: bucket.districtName,
      ulb: bucket.ulb,
      ulbName: bucket.ulbName,
      subEntity: bucket.subEntity,
      subEntityName: bucket.subEntityName,
      period: bucket.period,
      rows: bucket.rows,
      days: bucket.days.size,
      measures,
      ratios,
    };
  }).sort((a, b) => (a.period.localeCompare(b.period))
    || String(a.districtName).localeCompare(String(b.districtName))
    || String(a.subEntityName).localeCompare(String(b.subEntityName)));

  return { rows, skipped };
}

/** Roll secretariat-level buckets up to one row per ULB per period. */
export function rollUpToUlb(rows, config) {
  const byUlb = new Map();
  for (const row of rows) {
    const key = `${row.ulb ?? '?'}::${row.period}`;
    if (!byUlb.has(key)) {
      byUlb.set(key, {
        district: row.district, districtName: row.districtName,
        ulb: row.ulb, ulbName: row.ulbName, period: row.period,
        subEntities: 0, rows: 0, ...emptyBucket(config),
      });
    }
    const target = byUlb.get(key);
    target.subEntities += 1;
    target.rows += row.rows;
    for (const [name, slot] of Object.entries(row.measures)) {
      const into = target.measures[name];
      into.sum += slot.sum;
      into.reported += slot.reported;
      into.zero += slot.zero;
      into.missing += slot.missing;
      into.max = into.max === null ? slot.max : Math.max(into.max, slot.max ?? into.max);
    }
  }
  return [...byUlb.values()].map((bucket) => {
    const ratios = {};
    for (const [name, [numerator, denominator]] of Object.entries(config.ratios ?? {})) {
      const bottom = bucket.measures[denominator];
      ratios[name] = bottom && bottom.reported > 0 && bottom.sum > 0 ? bucket.measures[numerator].sum / bottom.sum : null;
    }
    // `days` is a Set per secretariat and does not sum meaningfully across them,
    // so it is dropped rather than rolled up.
    const rest = { ...bucket };
    delete rest.days;
    return { ...rest, ratios };
  }).sort((a, b) => a.period.localeCompare(b.period) || String(a.ulbName).localeCompare(String(b.ulbName)));
}

async function main() {
  const tableKey = process.argv[2];
  const config = datasets[tableKey];
  if (!config) {
    console.error(`Unknown dataset "${tableKey ?? ''}". Known keys: ${Object.keys(datasets).join(', ')}`);
    process.exit(1);
  }

  const dir = rawDir(tableKey);
  let files;
  try {
    files = (await readdir(dir)).filter((name) => name.startsWith('page-') && name.endsWith('.json')).sort();
  } catch {
    console.error(`No raw pages at data/large-snapshots/${tableKey}. Run: node scripts/ingest.mjs ${tableKey}`);
    process.exit(1);
  }

  const records = [];
  for (const file of files) {
    const payload = JSON.parse(await readFile(resolve(dir, file), 'utf8'));
    if (Array.isArray(payload.records)) records.push(...payload.records);
  }

  const { rows, skipped } = aggregateRecords(records, config);
  const ulbRows = rollUpToUlb(rows, config);

  await mkdir(outDir, { recursive: true });
  const header = {
    tableKey,
    label: config.label,
    grain: config.grain,
    generatedAt: new Date().toISOString(),
    sourceRows: records.length,
    skipped,
    periods: [...new Set(rows.map((row) => row.period))].sort(),
  };

  // Two outputs on purpose. The ULB roll-up is small enough for the application to read
  // directly; the secretariat detail is one row per secretariat per period and would put
  // megabytes into the client bundle, so it stays on disk for server-side use only.
  const summary = { ...header, entityGrain: 'ulb-period', ulbPeriods: ulbRows };
  const detail = { ...header, entityGrain: 'secretariat-period', subEntityPeriods: rows };

  const summaryPath = resolve(outDir, `${tableKey}.json`);
  const detailPath = resolve(outDir, `${tableKey}.detail.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary)}\n`, 'utf8');
  await writeFile(detailPath, `${JSON.stringify(detail)}\n`, 'utf8');

  const kb = (value) => (Buffer.byteLength(JSON.stringify(value)) / 1024).toFixed(0);
  console.log(`${records.length.toLocaleString('en-IN')} raw rows → ${rows.length.toLocaleString('en-IN')} secretariat-periods, ${ulbRows.length.toLocaleString('en-IN')} ULB-periods`);
  console.log(`Periods: ${header.periods.join(', ') || 'none'}`);
  if (skipped.noPeriod || skipped.noEntity) {
    console.log(`Skipped: ${skipped.noPeriod} without a usable date, ${skipped.noEntity} without a ULB or secretariat.`);
  }
  console.log(`  data/aggregates/${tableKey}.json         ${kb(summary)} KB  (ULB roll-up — safe for the app to import)`);
  console.log(`  data/aggregates/${tableKey}.detail.json  ${kb(detail)} KB  (secretariat detail — server-side only, not bundled)`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
