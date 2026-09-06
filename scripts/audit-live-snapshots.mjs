/**
 * Compare every retained governed snapshot with the current live Data Lake payload.
 *
 *   AILAB_ACCESS_TOKEN=<temporary token> npm run audit:live-snapshots
 *
 * This is deliberately read-only. It does not write live responses or accept a new
 * evidence vintage; it only reports row, period, entity-set and value drift using
 * the same canonical fingerprints as `npm run validate:data`.
 */

import { readFile } from 'node:fs/promises';
import { fingerprintEnvelope, compareManifests, manifestPath } from './fingerprint.mjs';

const API_BASE = 'https://datalakes.ailivinglabs.ap.gov.in/api/v1';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function fetchPage(token, tableKey, pageToken = null) {
  const body = {
    departmentId: 'DEPT-AILABS',
    purpose: 'BENEFIT_DISBURSEMENT',
    filters: {},
    responseFormat: 'JSON',
  };
  if (pageToken) body.pageToken = pageToken;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${API_BASE}/datasets/${tableKey}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json();
    const detail = (await response.text()).slice(0, 160);
    // This is a governed catalogue state, not a transient gateway failure; retrying it
    // only burns the five-minute token without making the dataset more available.
    if (response.status === 503 && detail.includes('dataset_temporarily_unavailable')) {
      throw new Error(`HTTP 503 · ${detail}`);
    }
    if (attempt === 4 || !RETRYABLE.has(response.status)) {
      throw new Error(`HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
    }
    await new Promise((done) => setTimeout(done, attempt * 1_000));
  }
  throw new Error('unreachable');
}

async function fetchDataset(token, tableKey) {
  const records = [];
  let firstMetadata = null;
  let pageToken = null;

  for (;;) {
    const payload = await fetchPage(token, tableKey, pageToken);
    const metadata = payload.responseMetadata ?? {};
    if (!firstMetadata) firstMetadata = metadata;
    records.push(...(Array.isArray(payload.records) ? payload.records : []));
    if (!metadata.hasNextPage || !metadata.nextPageToken) break;
    pageToken = metadata.nextPageToken;
  }

  return {
    responseMetadata: {
      ...firstMetadata,
      returnedRecordCount: records.length,
      hasNextPage: false,
      nextPageToken: null,
    },
    records,
  };
}

async function main() {
  const token = process.env.AILAB_ACCESS_TOKEN;
  if (!token) {
    console.error('AILAB_ACCESS_TOKEN is not set. Use a temporary token from /playground/token.');
    process.exit(1);
  }

  const expected = JSON.parse(await readFile(manifestPath, 'utf8'));
  const names = Object.keys(expected.datasets).sort();
  const actual = { version: 1, datasets: {} };
  const failures = [];

  console.log(`Auditing ${names.length} retained datasets against the live API (read-only).`);
  for (const [index, tableKey] of names.entries()) {
    try {
      const envelope = await fetchDataset(token, tableKey);
      const fingerprint = fingerprintEnvelope(envelope);
      actual.datasets[tableKey] = fingerprint;
      const expectedRows = expected.datasets[tableKey].rows;
      const count = fingerprint.rows.toLocaleString('en-IN');
      const countState = fingerprint.rows === expectedRows ? 'count matches' : `retained ${expectedRows.toLocaleString('en-IN')}`;
      const fingerprintState = fingerprint.content === expected.datasets[tableKey].content ? 'exact match' : 'DRIFT';
      console.log(`  ${String(index + 1).padStart(2, '0')}/${names.length} ${tableKey} · ${count} rows · ${countState} · ${fingerprintState}`);
    } catch (error) {
      if (error.message.startsWith('HTTP 401')) {
        console.error(`  ${String(index + 1).padStart(2, '0')}/${names.length} ${tableKey} · STOPPED · temporary token expired or is invalid`);
        console.error('\nAudit stopped before comparison. Refresh /playground/token and rerun; no files were changed.');
        process.exit(1);
      }
      failures.push(`${tableKey}: ${error.message}`);
      console.error(`  ${String(index + 1).padStart(2, '0')}/${names.length} ${tableKey} · FAILED · ${error.message}`);
    }
    await new Promise((done) => setTimeout(done, 150));
  }

  const expectedReadable = {
    version: expected.version,
    datasets: Object.fromEntries(Object.keys(actual.datasets).map((name) => [name, expected.datasets[name]])),
  };
  const drift = compareManifests(expectedReadable, actual);
  if (drift.length) {
    console.log(`\nLIVE DRIFT DETECTED (${drift.length} condition${drift.length === 1 ? '' : 's'}):`);
    for (const line of drift) console.log(`  - ${line}`);
    console.log('\nNo files were changed. Review the source changes before intentionally retaining a new vintage.');
    process.exitCode = failures.length ? 1 : 2;
    return;
  }

  const rows = Object.values(actual.datasets).reduce((total, dataset) => total + dataset.rows, 0);
  const readable = Object.keys(actual.datasets).length;
  console.log(`\nNo live drift detected across ${readable} readable datasets and ${rows.toLocaleString('en-IN')} rows.`);
  if (failures.length) {
    console.error(`Audit incomplete: ${failures.length} dataset(s) could not be read, so their retained vintage was not re-certified.`);
    console.error('No evidence files were changed.');
    process.exit(1);
  }
  console.log('All retained snapshots remain current; no evidence files were changed.');
}

await main();
