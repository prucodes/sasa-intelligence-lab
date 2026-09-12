/**
 * The two urban secretariat-day files, exactly as the aggregates read them.
 *
 * The 8 September paged pull reconciles on row count, but for 2026-08-12 it holds only
 * 3,024 of the 4,023 secretariats: the rest of the count is repeats. The 11 September
 * per-district exports return every secretariat for that day, and agree with the pull on
 * every row both contain. When that day has been retained on its own, under
 * data/large-snapshots/reference-day/<key>, its rows replace the pull's rows for that date
 * only. Every other date is still the 8 September pull, and the provenance says so.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const LARGE = resolve(process.cwd(), 'data/large-snapshots');
const fail = (message) => { throw new Error(`Urban source withheld: ${message}`); };

async function readPages(dir) {
  const manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8'));
  const files = (await readdir(dir)).filter((file) => /^page-.*\.json$/.test(file)).sort();
  const rows = [];
  const hash = createHash('sha256');
  for (const file of files) {
    const text = await readFile(resolve(dir, file), 'utf8');
    hash.update(file).update(text);
    rows.push(...JSON.parse(text).records);
  }
  return { manifest, files, rows, sha256: hash.digest('hex') };
}

export async function loadUrbanSource(key) {
  const pull = await readPages(resolve(LARGE, key));
  if (pull.files.length !== pull.manifest.pages || pull.rows.length !== pull.manifest.retainedRows || pull.manifest.countsAgree !== true) {
    fail(`${key} retention manifest does not reconcile`);
  }
  const provenance = { generatedAt: pull.manifest.retrievedAt, rows: pull.rows.length, pages: pull.files.length, reportedTotalRecordCount: pull.manifest.reportedTotalRecordCount, sha256: pull.sha256 };

  const dayDir = resolve(LARGE, 'reference-day', key);
  if (!existsSync(resolve(dayDir, 'manifest.json'))) return { key, rows: pull.rows, provenance };

  const day = await readPages(dayDir);
  const { day: date, retainedRows, pages, secretariats, expectedSecretariats } = day.manifest;
  const codes = new Set(day.rows.map((row) => String(row.sachivalayam_code ?? '').trim()));
  if (day.files.length !== pages || day.rows.length !== retainedRows) fail(`${key} reference day manifest does not reconcile`);
  if (!day.rows.every((row) => row.date1 === date)) fail(`${key} reference day holds another date`);
  if (codes.size !== day.rows.length || codes.size !== secretariats || secretariats !== expectedSecretariats) fail(`${key} reference day is not one complete row per secretariat`);

  return {
    key,
    rows: [...pull.rows.filter((row) => row.date1 !== date), ...day.rows],
    provenance: {
      ...provenance,
      referenceDay: { day: date, generatedAt: day.manifest.retrievedAt, rows: day.rows.length, secretariats, sources: day.manifest.sources, sha256: day.sha256 },
    },
  };
}
