import { sourcePeriod, sourceEntity } from '../lib/record-contract.mjs';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const snapshotDir = resolve(process.cwd(), 'data/full-snapshots');
export const manifestPath = resolve(process.cwd(), 'data/snapshot-fingerprints.json');

function digest(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

// Canonical form: keys sorted so field order never affects the hash.
function canonicalRow(row) {
  return JSON.stringify(Object.keys(row).sort().map((key) => [key, row[key]]));
}

// Rows are hashed as a sorted set, so a pure reordering is not reported as drift.
function hashRows(rows) {
  return digest(rows.map(canonicalRow).sort().join('\n'));
}

// Missing periods stay explicit; YYYYMM, daily dates and current identity fields are supported.
export const periodOf = (row) => sourcePeriod(row) ?? 'unperiodized';
const entityOf = (row) => sourceEntity(row) ?? 'unidentified';

export function fingerprintEnvelope(envelope) {
  const rows = Array.isArray(envelope.records) ? envelope.records : [];
  const metadata = envelope.responseMetadata ?? {};
  const buckets = new Map();
  for (const row of rows) {
    const period = periodOf(row);
    if (!buckets.has(period)) buckets.set(period, []);
    buckets.get(period).push(row);
  }
  const periods = {};
  for (const [period, periodRows] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    periods[period] = {
      rows: periodRows.length,
      // Detects a value edit or a row moving into or out of this period.
      content: hashRows(periodRows),
      // Detects a change in which entities the period covers, independent of values.
      entities: digest([...new Set(periodRows.map(entityOf))].sort().join('\n')),
    };
  }
  return {
    tableKey: metadata.tableKey ?? null,
    retrievedAt: metadata.generatedAt ?? null,
    rows: rows.length,
    content: hashRows(rows),
    periods,
  };
}

export async function fingerprintDirectory() {
  const files = (await readdir(snapshotDir)).filter((file) => file.endsWith('.json')).sort();
  const datasets = {};
  for (const file of files) {
    const envelope = JSON.parse(await readFile(resolve(snapshotDir, file), 'utf8'));
    datasets[file.replace(/\.json$/, '')] = fingerprintEnvelope(envelope);
  }
  return { version: 2, datasets };
}

// Returns one plain-language line per difference. Empty means the vintage is intact.
export function compareManifests(expected, actual) {
  const drift = [];
  const names = [...new Set([...Object.keys(expected.datasets), ...Object.keys(actual.datasets)])].sort();
  for (const name of names) {
    const before = expected.datasets[name];
    const after = actual.datasets[name];
    if (!before) { drift.push(`${name}: not present in the recorded manifest`); continue; }
    if (!after) { drift.push(`${name}: snapshot file is missing`); continue; }
    if (before.content === after.content) continue;

    if (before.rows !== after.rows) drift.push(`${name}: retained rows ${before.rows} -> ${after.rows}`);
    const periods = [...new Set([...Object.keys(before.periods), ...Object.keys(after.periods)])].sort();
    for (const period of periods) {
      const a = before.periods[period];
      const b = after.periods[period];
      if (!a) { drift.push(`${name}: new reported period ${period} (${b.rows} rows)`); continue; }
      if (!b) { drift.push(`${name}: reported period ${period} disappeared (was ${a.rows} rows)`); continue; }
      if (a.content === b.content) continue;
      if (a.rows !== b.rows) {
        drift.push(`${name}: period ${period} rows ${a.rows} -> ${b.rows}${before.rows === after.rows ? ' (total unchanged — rows were re-dated)' : ''}`);
      } else if (a.entities !== b.entities) {
        drift.push(`${name}: period ${period} covers different entities at the same row count`);
      } else {
        drift.push(`${name}: period ${period} values changed at the same row count and entity set`);
      }
    }
  }
  return drift;
}
