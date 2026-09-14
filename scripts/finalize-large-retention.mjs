/**
 * Validate the large exports already retained under data/large-snapshots and
 * reconcile their completion into data/current-catalogue.json.
 *
 * This is deliberately separate from a live pull. It never invents a total:
 * every page must carry the same upstream total, offsets must be contiguous,
 * and the sum of records on disk must equal that total before a route is
 * marked retained.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('data/large-snapshots');
const reportPath = resolve('data/current-catalogue.json');
const auditPath = resolve('data/large-retention-audit.json');

const pageFiles = async (dir) => (await readdir(dir))
  .filter((name) => /^page-\d+\.json$/.test(name))
  .sort((a, b) => Number(a.slice(5, -5)) - Number(b.slice(5, -5)));

async function validatePagedDirectory(relativeDir, tableKey) {
  const dir = resolve(root, relativeDir);
  const files = await pageFiles(dir);
  if (!files.length) throw new Error(`${tableKey}: no retained pages in ${relativeDir}`);
  let rows = 0;
  let total = null;
  let generatedAt = null;
  for (let index = 0; index < files.length; index += 1) {
    const name = files[index];
    const offset = Number(name.slice(5, -5));
    if (offset !== index * 100) throw new Error(`${tableKey}: page offset gap at ${name}`);
    const payload = JSON.parse(await readFile(resolve(dir, name), 'utf8'));
    const metadata = payload.responseMetadata ?? {};
    if (metadata.tableKey && metadata.tableKey !== tableKey) throw new Error(`${tableKey}: wrong table key in ${name}`);
    if (!Number.isInteger(metadata.totalRecordCount)) throw new Error(`${tableKey}: missing total in ${name}`);
    if (total === null) total = metadata.totalRecordCount;
    if (metadata.totalRecordCount !== total) throw new Error(`${tableKey}: total changed in ${name}`);
    if (!Array.isArray(payload.records)) throw new Error(`${tableKey}: records absent in ${name}`);
    rows += payload.records.length;
    generatedAt = generatedAt && generatedAt > metadata.generatedAt ? generatedAt : metadata.generatedAt;
    if (index < files.length - 1 && metadata.hasNextPage !== true) throw new Error(`${tableKey}: pagination ended early at ${name}`);
    if (index === files.length - 1 && (metadata.hasNextPage === true || metadata.nextPageToken)) throw new Error(`${tableKey}: final page still has a next token`);
  }
  if (rows !== total) throw new Error(`${tableKey}: retained ${rows} rows, source reported ${total}`);
  return { tableKey, rows, pages: files.length, generatedAt, evidencePaths: [`data/large-snapshots/${relativeDir}`] };
}

async function validateEnvelope(relativePath, tableKey) {
  const payload = JSON.parse(await readFile(resolve(relativePath), 'utf8'));
  const metadata = payload.responseMetadata ?? {};
  const rows = payload.records;
  if (!Array.isArray(rows) || rows.length !== metadata.totalRecordCount || metadata.hasNextPage || metadata.nextPageToken) {
    throw new Error(`${tableKey}: standalone export is incomplete`);
  }
  return { tableKey, rows: rows.length, pages: metadata.exportedPageCount ?? 1, generatedAt: metadata.generatedAt, evidencePaths: [relativePath.replace(`${process.cwd()}/`, '')] };
}

const sources = [
  { tableKey: 'msw_door_to_door_collection_api', dirs: ['msw_door_to_door_collection_api'] },
  { tableKey: 'identification_of_bulk_waste_generators_api', dirs: ['identification_of_bulk_waste_generators_api'] },
  { tableKey: 'onsite_processing_of_wet_waste_bwg_api', dirs: ['onsite_processing_of_wet_waste_bwg_api'] },
  { tableKey: 'waste_egregation_api', dirs: ['waste_egregation_api'] },
  { tableKey: 'sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026', dirs: [
    'sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026__MONTH_ID-5_YEAR-2026',
    'sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026__MONTH_ID-6_YEAR-2026',
    'sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026__MONTH_ID-7_YEAR-2026',
    'sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026__MONTH_ID-8_YEAR-2026',
  ] },
  { tableKey: 'sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api_27_aug_2026', envelope: 'data/large-snapshots/sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api_27_aug_2026.json' },
];

const results = [];
for (const source of sources) {
  if (source.envelope) results.push(await validateEnvelope(source.envelope, source.tableKey));
  else {
    const parts = await Promise.all(source.dirs.map((dir) => validatePagedDirectory(dir, source.tableKey)));
    results.push({
      tableKey: source.tableKey,
      rows: parts.reduce((sum, part) => sum + part.rows, 0),
      pages: parts.reduce((sum, part) => sum + part.pages, 0),
      generatedAt: parts.map((part) => part.generatedAt).filter(Boolean).sort().at(-1),
      evidencePaths: parts.flatMap((part) => part.evidencePaths),
    });
  }
}

const report = JSON.parse(await readFile(reportPath, 'utf8'));
const byKey = new Map(results.map((result) => [result.tableKey, result]));
for (const item of report.datasets) {
  const result = byKey.get(item.key);
  if (!result) continue;
  delete item.error;
  Object.assign(item, {
    status: 'retained',
    retainedRows: result.rows,
    pages: result.pages,
    rawCountReconciled: true,
    retentionMethod: 'Authenticated governed export / paginated retention',
    retainedAt: result.generatedAt,
    evidencePath: result.evidencePaths[0],
    evidencePaths: result.evidencePaths,
    scope: 'Complete retained source response; distinct-key completeness remains unproven',
  });
}
report.retentionAuditAt = new Date().toISOString();
report.largeRetention = {
  routes: results.length,
  rows: results.reduce((sum, result) => sum + result.rows, 0),
  pages: results.reduce((sum, result) => sum + result.pages, 0),
  tableKeys: results.map((result) => result.tableKey),
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify({ auditedAt: report.retentionAuditAt, routes: results }, null, 2)}\n`);
console.log(`Validated ${results.length} large routes: ${report.largeRetention.rows.toLocaleString('en-IN')} rows across ${report.largeRetention.pages.toLocaleString('en-IN')} pages.`);
