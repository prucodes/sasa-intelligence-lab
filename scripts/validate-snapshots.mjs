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

if (files.length !== 29) failures.push(`expected 29 governed snapshots, found ${files.length}`);
if (records !== 4359) failures.push(`expected 4,359 retained rows, found ${records}`);

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
console.log(`Gobardhan remains unavailable; ${prefiltered} active full exports retain source-default geographic filters.`);
console.log(`${periodConflicts} FSTP rows retain the observed month-number/month-name conflict and remain unscored.`);
console.log(manifestRecorded
  ? 'Per-period content fingerprints match the recorded vintage.'
  : 'No fingerprint manifest recorded yet. Run `npm run fingerprint` to pin this vintage.');
