/**
 * Paginated ingestion for large Data Lake datasets.
 *
 *   node scripts/ingest.mjs <tableKey> [--district <code>] [--fresh]
 *
 * The CDMA datasets are ~64,000 rows at a fixed page size of 100, which is ~644
 * sequential requests, while a platform access token lives for 300 seconds. So this
 * refreshes mid-run and can resume: pages already on disk are skipped, and an
 * interrupted pull continues from the last offset rather than starting over.
 *
 * Credentials are never read from, or written to, the repository. Supply a refresh
 * token in the environment for the run only:
 *
 *   export AILAB_REFRESH_TOKEN=...      # from the platform identity endpoint
 *   node scripts/ingest.mjs msw_door_to_door_collection_api
 *
 * Nothing is persisted except the governed response payloads themselves.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { datasets } from './dataset-map.mjs';

const AUTH_URL = 'https://auth.ailivinglabs.ap.gov.in/auth/realms/ap-soverign-stack/protocol/openid-connect/token';
const API_BASE = 'https://datalakes.ailivinglabs.ap.gov.in/api/v1';
const CLIENT_ID = 'data-lake-cli';
const PAGE_SIZE = 100;
/** Access tokens last 300s; refresh with margin so a slow page never straddles expiry. */
const REFRESH_MARGIN_MS = 60_000;

const rawDir = (tableKey) => resolve(process.cwd(), 'data/large-snapshots', tableKey);

class Session {
  constructor(refreshToken) {
    this.refreshToken = refreshToken;
    this.accessToken = null;
    this.expiresAt = 0;
  }

  async token() {
    if (this.accessToken && Date.now() < this.expiresAt - REFRESH_MARGIN_MS) return this.accessToken;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: this.refreshToken,
    });
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      throw new Error(`token refresh failed (${response.status}). The refresh token may have expired — issue a new one and retry.`);
    }
    const payload = await response.json();
    this.accessToken = payload.access_token;
    // The identity service rotates refresh tokens; keep the newest for the next hop.
    if (payload.refresh_token) this.refreshToken = payload.refresh_token;
    this.expiresAt = Date.now() + (payload.expires_in ?? 300) * 1000;
    return this.accessToken;
  }
}

/** Page tokens are base64 `{"mode":"offset","value":N}`; decoded only to report progress. */
function offsetOf(pageToken) {
  if (!pageToken) return 0;
  try {
    const decoded = JSON.parse(Buffer.from(pageToken, 'base64').toString('utf8'));
    return Number.isFinite(decoded?.value) ? decoded.value : 0;
  } catch {
    return 0;
  }
}

function tokenForOffset(offset) {
  return Buffer.from(JSON.stringify({ mode: 'offset', value: offset })).toString('base64');
}

async function fetchPage(session, tableKey, filters, pageToken) {
  const accessToken = await session.token();
  const body = { departmentId: 'DEPT-AILABS', purpose: 'BENEFIT_DISBURSEMENT', filters, responseFormat: 'JSON' };
  if (pageToken) body.pageToken = pageToken;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${API_BASE}/datasets/${tableKey}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json();
    // 502s from the upstream have been intermittent; a 401 means the token aged out mid-flight.
    if (response.status === 401) { session.accessToken = null; return fetchPage(session, tableKey, filters, pageToken); }
    if (attempt === 4 || ![429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`${tableKey} page at offset ${offsetOf(pageToken)} failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
    await new Promise((done) => setTimeout(done, attempt * 1500));
  }
  throw new Error('unreachable');
}

async function completedOffsets(dir) {
  try {
    const files = await readdir(dir);
    return new Set(files.filter((name) => name.endsWith('.json')).map((name) => Number(name.replace(/\D/g, ''))));
  } catch {
    return new Set();
  }
}

async function main() {
  const [tableKey, ...rest] = process.argv.slice(2);
  if (!tableKey) {
    console.error('Usage: node scripts/ingest.mjs <tableKey> [--district <code>] [--fresh]');
    console.error(`Known keys: ${Object.keys(datasets).join(', ')}`);
    process.exit(1);
  }
  const districtIndex = rest.indexOf('--district');
  const filters = districtIndex >= 0 ? { district_code: rest[districtIndex + 1] } : {};
  const fresh = rest.includes('--fresh');

  const refreshToken = process.env.AILAB_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error('AILAB_REFRESH_TOKEN is not set. Export it for this run only; it is never written to disk.');
    process.exit(1);
  }

  const dir = rawDir(tableKey);
  await mkdir(dir, { recursive: true });
  const done = fresh ? new Set() : await completedOffsets(dir);
  if (done.size) console.log(`Resuming: ${done.size} page(s) already retrieved.`);

  const session = new Session(refreshToken);
  let pageToken = done.size ? tokenForOffset(Math.max(...done) + PAGE_SIZE) : null;
  let retained = done.size * PAGE_SIZE;
  let total = null;
  let pages = done.size;

  for (;;) {
    const offset = offsetOf(pageToken);
    if (done.has(offset)) { pageToken = tokenForOffset(offset + PAGE_SIZE); continue; }

    const payload = await fetchPage(session, tableKey, filters, pageToken);
    const meta = payload.responseMetadata ?? {};
    const rows = Array.isArray(payload.records) ? payload.records : [];
    total = meta.totalRecordCount ?? total;

    await writeFile(resolve(dir, `page-${String(offset).padStart(8, '0')}.json`), JSON.stringify(payload), 'utf8');
    retained += rows.length;
    pages += 1;
    if (pages % 25 === 0 || !meta.hasNextPage) {
      console.log(`  ${retained.toLocaleString('en-IN')}${total ? ` / ${total.toLocaleString('en-IN')}` : ''} rows · ${pages} pages`);
    }

    if (!meta.hasNextPage || !meta.nextPageToken) break;
    pageToken = meta.nextPageToken;
  }

  // Reported totals have been unreliable on filtered requests, so record both rather
  // than asserting they agree.
  const manifest = {
    tableKey,
    filters,
    retrievedAt: new Date().toISOString(),
    pages,
    retainedRows: retained,
    reportedTotalRecordCount: total,
    countsAgree: total === null ? null : total === retained,
  };
  await writeFile(resolve(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`\nRetained ${retained.toLocaleString('en-IN')} rows across ${pages} pages.`);
  if (manifest.countsAgree === false) {
    console.log(`Note: the API reported totalRecordCount ${total?.toLocaleString('en-IN')}, which does not match the ${retained.toLocaleString('en-IN')} rows actually returned. Both values are recorded in manifest.json.`);
  }
  console.log(`Raw pages: data/large-snapshots/${tableKey}/  ·  next: node scripts/aggregate.mjs ${tableKey}`);
}

await main();
