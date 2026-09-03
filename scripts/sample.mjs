/**
 * Stratified sample of a large Data Lake dataset, to judge fill rate before
 * committing to a full ingest.
 *
 *   AILAB_ACCESS_TOKEN=<300s accessToken from /playground/token> \
 *   node scripts/sample.mjs <tableKey> [--pages 25] [--district <code>]
 *
 * A 64,000-row dataset is ~640 pages of 100. Paging through all of them needs a
 * refresh token and ten-plus minutes; but the only question here — is the measure
 * column actually populated, or all zeros? — is answered by a spread. So this
 * hits evenly-spaced offsets across the whole file and reports the distribution.
 * Twenty-five pages is 2,500 rows drawn from end to end, which fits inside one
 * 300-second access token.
 *
 * Reads the token from the environment for the run only; never from disk.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const API_BASE = 'https://datalakes.ailivinglabs.ap.gov.in/api/v1';
const PAGE_SIZE = 100;

function tokenForOffset(offset) {
  return Buffer.from(JSON.stringify({ mode: 'offset', value: offset })).toString('base64');
}

async function fetchPage(accessToken, tableKey, filters, offset) {
  const body = { departmentId: 'DEPT-AILABS', purpose: 'BENEFIT_DISBURSEMENT', filters, responseFormat: 'JSON' };
  if (offset > 0) body.pageToken = tokenForOffset(offset);
  const response = await fetch(`${API_BASE}/datasets/${tableKey}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} at offset ${offset}: ${(await response.text()).slice(0, 180)}`);
  }
  return response.json();
}

const num = (value) => Number(String(value ?? '').replace(/,/g, ''));

async function main() {
  const [tableKey, ...rest] = process.argv.slice(2);
  if (!tableKey) { console.error('Usage: node scripts/sample.mjs <tableKey> [--pages N] [--district code]'); process.exit(1); }
  const pagesWanted = rest.includes('--pages') ? Number(rest[rest.indexOf('--pages') + 1]) : 25;
  const districtIndex = rest.indexOf('--district');
  const filters = districtIndex >= 0 ? { district_code: rest[districtIndex + 1] } : {};

  const accessToken = process.env.AILAB_ACCESS_TOKEN;
  if (!accessToken) { console.error('AILAB_ACCESS_TOKEN is not set. Paste the 300s token from /playground/token for this run only.'); process.exit(1); }

  // First page tells us the true total and the column names.
  const first = await fetchPage(accessToken, tableKey, filters, 0);
  const total = first.responseMetadata?.totalRecordCount ?? 0;
  const lastOffset = Math.max(0, Math.floor((total - 1) / PAGE_SIZE) * PAGE_SIZE);
  const step = pagesWanted > 1 ? Math.max(PAGE_SIZE, Math.floor(lastOffset / (pagesWanted - 1) / PAGE_SIZE) * PAGE_SIZE) : PAGE_SIZE;

  const offsets = [];
  for (let o = 0; o <= lastOffset && offsets.length < pagesWanted; o += step) offsets.push(o);
  if (offsets[offsets.length - 1] !== lastOffset) offsets.push(lastOffset);

  console.log(`${tableKey}: ${total.toLocaleString('en-IN')} rows total · sampling ${offsets.length} pages (${(offsets.length * PAGE_SIZE).toLocaleString('en-IN')} rows) at step ${step}`);

  const rows = [...(first.records ?? [])];
  const pages = [{ offset: 0, payload: first }];
  for (const offset of offsets.slice(1)) {
    const payload = await fetchPage(accessToken, tableKey, filters, offset);
    pages.push({ offset, payload });
    rows.push(...(payload.records ?? []));
    await new Promise((done) => setTimeout(done, 350)); // concurrency 1; 504s appear under load
  }

  // Fill-rate on every measure-looking column.
  const ident = new Set(['date1','district_name','district_code','ulb_name','ulb_code','sachivalayam_name','sachivalayam_code','secretariat_name','secretariat_code','active_indicator','i_ts','u_ts','s_no','api_lgd_dist_code','api_district_name','api_lgd_mandal_code','api_mandal_name','month_name','mnth_nm','fin_year','year']);
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => !ident.has(c));
  console.log(`\nsampled ${rows.length} rows · ${new Set(rows.map((r) => r.district_name)).size} districts · ${new Set(rows.map((r) => r.ulb_name)).size} ULBs`);
  console.log('\ncolumn                         nonzero   zero   blank   sum        max');
  for (const col of cols) {
    let nonzero = 0, zero = 0, blank = 0, sum = 0, max = 0;
    for (const r of rows) {
      const raw = r[col];
      if (raw === undefined || raw === null || raw === '') { blank++; continue; }
      const n = num(raw);
      if (Number.isFinite(n)) { if (n === 0) zero++; else { nonzero++; sum += n; if (n > max) max = n; } }
      else blank++;
    }
    console.log(`${col.padEnd(30)} ${String(nonzero).padStart(6)} ${String(zero).padStart(6)} ${String(blank).padStart(6)}  ${String(Math.round(sum)).padStart(9)}  ${String(max).padStart(6)}`);
  }

  const dir = resolve(process.cwd(), 'data/samples');
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, `${tableKey}.sample.json`), JSON.stringify({ tableKey, total, offsets, sampledRows: rows.length, rows }, null, 2), 'utf8');
  console.log(`\nSaved data/samples/${tableKey}.sample.json`);
}

await main();
