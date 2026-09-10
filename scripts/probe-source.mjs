/**
 * The two questions the retained data cannot answer, and the requests that settle them.
 *
 *   AILAB_ACCESS_TOKEN=<300s token>  node scripts/probe-source.mjs
 *   node scripts/probe-source.mjs --token-file /private/tmp/sasa-session-access-token
 *
 * A. Is the paginator stable? Fetch one offset repeatedly. Identical responses mean the
 *    result order is stable and the observed 1-23x multiplicity is the source repeating
 *    itself. Different responses mean the window moves between requests, which is how a
 *    pull can match its reported row count while never being served some records.
 *
 * B. Does August exist beyond the 7th? The month filter returns 2026-08-01..07 only. That
 *    does not establish the source lacks later dates — it establishes that this query
 *    does not return them. Ask by date instead, with a known-good date as the control:
 *    if the control returns nothing either, date filtering does not work on this table
 *    and the whole test is void rather than evidence of missing data.
 */
const KEY = 'sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026';
const BASE = 'https://datalakes.ailivinglabs.ap.gov.in/api/v1';
const OFFSET = 5_000;
const REPEATS = 3;

const fileIndex = process.argv.indexOf('--token-file');
let token = process.env.AILAB_ACCESS_TOKEN ?? null;
if (fileIndex > 0 && process.argv[fileIndex + 1]) {
  token = (await (await import('node:fs/promises')).readFile(process.argv[fileIndex + 1], 'utf8')).trim();
}
if (!token) { console.error('Need AILAB_ACCESS_TOKEN or --token-file. Never commit either.'); process.exit(1); }

const at = (offset) => Buffer.from(JSON.stringify({ mode: 'offset', value: offset })).toString('base64');
async function query(filters, pageToken) {
  const response = await fetch(`${BASE}/datasets/${KEY}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ departmentId: 'DEPT-AILABS', purpose: 'BENEFIT_DISBURSEMENT', filters, responseFormat: 'JSON', ...(pageToken ? { pageToken } : {}) }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) return { error: `HTTP ${response.status} ${(await response.text()).slice(0, 120)}` };
  const payload = await response.json();
  return { total: payload.responseMetadata?.totalRecordCount ?? null, records: payload.records ?? [] };
}
const keysOf = (records) => records.map((r) => `${r.GRAM_PANCHAYAT_ID}|${r.COLLECTION_DATE}`);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

console.log(`A. PAGINATOR STABILITY — offset ${OFFSET.toLocaleString('en-IN')} fetched ${REPEATS}x\n`);
const runs = [];
for (let n = 0; n < REPEATS; n += 1) {
  const result = await query({ MONTH_ID: '8', YEAR: '2026' }, at(OFFSET));
  if (result.error) { console.log(`   run ${n + 1}: ${result.error}`); runs.length = 0; break; }
  runs.push(keysOf(result.records));
  console.log(`   run ${n + 1}: ${result.records.length} rows`);
  await sleep(1500);
}
if (runs.length === REPEATS) {
  const [first] = runs;
  const identical = runs.every((run) => run.length === first.length && run.every((k, i) => k === first[i]));
  const overlaps = runs.slice(1).map((run) => run.filter((k) => first.includes(k)).length);
  console.log(`\n   identical order and content : ${identical}`);
  console.log(`   overlap with run 1          : ${overlaps.join(', ')} of ${first.length}`);
  console.log(identical
    ? '\n   => STABLE. The repetition is in the source, not the paginator, and a pull that\n      matches the reported total did see every row it was going to see.'
    : '\n   => UNSTABLE. The window moves between identical requests, so matching the reported\n      total does NOT establish that every distinct record was served. Stop on distinct-key\n      saturation and partition the query to keep offsets shallow.');
}

console.log('\n\nB. AUGUST BEYOND THE 7TH\n');
for (const [label, filters] of [
  ['month filter MONTH_ID=8', { MONTH_ID: '8', YEAR: '2026' }],
  ['2026-08-05 (CONTROL)', { COLLECTION_DATE: '2026-08-05' }],
  ['2026-08-15', { COLLECTION_DATE: '2026-08-15' }],
  ['2026-08-20', { COLLECTION_DATE: '2026-08-20' }],
  ['2026-08-31', { COLLECTION_DATE: '2026-08-31' }],
  ['no filter at all', {}],
]) {
  const result = await query(filters);
  if (result.error) { console.log(`   ${label.padEnd(26)} ${result.error}`); continue; }
  const dates = [...new Set(result.records.map((r) => r.COLLECTION_DATE))].sort();
  console.log(`   ${label.padEnd(26)} total=${String(result.total ?? '?').padStart(9)}  rows=${String(result.records.length).padStart(3)}  ${dates.slice(0, 3).join(', ') || '(none)'}`);
  await sleep(1500);
}
console.log('\n\nC. WHICH MONTHS EXIST, AND HOW MANY DAYS EACH\n');
console.log('   One request per month. No pull needed: the reported total alone gives the day');
console.log('   count, because July and August both landed on exactly GPs x days x 3');
console.log('   (13,351 x 31 x 3 = 1,241,643 and 13,351 x 7 x 3 = 280,371). That identity is');
console.log('   consistent with three copies per panchayat-day but does not prove it, so treat');
console.log('   the inferred days as a strong estimate to confirm, not a measurement.\n');
const GPS = 13_351;
for (const year of ['2026', '2027']) {
  for (let month = 1; month <= 12; month += 1) {
    const result = await query({ MONTH_ID: String(month), YEAR: year });
    if (result.error) { console.log(`   ${year}-${String(month).padStart(2, '0')}  ${result.error}`); await sleep(800); continue; }
    const total = result.total ?? 0;
    if (!total) { console.log(`   ${year}-${String(month).padStart(2, '0')}  \u2014`); await sleep(800); continue; }
    const days = total / (GPS * 3);
    const clean = Number.isInteger(days);
    const pages = Math.ceil(total / 100);
    console.log(`   ${year}-${String(month).padStart(2, '0')}  ${total.toLocaleString('en-IN').padStart(11)} rows  ~${clean ? days : days.toFixed(2)} days${clean ? '' : ' (does NOT divide cleanly \u2014 check)'}  ${pages.toLocaleString('en-IN')} pages`);
    await sleep(800);
  }
}
console.log('\n   Pages x ~1.0s at shallow offsets, degrading past ~1.8s beyond a million rows.');
console.log('   Partition by COLLECTION_DATE to keep every offset shallow and the rate flat.');

console.log(`
   Read it this way:
     control empty      -> date filtering does not work here; this test proves nothing.
     control has rows, 15/20/31 empty -> the source genuinely stops at the 7th.
     15/20/31 have rows -> the data is there and the month filter was the wrong question.`);
