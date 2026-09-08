/**
 * Roll the PR gram-panchayat export up to district grain so it can ship.
 *
 *   node scripts/aggregate-rural.mjs
 *
 * `sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api_27_aug_2026` is 26,702
 * rows / 7.7 MB — retained as evidence in data/large-snapshots, far too large to bundle
 * into a static site. It is also the only rural evidence the product has: 12,874 gram
 * panchayats across 659 blocks, with SWPC presence and working condition.
 *
 * The rollup keeps the evidence rules that apply everywhere else:
 *  - a gram panchayat appearing on several rows counts once, and only when every one of
 *    those rows agrees; a panchayat whose rows disagree is held out and counted;
 *  - blank and whitespace-only values are "not stated", never "No" and never zero;
 *  - the district totals reconcile to the panchayats actually counted, not to a claimed
 *    denominator.
 *
 * Output: data/aggregates/rural-swpc-districts.json (small, committed, bundled).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const LARGE = resolve(process.cwd(), 'data/large-snapshots');
const OUT = resolve(process.cwd(), 'data/aggregates');
const RATHAMS = 'sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api_27_aug_2026';
const OPERATORS = 'sasa_pr_no_of_swpcs_operationalised_api_27_aug_2026';

const text = (value) => String(value ?? '').trim();
/** Present but empty is an absent observation, not a negative one. */
const stated = (value) => text(value) !== '';

async function main() {
  const source = JSON.parse(await readFile(resolve(LARGE, `${RATHAMS}.json`), 'utf8'));
  const operatorsSource = JSON.parse(
    await readFile(resolve(process.cwd(), 'data/full-snapshots', `${OPERATORS}.json`), 'utf8'),
  );

  // One entry per gram panchayat, built only from rows that agree with each other.
  const panchayats = new Map();
  let heldOut = 0;
  for (const row of source.records) {
    const id = text(row.GRAM_PANCHAYAT_ID);
    if (!id) { heldOut += 1; continue; }
    const signature = `${text(row.GP_HAVING_SWPC)}|${text(row.WORKING_CONDITION)}`;
    const existing = panchayats.get(id);
    if (!existing) {
      panchayats.set(id, {
        district: text(row.DISTRICT_NAME),
        districtId: text(row.DISTRICT_ID),
        block: text(row.BLOCK_NAME),
        hasSwpc: text(row.GP_HAVING_SWPC),
        condition: text(row.WORKING_CONDITION),
        signature,
        disputed: false,
      });
      continue;
    }
    if (existing.signature !== signature) existing.disputed = true;
  }

  const districts = new Map();
  for (const entry of panchayats.values()) {
    if (!districts.has(entry.districtId)) {
      districts.set(entry.districtId, {
        districtId: entry.districtId,
        district: entry.district,
        panchayats: 0,
        blocks: new Set(),
        withSwpc: 0,
        withoutSwpc: 0,
        swpcNotStated: 0,
        fullyFunctioning: 0,
        partiallyFunctioning: 0,
        notFunctioning: 0,
        conditionNotStated: 0,
        disputed: 0,
      });
    }
    const district = districts.get(entry.districtId);
    if (entry.disputed) { district.disputed += 1; continue; }
    district.panchayats += 1;
    if (entry.block) district.blocks.add(entry.block);
    if (!stated(entry.hasSwpc)) district.swpcNotStated += 1;
    else if (entry.hasSwpc.toLowerCase() === 'yes') district.withSwpc += 1;
    else district.withoutSwpc += 1;

    const condition = entry.condition.toLowerCase();
    if (!stated(entry.condition)) district.conditionNotStated += 1;
    else if (condition.startsWith('fully')) district.fullyFunctioning += 1;
    else if (condition.startsWith('partially')) district.partiallyFunctioning += 1;
    else district.notFunctioning += 1;
  }

  // Mandal operators, deduplicated the same way: identical repeats collapse to one.
  const operators = new Map();
  for (const row of operatorsSource.records) {
    const id = text(row.DISTRICT_ID);
    const signature = `${text(row.SWACHCH_RATHAM_MANDAL_OPERATORS)}|${text(row.SWACHCH_RATHAM_REPORTED_MANDAL_OPERATORS)}`;
    const existing = operators.get(id);
    if (!existing) {
      operators.set(id, {
        operators: Number(text(row.SWACHCH_RATHAM_MANDAL_OPERATORS)),
        reported: Number(text(row.SWACHCH_RATHAM_REPORTED_MANDAL_OPERATORS)),
        signature,
        disputed: false,
      });
    } else if (existing.signature !== signature) existing.disputed = true;
  }

  const rows = [...districts.values()]
    .map((district) => {
      const operator = operators.get(district.districtId);
      return {
        districtId: district.districtId,
        district: district.district,
        panchayats: district.panchayats,
        blocks: district.blocks.size,
        withSwpc: district.withSwpc,
        withoutSwpc: district.withoutSwpc,
        swpcNotStated: district.swpcNotStated,
        fullyFunctioning: district.fullyFunctioning,
        partiallyFunctioning: district.partiallyFunctioning,
        notFunctioning: district.notFunctioning,
        conditionNotStated: district.conditionNotStated,
        disputedPanchayats: district.disputed,
        // Null rather than 0 when the source disagreed with itself or said nothing.
        mandalOperators: operator && !operator.disputed && Number.isFinite(operator.operators) ? operator.operators : null,
        reportedMandalOperators: operator && !operator.disputed && Number.isFinite(operator.reported) ? operator.reported : null,
      };
    })
    .sort((a, b) => b.panchayats - a.panchayats || a.district.localeCompare(b.district));

  const manifest = {
    version: 1,
    generatedFrom: {
      [RATHAMS]: {
        responseId: source.responseMetadata.responseId,
        generatedAt: source.responseMetadata.generatedAt,
        rows: source.records.length,
      },
      [OPERATORS]: {
        responseId: operatorsSource.responseMetadata.responseId,
        generatedAt: operatorsSource.responseMetadata.generatedAt,
        rows: operatorsSource.records.length,
      },
    },
    grain: 'District',
    sourceGrain: 'Gram Panchayat',
    panchayatsCounted: rows.reduce((total, row) => total + row.panchayats, 0),
    panchayatsHeldOut: rows.reduce((total, row) => total + row.disputedPanchayats, 0),
    rowsWithoutIdentity: heldOut,
    boundary: 'Counts describe gram panchayats as the source reported them. A blank SWPC or condition value is "not stated", never "No" and never zero. Panchayats whose repeated rows disagree are held out, not resolved.',
    districts: rows,
  };

  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, 'rural-swpc-districts.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Rolled ${source.records.length.toLocaleString('en-IN')} rows → ${rows.length} districts.`);
  console.log(`  ${manifest.panchayatsCounted.toLocaleString('en-IN')} gram panchayats counted · ${manifest.panchayatsHeldOut} held out · ${heldOut} rows without identity.`);
  console.log('  data/aggregates/rural-swpc-districts.json');
}

await main();
