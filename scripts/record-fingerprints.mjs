import { writeFile } from 'node:fs/promises';
import { fingerprintDirectory, manifestPath } from './fingerprint.mjs';

const manifest = await fingerprintDirectory();
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const datasets = Object.values(manifest.datasets);
const periods = datasets.reduce((total, dataset) => total + Object.keys(dataset.periods).length, 0);
const rows = datasets.reduce((total, dataset) => total + dataset.rows, 0);

console.log(`Recorded ${datasets.length} dataset fingerprints across ${periods} reported periods and ${rows.toLocaleString('en-IN')} rows.`);
console.log(`Manifest written to data/snapshot-fingerprints.json. Commit it so later retrievals can be compared against this vintage.`);
