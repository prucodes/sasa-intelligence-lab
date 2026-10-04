/**
 * Retain the groundwater tables as a dated series.
 *
 *   # copy the token from the playground first; it is read from the clipboard
 *   node scripts/retain-groundwater.mjs [--force] [--date YYYY-MM-DD] [--only <tableKey>]
 *
 * Why this is not `retain-snapshot.mjs`. Every SASA table carries a period, so one file
 * per key is a complete record and re-fetching it is always possible. The groundwater
 * tables carry none: `groundwater_aggregatedreadings_api` advertises `uuid` as its only
 * filter, there is no month or year, and the readings are overwritten in place as
 * stations report. The `Egt` column is an epoch-millisecond stamp on each row, which is
 * the only thing that dates a reading, and it moves. So whatever is not captured on the
 * day it is served is gone, and a retention that overwrote one file would destroy the
 * history it was meant to build. Each run writes its own dated directory instead.
 *
 * Why a partial pull is written rather than refused. `retain-snapshot.mjs` skips anything
 * that does not reconcile, because a half-written SASA snapshot is indistinguishable from
 * a whole one downstream and the source can always be asked again. Here the source cannot
 * be asked again: today's readings stop existing when the stations next report. A partial
 * capture that says so is worth more than no capture, so this writes what it got and
 * records `complete: false` with the exact counts. Nothing downstream may read a file in
 * this series without reading its `coverage` block.
 *
 * Both retrieval routes are used and unioned, because paging drops rows at 100-row page
 * boundaries (see fix-pack/paging-evidence.md) and export has returned a different subset
 * on other tables. Coverage is stated as distinct identities found over the reported
 * total, never as returned rows over the reported total: a returned count equal to the
 * total proves only that enough requests were made.
 *
 * The token is read from the environment for the run only and never written to disk.
 */
import { writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const API_BASE = 'https://datalakes.ailivinglabs.ap.gov.in/api/v1';
const SERIES = resolve(process.cwd(), 'data/groundwater-series');
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const PAGE_ROWS = 100;

/**
 * The tables worth a dated capture, and the column that identifies a row in each.
 *
 * The readings table mixes two grains: a row whose `pname` is "Andhra Pradesh" is a
 * district aggregate over the mandal rows beneath it, so the two must never be summed
 * together. The capture counts them separately so a reader cannot miss it.
 */
const TABLES = [
  { tableKey: 'groundwater_aggregatedreadings_api', identity: 'uuid', label: 'Groundwater aggregated readings' },
  // Despite a description that promises station locations, this holds three rows, one per
  // data source (APWRIMS, DWLR, MERGED_DWLR), all at loctype COUNTRY with hasstation false.
  // It carries no `uuid`; `agencyuuid` is what distinguishes a row. Its `minmax` is the
  // window each source covers, as YYYYMMDD integers, and it is the only place the platform
  // admits that history exists behind the current-state readings.
  { tableKey: 'ground_water_datasources_api', identity: 'agencyuuid', label: 'Groundwater data sources' },
];

/**
 * The token, from the environment or else the clipboard.
 *
 * It is deliberately not a command-line argument. A 300-second token pasted onto a command
 * line ends up in shell history, in the terminal scrollback, and in any screenshot of
 * either, and a paste into the wrong part of the line is executed rather than read. Copy it
 * from the playground and run the command with nothing in it: the token is read here, never
 * echoed, and never written to disk.
 */
function readToken() {
  const fromEnv = process.env.AILAB_ACCESS_TOKEN?.trim();
  if (fromEnv) return { token: fromEnv, source: 'AILAB_ACCESS_TOKEN' };
  if (process.platform !== 'darwin') return {};
  try {
    const clipboard = execFileSync('/usr/bin/pbpaste', { encoding: 'utf8' }).trim();
    // Shape only: three dot-separated base64url segments. This does not validate the token,
    // it just avoids sending whatever else happened to be on the clipboard to the platform.
    if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(clipboard)) return { token: clipboard, source: 'clipboard' };
    return { heldSomethingElse: clipboard.length > 0 };
  } catch {
    return {};
  }
}

const { token, source, heldSomethingElse } = readToken();
if (!token) {
  console.error('No access token found.');
  console.error('Load one on the API playground (Load session token, then Show), copy it, and run this again.');
  if (heldSomethingElse) console.error('The clipboard holds something, but it is not shaped like a token. Copy the token itself.');
  console.error('Do not put the token on the command line; it is read from the clipboard.');
  console.error('It lives 300 seconds, which is ample: these tables are under 1,000 rows.');
  process.exit(1);
}
console.log(`Using the token from the ${source}.`);

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const dateArg = argv[argv.indexOf('--date') + 1];
/** Re-capture one table without touching the others already captured for that day. */
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const day = argv.includes('--date') && /^\d{4}-\d{2}-\d{2}$/.test(dateArg ?? '')
  ? dateArg
  : new Date().toISOString().slice(0, 10);

async function send(path, body) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json();
    const detail = (await response.text()).slice(0, 160);
    // Do not call this an expiry. A 401 on the first call usually means the token was
    // never valid, and saying "expired" sends someone to fetch a second token when the
    // real cause was an unreplaced placeholder or a stray copy.
    if (response.status === 401) {
      throw new Error('HTTP 401 · the platform rejected the token. Check the value was pasted in place of the placeholder, and that it is under 300 seconds old.');
    }
    if (attempt === 4 || !RETRYABLE.has(response.status)) throw new Error(`HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
    await new Promise((wake) => setTimeout(wake, attempt * 1000));
  }
  throw new Error('unreachable');
}

const request = (tableKey, requestId, extra = {}) => ({
  departmentId: 'DEPT-AILABS',
  requestId,
  purpose: 'BENEFIT_DISBURSEMENT',
  tableKey,
  filters: {},
  responseFormat: 'JSON',
  ...extra,
});

const rowsOf = (payload) => payload?.records ?? payload?.data ?? [];

/**
 * Read a column whatever case the platform sends it in. The playground renders the
 * readings table's headers title-cased and the JSON has been lower-cased; a capture that
 * silently found no identity because of casing would look like a table of anonymous rows.
 */
function field(row, name) {
  if (row == null) return undefined;
  if (name in row) return row[name];
  const match = Object.keys(row).find((key) => key.toLowerCase() === name.toLowerCase());
  return match === undefined ? undefined : row[match];
}

/** Page tokens are base64 `{"mode":"offset","value":N}`. */
const offsetToken = (offset) => Buffer.from(JSON.stringify({ mode: 'offset', value: offset })).toString('base64');

async function collect({ tableKey, identity }) {
  const requestId = randomUUID();
  const seen = new Map();
  const routes = {};
  let metadata = {};
  let unidentified = 0;

  const absorb = (payload, route) => {
    const rows = rowsOf(payload);
    let added = 0;
    for (const row of rows) {
      const key = field(row, identity);
      if (!key) { unidentified += 1; continue; }
      if (!seen.has(key)) { seen.set(key, row); added += 1; }
    }
    routes[route] = { returned: (routes[route]?.returned ?? 0) + rows.length, newRows: (routes[route]?.newRows ?? 0) + added };
    if (payload?.responseMetadata) metadata = { ...metadata, ...payload.responseMetadata };
  };

  // Export first: it returns the whole result in one response where it is supported, so it
  // cannot lose rows at a page boundary.
  try {
    absorb(await send(`/datasets/${tableKey}/export?format=json`, request(tableKey, requestId)), 'export');
  } catch (error) {
    routes.export = { failed: String(error.message ?? error) };
  }

  // Then page regardless, because the two routes have returned different subsets before.
  // The reported total is the stopping point for requests, never the proof of completeness.
  const first = await send(`/datasets/${tableKey}/query`, request(tableKey, requestId));
  absorb(first, 'paging');
  const total = first?.responseMetadata?.totalRecordCount ?? null;
  if (total) {
    for (let offset = PAGE_ROWS; offset < total; offset += PAGE_ROWS) {
      absorb(await send(`/datasets/${tableKey}/query`, request(tableKey, requestId, { pageToken: offsetToken(offset) })), 'paging');
    }
  }

  return { requestId, records: [...seen.values()], metadata, routes, total, unidentified };
}

/** The reading timestamps, which are the only thing that dates this data. */
function readingWindow(records) {
  const stamps = records.map((row) => Number(field(row, 'egt'))).filter((value) => Number.isFinite(value) && value > 0);
  if (!stamps.length) return null;
  return { from: new Date(Math.min(...stamps)).toISOString(), to: new Date(Math.max(...stamps)).toISOString(), stamped: stamps.length };
}

/** District aggregates sit in the same table as the mandal rows beneath them. */
function grains(records) {
  const parent = (row) => String(field(row, 'pname') ?? '').trim().toLowerCase();
  const aggregate = records.filter((row) => parent(row) === 'andhra pradesh').length;
  return { districtAggregates: aggregate, subDistrict: records.length - aggregate };
}

const outDir = resolve(SERIES, day);
const alreadyCaptured = new Set((await readdir(outDir).catch(() => [])).filter((name) => name.endsWith('.json')));
// Protection is per table, not per day. A day where one table succeeded and another failed
// must stay open for the one that failed, and re-capturing the one that worked would throw
// away readings that cannot be fetched again.
const wanted = TABLES
  .filter((table) => !only || table.tableKey === only)
  .filter((table) => {
    if (!alreadyCaptured.has(`${table.tableKey}.json`) || force) return true;
    console.log(`· ${table.label} … already captured for ${day}, left alone (--force to replace)`);
    return false;
  });
if (!wanted.length) {
  console.error(only ? `Nothing to do: ${only} is not a groundwater table, or it is already captured for ${day}.` : `Every table is already captured for ${day}. Pass --force to replace, or --date for a different day.`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const summary = [];

for (const table of wanted) {
  process.stdout.write(`· ${table.label} … `);
  let captured;
  try {
    captured = await collect(table);
  } catch (error) {
    console.log(`failed · ${error.message ?? error}`);
    summary.push({ tableKey: table.tableKey, failed: String(error.message ?? error) });
    continue;
  }

  const { records, metadata, routes, total, requestId, unidentified } = captured;
  const complete = total !== null && records.length === total;
  const envelope = {
    requestEcho: { departmentId: 'DEPT-AILABS', requestId, purpose: 'BENEFIT_DISBURSEMENT', tableKey: table.tableKey, filters: {} },
    responseMetadata: {
      responseId: metadata.responseId ?? null,
      generatedAt: metadata.generatedAt ?? null,
      totalRecordCount: total,
      returnedRecordCount: records.length,
      hasNextPage: false,
      nextPageToken: null,
      tableKey: table.tableKey,
      ...(metadata.tableKey && metadata.tableKey !== table.tableKey ? { sourceReportedTableKey: metadata.tableKey } : {}),
      tableName: metadata.tableName ?? table.tableKey,
    },
    // Read this before reading the records. The source has no period, so this block is the
    // only statement of what this file is and how much of that day it holds.
    coverage: {
      retainedAt: new Date().toISOString(),
      capturedFor: day,
      identityField: table.identity,
      distinctIdentities: records.length,
      reportedTotal: total,
      complete,
      ...(complete ? {} : { shortfall: total === null ? 'reported total not supplied' : total - records.length }),
      rowsWithoutIdentity: unidentified,
      routes,
      readingWindow: readingWindow(records),
      grains: grains(records),
      boundary: 'A current-state table with no period column, captured on the date above. It is not a measurement of that date: each row carries its own Egt stamp, and the window is reported beside it. District aggregates and the rows beneath them are both present and must never be summed together.',
    },
    records,
  };

  await writeFile(resolve(outDir, `${table.tableKey}.json`), `${JSON.stringify(envelope, null, 2)}\n`);
  console.log(`${records.length}${total === null ? '' : ` / ${total}`} distinct${complete ? '' : ' · PARTIAL'}`);
  summary.push({ tableKey: table.tableKey, distinct: records.length, total, complete, routes });
}

// A run that captured nothing should leave nothing behind, so a retry is not blocked and
// the series never carries an empty day that looks like a day with no readings.
if (summary.every((row) => row.failed) && !alreadyCaptured.size) {
  await rm(outDir, { recursive: true, force: true }).catch(() => {});
  console.error(`\nNothing was captured, so data/groundwater-series/${day} was not kept. Load a fresh token and run again.`);
  process.exit(1);
}

console.log(`\nWritten to data/groundwater-series/${day}`);
for (const row of summary) {
  if (row.failed) { console.log(`  ${row.tableKey}: FAILED · ${row.failed}`); continue; }
  const parts = Object.entries(row.routes).map(([name, stat]) => (stat.failed ? `${name} failed` : `${name} +${stat.newRows} of ${stat.returned}`));
  console.log(`  ${row.tableKey}: ${row.distinct} distinct of ${row.total ?? '?'} reported · ${parts.join(' · ')}`);
}
if (summary.some((row) => row.failed || row.complete === false)) {
  console.log('\nAt least one table is partial or failed. The file records that; do not describe it as a complete day.');
}
