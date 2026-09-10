/**
 * Completeness diagnostics for a paginated pull.
 *
 *   node scripts/verify-pull.mjs <large-snapshot-dir> [--key COL1,COL2]
 *
 * A pull's manifest records `countsAgree: retainedRows === reportedTotalRecordCount`.
 * That is not a completeness check. This API pins page size at 100 and pages by offset
 * over a result set whose order is not stable, so it can re-serve rows it has already
 * given and skip rows it has not, and the raw count still lands on the reported total,
 * because the count only reflects how many requests were made.
 *
 * Measured on the August PR pull: 280,371 raw rows matching the reported total exactly,
 * carrying only 91,427 distinct panchayat-days, with 187,791 of the repeats spanning
 * pages rather than sitting inside one.
 *
 * So this reports the number that actually matters, distinct keys held, against the
 * observed entity x period grid, plus the shape of the repetition. It asserts nothing
 * about the source: an unobserved combination may never have existed upstream. It draws
 * the distinction the manifest cannot.
 */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/verify-pull.mjs <large-snapshot-dir> [--key COL1,COL2]');
  process.exit(1);
}
const keyIndex = process.argv.indexOf('--key');
const keyCols = keyIndex > 0 && process.argv[keyIndex + 1]
  ? process.argv[keyIndex + 1].split(',')
  : ['GRAM_PANCHAYAT_ID', 'COLLECTION_DATE'];

const files = (await readdir(dir)).filter((name) => /^page-\d+\.json$/.test(name)).sort();
if (!files.length) { console.error(`No pages in ${dir}`); process.exit(1); }

const multiplicity = new Map();
const firstPage = new Map();
const entities = new Set();
const periods = new Set();
let raw = 0, withinPage = 0, acrossPage = 0, missingKey = 0, reported = null;
const signatures = new Map();
let conflicting = 0;

for (const [index, file] of files.entries()) {
  const payload = JSON.parse(await readFile(resolve(dir, file), 'utf8'));
  reported ??= payload.responseMetadata?.totalRecordCount ?? null;
  const seenHere = new Set();
  for (const record of payload.records ?? []) {
    raw += 1;
    const parts = keyCols.map((column) => String(record[column] ?? '').trim());
    if (parts.some((part) => !part)) { missingKey += 1; continue; }
    const key = parts.join('|');
    entities.add(parts[0]);
    if (parts[1] !== undefined) periods.add(parts[1]);
    multiplicity.set(key, (multiplicity.get(key) ?? 0) + 1);

    const signature = JSON.stringify(Object.keys(record).sort().map((column) => [column, record[column]]));
    if (signatures.has(key)) { if (signatures.get(key) !== signature) conflicting += 1; }
    else signatures.set(key, signature);

    if (seenHere.has(key)) withinPage += 1;
    else {
      seenHere.add(key);
      if (firstPage.has(key)) acrossPage += 1; else firstPage.set(key, index);
    }
  }
}

const distinct = multiplicity.size;
const grid = entities.size * (periods.size || 1);
const counts = [...multiplicity.values()];
const spread = new Map();
for (const n of counts) spread.set(n, (spread.get(n) ?? 0) + 1);

const pct = (value) => `${(value * 100).toFixed(2)}%`;
console.log(`pages                    ${files.length.toLocaleString('en-IN')}`);
console.log(`raw rows                 ${raw.toLocaleString('en-IN')}`);
console.log(`reported total           ${reported === null ? '?' : reported.toLocaleString('en-IN')}`);
console.log(`raw === reported         ${reported === raw}  <- says only that enough requests were made`);
console.log('');
console.log(`key                      ${keyCols.join(' | ')}`);
console.log(`distinct keys            ${distinct.toLocaleString('en-IN')}`);
console.log(`rows with no key         ${missingKey.toLocaleString('en-IN')}`);
console.log(`keys w/ conflicts        ${conflicting.toLocaleString('en-IN')}${conflicting ? '  <- hold these out, do not pick one' : '  <- collapse is lossless'}`);
console.log('');
console.log(`distinct entities        ${entities.size.toLocaleString('en-IN')}`);
console.log(`distinct periods         ${periods.size.toLocaleString('en-IN')}`);
console.log(`observed grid            ${grid.toLocaleString('en-IN')}`);
console.log(`grid coverage            ${pct(distinct / grid)}   (${(grid - distinct).toLocaleString('en-IN')} combinations unobserved)`);
console.log('');
console.log(`repeats within a page    ${withinPage.toLocaleString('en-IN')}`);
console.log(`repeats across pages     ${acrossPage.toLocaleString('en-IN')}`);
// Spreading a 400k-element array into Math.min blows the call stack, so fold instead.
let low = Infinity, high = 0;
for (const n of counts) { if (n < low) low = n; if (n > high) high = n; }
console.log(`multiplicity range       ${low} - ${high}`);
console.log('multiplicity distribution (every bucket, not a sample):');
for (const [times, keys] of [...spread.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`   seen ${String(times).padStart(3)}x   ${keys.toLocaleString('en-IN')} keys`);
}
console.log('');
console.log('An unobserved combination is not proof the source lacks it, and matching the');
console.log('reported total is not proof every distinct record was served. Both need a');
console.log('stable source order, an authoritative roster, or an export-side unique count.');
