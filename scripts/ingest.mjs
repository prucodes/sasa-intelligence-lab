/**
 * Paginated ingestion for large Data Lake datasets.
 *
 *   node scripts/ingest.mjs <tableKey> [--month <YYYYMM>] [--year <YYYY>] [--fresh]
 *
 * The CDMA datasets are ~64,000 rows at a fixed page size of 100, which is ~644
 * sequential requests, while a platform access token lives for 300 seconds. So this
 * refreshes mid-run and can resume: pages already on disk are skipped, and an
 * interrupted pull continues from the last offset rather than starting over.
 *
 * Credentials are never read from, or written to, the repository. Mint a refresh
 * token yourself with the documented password grant (datalakes.ailivinglabs.ap.gov.in
 * /docs#authentication) — the password goes only to the identity endpoint, never here —
 * then supply the refresh_token in the environment for the run only:
 *
 *   # you run this; it prints access_token + refresh_token
 *   curl -s --request POST \
 *     'https://auth.ailivinglabs.ap.gov.in/auth/realms/ap-soverign-stack/protocol/openid-connect/token' \
 *     --data-urlencode 'grant_type=password' --data-urlencode 'client_id=data-lake-cli' \
 *     --data-urlencode 'username=<USER>' --data-urlencode 'password=<PASS>' \
 *     --data-urlencode 'scope=openid profile email'
 *
 *   export AILAB_REFRESH_TOKEN=<refresh_token from that response>
 *   node scripts/ingest.mjs msw_door_to_door_collection_api
 *
 * The refresh token lives ~30 minutes (refresh_expires_in 1800) and rotates on every
 * use; this script keeps the newest one, so a continuous pull stays authenticated well
 * past the 300s access-token window. Nothing is persisted except the governed payloads.
 *
 * Pages are fetched three at a time. The bottleneck was never data volume — a million
 * rows is a few hundred megabytes — but request count times latency, because the API
 * pins page size at 100 however you ask. Three-way concurrency measured 0.88s per page
 * against 2.74s serial, turning an eight-hour pull into three.
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
/**
 * Pages fetched in parallel.
 *
 * Measured 2026-09-08 on the PR export: serial is 2.74s per page, two at a time 1.35s,
 * three 0.88s, four 1.03s — four is slower than three, so the upstream saturates just
 * past three. Zero failures at every level tested. Three it is; the September audit's
 * warning about spurious 504s was at roughly thirty.
 */
const CONCURRENCY = 3;

/**
 * Where a pull's raw pages live.
 *
 * A filtered pull gets its own directory. Two months of one dataset written into the
 * same folder would resume across each other and assemble into a set that is neither
 * month — silently, because the page files look identical.
 */
const rawDir = (tableKey, filters = {}) => {
  const keys = Object.keys(filters).sort();
  const suffix = keys.length ? `__${keys.map((key) => `${key}-${filters[key]}`).join('_')}` : '';
  return resolve(process.cwd(), 'data/large-snapshots', `${tableKey}${suffix}`);
};

class Session {
  constructor(refreshToken) {
    this.refreshToken = refreshToken;
    this.accessToken = null;
    this.expiresAt = 0;
    /** In-flight refresh, shared by every caller that finds the token stale. */
    this.refreshing = null;
  }

  async token() {
    if (this.accessToken && Date.now() < this.expiresAt - REFRESH_MARGIN_MS) return this.accessToken;
    // With parallel pages in flight, several can find the token stale at once. Without
    // this latch each would post its own refresh, and because refresh tokens ROTATE the
    // second one would present a token the first had already spent.
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.refresh().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  async refresh() {
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
  const argv = process.argv.slice(2);
  const rest = argv.filter((arg) => arg.startsWith('--') || argv[argv.indexOf(arg) - 1]?.startsWith('--'));
  const tableKeys = argv.filter((arg) => !rest.includes(arg));
  if (!tableKeys.length) {
    console.error('Usage: node scripts/ingest.mjs <tableKey> [...] [--month <YYYYMM>] [--year <YYYY>] [--filter KEY=VALUE] [--fresh]');
    console.error(`Known keys: ${Object.keys(datasets).join(', ')}`);
    process.exit(1);
  }
  // The live API accepts only `month_id` (YYYYMM, e.g. 202607) and `year` as filters —
  // confirmed by the platform audit on 2026-09-03. The source document's per-dataset
  // filter names (mnth_no, dstrt_id, district_id, ulb_id, dstrt_nm) are rejected with a
  // 400, and there is no general district filter. Default to a full unfiltered export.
  // Filter names are per-dataset since the September revision: the SASA keys take
  // `month_id`/`year`, the PR keys take uppercase `MONTH_ID`/`YEAR`. `--filter K=V`
  // passes a name through verbatim rather than guessing which vocabulary applies.
  const filters = {};
  const monthIndex = rest.indexOf('--month');
  if (monthIndex >= 0) filters.month_id = rest[monthIndex + 1];
  const yearIndex = rest.indexOf('--year');
  if (yearIndex >= 0) filters.year = rest[yearIndex + 1];
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== '--filter') continue;
    const [name, ...value] = String(rest[index + 1] ?? '').split('=');
    if (name && value.length) filters[name] = value.join('=');
  }
  const fresh = rest.includes('--fresh');

  const refreshToken = process.env.AILAB_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error('AILAB_REFRESH_TOKEN is not set. Export it for this run only; it is never written to disk.');
    process.exit(1);
  }

  // One Session for every dataset in the run. Refresh tokens ROTATE on use and the new
  // one is held in memory, so a second process started with the original token can find
  // it already spent. Passing several keys to one invocation is therefore not a
  // convenience — it is the only reliable way to pull more than one dataset per token.
  const session = new Session(refreshToken);
  for (const tableKey of tableKeys) {
    console.log(`\n=== ${tableKey} ===`);
    await ingestOne(session, tableKey, filters, fresh);
  }
}

async function ingestOne(session, tableKey, filters, fresh) {
  const dir = rawDir(tableKey, filters);
  await mkdir(dir, { recursive: true });
  const done = fresh ? new Set() : await completedOffsets(dir);
  if (done.size) console.log(`Resuming: ${done.size} page(s) already retrieved.`);

  // The first page establishes the true total, which is what makes the rest
  // parallelisable: offsets can be computed rather than discovered one reply at a time.
  const first = await fetchPage(session, tableKey, filters, done.has(0) ? tokenForOffset(0) : null);
  const total = first.responseMetadata?.totalRecordCount ?? null;
  if (!done.has(0)) {
    await writeFile(resolve(dir, 'page-00000000.json'), JSON.stringify(first), 'utf8');
    done.add(0);
  }
  if (total === null) throw new Error(`${tableKey}: the API returned no totalRecordCount, so the page count is unknown`);

  const offsets = [];
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) if (!done.has(offset)) offsets.push(offset);
  let retained = done.size * PAGE_SIZE;
  let pages = done.size;
  console.log(`  ${total.toLocaleString('en-IN')} rows · ${offsets.length} page(s) to fetch at concurrency ${CONCURRENCY}`);

  for (let index = 0; index < offsets.length; index += CONCURRENCY) {
    const batch = offsets.slice(index, index + CONCURRENCY);
    const payloads = await Promise.all(batch.map((offset) => fetchPage(session, tableKey, filters, tokenForOffset(offset))));
    for (const [position, payload] of payloads.entries()) {
      const rows = Array.isArray(payload.records) ? payload.records : [];
      await writeFile(resolve(dir, `page-${String(batch[position]).padStart(8, '0')}.json`), JSON.stringify(payload), 'utf8');
      retained += rows.length;
      pages += 1;
    }
    if (pages % 75 < CONCURRENCY || index + CONCURRENCY >= offsets.length) {
      console.log(`  ${retained.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')} rows · ${pages} pages`);
    }
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
  console.log(`Raw pages: ${dir.replace(process.cwd() + '/', '')}/  ·  next: node scripts/aggregate.mjs ${tableKey}`);
}

await main();
