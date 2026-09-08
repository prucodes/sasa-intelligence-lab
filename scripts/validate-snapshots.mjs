import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compareManifests, fingerprintDirectory, manifestPath } from './fingerprint.mjs';

const snapshotDir = resolve(process.cwd(), 'data/full-snapshots');
const files = (await readdir(snapshotDir)).filter((file) => file.endsWith('.json')).sort();
const failures = [];
const tableKeys = new Set();
let records = 0;
let prefiltered = 0;
let periodConflicts = 0;

for (const file of files) {
  const envelope = JSON.parse(await readFile(resolve(snapshotDir, file), 'utf8'));
  const metadata = envelope.responseMetadata ?? {};
  const rows = Array.isArray(envelope.records) ? envelope.records : [];
  const tableKey = metadata.tableKey;
  if (!tableKey) failures.push(`${file}: missing table key`);
  if (tableKeys.has(tableKey)) failures.push(`${file}: duplicate table key ${tableKey}`);
  tableKeys.add(tableKey);
  if (metadata.hasNextPage !== false || metadata.nextPageToken !== null) failures.push(`${file}: pagination is not complete`);
  if (metadata.totalRecordCount !== rows.length || metadata.returnedRecordCount !== rows.length) {
    failures.push(`${file}: metadata count does not reconcile to retained rows`);
  }
  const serialized = JSON.stringify(envelope).toLowerCase();
  for (const credentialKey of ['"authorization"', '"accesstoken"', '"refreshtoken"', '"cookie"']) {
    if (serialized.includes(credentialKey)) failures.push(`${file}: credential material key ${credentialKey} must not be retained`);
  }
  if (Object.keys(envelope.requestEcho?.filters ?? {}).some((key) => ['district_id', 'dstrt_id', 'district_name', 'dstrt_nm', 'ulb_id'].includes(key))) prefiltered += 1;
  periodConflicts += rows.filter((row) => row.month_number === '7' && String(row.month_name).toUpperCase() === 'JUNE').length;
  records += rows.length;
}

// 29 retained on 2026-08-28, plus 14 retained on 2026-09-08: the September grant
// (IHHL construction pair, CDMA works, CSC, Gobardhan) and the LGD standardisation pass.
if (files.length !== 44) failures.push(`expected 44 governed snapshots, found ${files.length}`);
if (records !== 6509) failures.push(`expected 6,509 retained rows, found ${records}`);

/**
 * Aggregates are evidence too.
 *
 * A dataset too large to bundle reaches the app as a rollup, and that rollup is what a
 * reviewer actually sees. Its source sits in data/large-snapshots, which is git-ignored,
 * so on any other machine the rollup is the only artefact present. It therefore has to
 * carry its own provenance and reconcile against itself — otherwise a hand-edited or
 * stale aggregate would pass every check in this file.
 */
const aggregateDir = resolve(process.cwd(), 'data/aggregates');
let aggregates = [];
try {
  aggregates = (await readdir(aggregateDir)).filter((file) => file.endsWith('.json') && !file.endsWith('.detail.json')).sort();
} catch {
  // No aggregates yet is a valid state.
}
let aggregateRows = 0;
for (const file of aggregates) {
  const rollup = JSON.parse(await readFile(resolve(aggregateDir, file), 'utf8'));
  const sources = Object.entries(rollup.generatedFrom ?? {});
  if (!sources.length) {
    failures.push(`aggregates/${file}: no source provenance recorded`);
    continue;
  }
  for (const [key, source] of sources) {
    // A single-response export identifies itself by responseId; a paginated pull has
    // hundreds of responses and identifies itself by page and row count instead.
    const identified = source?.responseId || typeof source?.pages === 'number';
    if (!identified || !source?.generatedAt || typeof source?.rows !== 'number') {
      failures.push(`aggregates/${file}: ${key} provenance is incomplete (needs generatedAt, rows, and either responseId or pages)`);
    }
  }
  if (!rollup.boundary) failures.push(`aggregates/${file}: no reading boundary stated`);
  const districts = Array.isArray(rollup.districts) ? rollup.districts : [];
  const counted = districts.reduce((total, district) => total + (district.panchayats ?? 0), 0);
  if (typeof rollup.panchayatsCounted === 'number' && counted !== rollup.panchayatsCounted) {
    failures.push(`aggregates/${file}: districts sum to ${counted}, header claims ${rollup.panchayatsCounted}`);
  }
  // Every sub-count must fit inside the population it is drawn from.
  for (const district of districts) {
    const swpc = (district.withSwpc ?? 0) + (district.withoutSwpc ?? 0) + (district.swpcNotStated ?? 0);
    if (swpc > (district.panchayats ?? 0)) {
      failures.push(`aggregates/${file}: ${district.district} SWPC states (${swpc}) exceed its ${district.panchayats} panchayats`);
    }
  }
  aggregateRows += counted;
}

// Row counts reconcile even when the source re-dates rows between reported periods,
// so compare per-period content against the recorded vintage as well.
let drift = [];
let manifestRecorded = true;
try {
  const expected = JSON.parse(await readFile(manifestPath, 'utf8'));
  drift = compareManifests(expected, await fingerprintDirectory());
  for (const line of drift) failures.push(`snapshot drift — ${line}`);
} catch (error) {
  if (error.code === 'ENOENT') manifestRecorded = false;
  else failures.push(`fingerprint manifest could not be read: ${error.message}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${files.length} complete full exports and ${records.toLocaleString('en-IN')} retained rows.`);
// Gobardhan served 502 for weeks and was the one authorized endpoint with no retained
// response. It recovered before the 2026-09-08 pull, so this line reports the state
// rather than asserting it, and will say so again if the endpoint regresses.
console.log(`${tableKeys.has('sasa_establishment_of_gobardhan_units_api') ? 'Gobardhan is retained (endpoint recovered)' : 'Gobardhan remains unavailable'}; ${prefiltered} active full exports retain source-default geographic filters.`);
console.log(`${periodConflicts} FSTP rows retain the observed month-number/month-name conflict and remain unscored.`);
if (aggregates.length) {
  console.log(`${aggregates.length} aggregate(s) covering ${aggregateRows.toLocaleString('en-IN')} source entities carry provenance and reconcile to their own district totals.`);
}
console.log(manifestRecorded
  ? 'Per-period content fingerprints match the recorded vintage.'
  : 'No fingerprint manifest recorded yet. Run `npm run fingerprint` to pin this vintage.');
