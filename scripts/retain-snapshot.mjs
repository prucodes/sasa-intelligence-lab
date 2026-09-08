/**
 * Retain a Data Lake dataset as a complete governed snapshot envelope.
 *
 *   AILAB_ACCESS_TOKEN=<300s token from /playground/token> \
 *   node scripts/retain-snapshot.mjs <tableKey> [<tableKey> ...]
 *
 * Writes the same envelope shape the large `ingest.mjs` pulls produce — requestEcho,
 * responseMetadata, records — directly into data/full-snapshots, so a retained dataset
 * looks identical downstream however it was fetched.
 *
 * It pages through the whole dataset and refuses to write a partial retention. A snapshot
 * holding only the first 100 of 336 rows would be indistinguishable from a complete one
 * downstream, and `isCompleteSnapshot` would still call it complete — so anything that
 * does not reconcile to the reported total is skipped rather than written.
 *
 * A 64,000-row dataset is ~640 pages, which does not fit inside one 300-second access
 * token. Rather than requiring the password grant (which only the account holder may
 * run), pages are cached under data/.retain-cache and the run resumes where it stopped.
 * So a large pull is: fetch a fresh token, run, repeat. The envelope is only written
 * once the cached rows reconcile to the reported total.
 *
 * The token is read from the environment for the run only and never written to disk.
 * Run `npm run fingerprint` afterwards to record the new vintage.
 */
import { writeFile, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const API_BASE = 'https://datalakes.ailivinglabs.ap.gov.in/api/v1';
const OUT = resolve(process.cwd(), 'data/full-snapshots');
const LARGE = resolve(process.cwd(), 'data/large-snapshots');
const CACHE = resolve(process.cwd(), 'data/.retain-cache');

/**
 * Rows above which a retained export is evidence on disk rather than bundled data.
 *
 * `lib/snapshots.ts` imports every file in data/full-snapshots statically, so each one
 * ships to the browser. The whole bundled corpus is ~6,500 rows; the PR gram-panchayat
 * export alone is 26,702 rows / 7.7 MB, and the CDMA secretariat-day files are ~64,500
 * rows each. Those belong in data/large-snapshots (git-ignored), where `aggregate.mjs`
 * can roll them up to something small enough to bundle. Retaining them is still worth
 * doing — it is the difference between "not pulled" and "pulled, too big to ship".
 */
const BUNDLE_ROW_LIMIT = 2_000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Page tokens are base64 `{"mode":"offset","value":N}`, so any offset can be resumed. */
const tokenForOffset = (offset) => Buffer.from(JSON.stringify({ mode: 'offset', value: offset })).toString('base64');

async function cachedPages(tableKey) {
  try {
    const files = (await readdir(resolve(CACHE, tableKey))).filter((name) => name.endsWith('.json')).sort();
    const pages = [];
    for (const file of files) pages.push(JSON.parse(await readFile(resolve(CACHE, tableKey, file), 'utf8')));
    return pages;
  } catch {
    return [];
  }
}

async function query(token, tableKey, requestId, pageToken = null) {
  const body = {
    departmentId: 'DEPT-AILABS',
    requestId,
    purpose: 'BENEFIT_DISBURSEMENT',
    tableKey,
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
    if (attempt === 4 || !RETRYABLE.has(response.status)) {
      throw new Error(`HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
    }
    await new Promise((done) => setTimeout(done, attempt * 1_000));
  }
  throw new Error('unreachable');
}

async function main() {
  const keys = process.argv.slice(2);
  if (!keys.length) {
    console.error('Usage: AILAB_ACCESS_TOKEN=<token> node scripts/retain-snapshot.mjs <tableKey> [...]');
    process.exit(1);
  }
  const token = process.env.AILAB_ACCESS_TOKEN;
  if (!token) {
    console.error('AILAB_ACCESS_TOKEN is not set. Use a temporary token from /playground/token.');
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  let written = 0;
  for (const tableKey of keys) {
    const requestId = `req-${randomUUID()}`;
    const cacheDir = resolve(CACHE, tableKey);
    try {
      const cached = await cachedPages(tableKey);
      const records = cached.flatMap((page) => page.records ?? []);
      let metadata = cached[0]?.responseMetadata ?? {};
      let pages = cached.length;
      if (pages) console.log(`  … ${tableKey} · resuming from ${records.length.toLocaleString('en-IN')} cached rows`);

      let expired = false;
      for (;;) {
        const total = metadata.totalRecordCount;
        if (total !== undefined && records.length >= total) break;
        let payload;
        try {
          payload = await query(token, tableKey, requestId, records.length ? tokenForOffset(records.length) : null);
        } catch (error) {
          // An expired token is not a failed pull — the cache holds everything so far.
          if (String(error.message).startsWith('HTTP 401')) { expired = true; break; }
          throw error;
        }
        const page = payload.responseMetadata ?? {};
        if (!pages) metadata = page;
        const rows = Array.isArray(payload.records) ? payload.records : [];
        if (!rows.length) break;
        await mkdir(cacheDir, { recursive: true });
        await writeFile(resolve(cacheDir, `page-${String(records.length).padStart(8, '0')}.json`), JSON.stringify(payload), 'utf8');
        records.push(...rows);
        pages += 1;
        if (pages % 50 === 0) console.log(`     ${records.length.toLocaleString('en-IN')} / ${(page.totalRecordCount ?? '?').toLocaleString?.('en-IN') ?? '?'} rows`);
        if (!page.hasNextPage || !page.nextPageToken) break;
        await new Promise((done) => setTimeout(done, 120));
      }
      // Never fall back to records.length for the total. If no page ever succeeded,
      // `0 === 0` would reconcile and write an empty envelope that isCompleteSnapshot
      // reports as complete — the precise failure this script exists to prevent.
      const total = metadata.totalRecordCount;
      if (total === undefined) {
        console.error(`  ⟳ ${tableKey} · no page retrieved${expired ? ' (token expired before the first request)' : ''}. Nothing written — rerun with a fresh token.`);
        continue;
      }
      if (expired || records.length !== total) {
        console.error(`  ⟳ ${tableKey} · ${records.length.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} rows cached${expired ? ' (token expired)' : ''}. Nothing written — rerun with a fresh token to continue.`);
        continue;
      }

      const envelope = {
        requestEcho: { departmentId: 'DEPT-AILABS', requestId, purpose: 'BENEFIT_DISBURSEMENT', tableKey, filters: {} },
        responseMetadata: {
          responseId: metadata.responseId ?? null,
          generatedAt: metadata.generatedAt ?? null,
          totalRecordCount: total,
          returnedRecordCount: records.length,
          hasNextPage: false,
          nextPageToken: null,
          // The requested key, not the one the response echoes back. Gobardhan is
          // requested as `sasa_establishment_of_gobardhan_units_api` and answers with
          // `gobardhanunits_api`; keying the snapshot on the reply would make the whole
          // app unable to find a dataset it successfully retrieved. The platform's own
          // value is kept beside it rather than discarded.
          tableKey,
          ...(metadata.tableKey && metadata.tableKey !== tableKey ? { sourceReportedTableKey: metadata.tableKey } : {}),
          tableName: metadata.tableName ?? tableKey,
          exportedPageCount: pages,
        },
        records,
      };
      const bundled = records.length <= BUNDLE_ROW_LIMIT;
      const target = bundled ? OUT : LARGE;
      await mkdir(target, { recursive: true });
      await writeFile(resolve(target, `${tableKey}.json`), `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
      await rm(cacheDir, { recursive: true, force: true });
      console.log(`  ✓ ${tableKey} · ${records.length.toLocaleString('en-IN')} rows retained across ${pages} page(s)`
        + (bundled ? '' : ` → data/large-snapshots (over ${BUNDLE_ROW_LIMIT.toLocaleString('en-IN')} rows; aggregate it before bundling)`));
      written += 1;
    } catch (error) {
      console.error(`  ✗ ${tableKey} · ${error.message}`);
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  console.log(`\n${written}/${keys.length} retained into data/full-snapshots. Next: npm run fingerprint`);
}

await main();
