#!/usr/bin/env node
/**
 * Bulk waste generators on the reference day, from the retained CDMA daily pages.
 *
 * The two sources (identified, and processing wet waste on site) are secretariat x day.
 * Retrieval returned 3,032 of the 4,023 register secretariats for 2026-08-12, so every total
 * here is for the retained secretariats only, and the file says so. A secretariat whose
 * repeated rows disagree, or whose count is not a number (comma-split names spill into the
 * count column on a few rows), is held out and counted.
 *
 * Run: node scripts/aggregate-bwg.mjs   (reads data/large-snapshots, writes data/aggregates)
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DAY = '2026-08-12';
const SOURCES = [
  { key: 'identification_of_bulk_waste_generators_api', field: 'no_of_bwgs', as: 'identified' },
  { key: 'onsite_processing_of_wet_waste_bwg_api', field: 'wet_waste_processing_bwgs', as: 'processingOnSite' },
];

const provenance = {};
/** Every retained page of one source, after checking the pages against their manifest. */
function pages(key) {
  const dir = `data/large-snapshots/${key}`;
  if (!existsSync(dir)) throw new Error(`Missing retained pages for ${key}; this script needs data/large-snapshots`);
  const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
  const files = readdirSync(dir).filter((name) => /^page-.*\.json$/.test(name)).sort();
  const hash = createHash('sha256');
  const rows = files.flatMap((name) => { const text = readFileSync(`${dir}/${name}`, 'utf8'); hash.update(name).update(text); return JSON.parse(text).records ?? []; });
  if (files.length !== manifest.pages || rows.length !== manifest.retainedRows || manifest.countsAgree !== true) throw new Error(`${key} retention manifest does not reconcile`);
  provenance[key] = { generatedAt: manifest.retrievedAt, rows: rows.length, pages: files.length, reportedTotalRecordCount: manifest.reportedTotalRecordCount, sha256: hash.digest('hex') };
  return rows;
}

const register = JSON.parse(readFileSync('data/aggregates/ulb-service-snapshot.json', 'utf8'));
const registerSecretariats = register.ulbs.reduce((sum, ulb) => sum + ulb.secretariats, 0);

const bySecretariat = new Map();
const held = { conflicting: 0, nonNumeric: 0 };
for (const source of SOURCES) {
  const values = new Map();
  for (const row of pages(source.key).filter((entry) => entry.date1 === DAY)) {
    const id = row.secretariat_code;
    const entry = values.get(id) ?? { raw: new Set(), row };
    entry.raw.add(String(row[source.field] ?? '').trim());
    values.set(id, entry);
  }
  for (const [id, entry] of values) {
    const target = bySecretariat.get(id) ?? { ulbCode: entry.row.ulb_code, districtCode: entry.row.district_code, district: entry.row.district_name };
    if (entry.raw.size > 1) { held.conflicting += 1; target[source.as] = null; }
    else {
      const value = Number([...entry.raw][0]);
      if (!Number.isFinite(value) || [...entry.raw][0] === '') { held.nonNumeric += 1; target[source.as] = null; }
      else target[source.as] = value;
    }
    bySecretariat.set(id, target);
  }
}

// A secretariat counts only when both measures are readable, so the on-site share has one denominator.
const usable = [...bySecretariat.values()].filter((entry) => typeof entry.identified === 'number' && typeof entry.processingOnSite === 'number');
const sum = (rows, field) => rows.reduce((total, row) => total + row[field], 0);
const group = (field) => {
  const map = new Map();
  for (const row of usable) map.set(row[field], [...(map.get(row[field]) ?? []), row]);
  return [...map].map(([code, rows]) => ({ code: String(code), district: rows[0].district, secretariats: rows.length, identified: sum(rows, 'identified'), processingOnSite: sum(rows, 'processingOnSite') }));
};

const out = {
  version: 1,
  day: DAY,
  sources: SOURCES.map((source) => source.key),
  registerSecretariats,
  retainedSecretariats: bySecretariat.size,
  usableSecretariats: usable.length,
  heldOut: held,
  identified: sum(usable, 'identified'),
  processingOnSite: sum(usable, 'processingOnSite'),
  byDistrictCode: group('districtCode').map(({ code, district, secretariats, identified, processingOnSite }) => ({ districtCode: code, district, secretariats, identified, processingOnSite })),
  byUlbCode: group('ulbCode').map(({ code, secretariats, identified, processingOnSite }) => ({ ulbCode: code, secretariats, identified, processingOnSite })),
  generatedFrom: provenance,
  boundary: 'Totals cover only the secretariats retrieval returned for this day; the rest are missing, not zero.',
};
writeFileSync('data/aggregates/bwg-reference-day.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(`${out.usableSecretariats} usable of ${out.retainedSecretariats} retained / ${registerSecretariats} secretariats · ${out.processingOnSite} of ${out.identified} BWGs processing on site · held out ${JSON.stringify(held)}`);
