import { describe, expect, it } from 'vitest';
import { lgdMandalCode, urbanBodyCode, urbanBodyCodes, urbanBodyIdentity } from '@/lib/urban-body-code';
import { governedSnapshotByKey, lgdIdentity } from '@/lib/snapshots';
import { getRankingDefinition } from '@/lib/subject-rankings';
import { serviceSnapshot } from '@/lib/ulb-service';

/** Every retained table that carries the two-system column. */
const codedKeys = [
  'ihhl_new_identification_new1_api',
  'swacch_survekshan_info_new1_api',
  'sasa_50_percent_greencover_api',
  'sewage_treated_qty_new1_api',
  'fstps_stps_cotreatment_new1_api',
  'msw_cbg_units_new1_api',
  'cd_waste_process_plants_revival_new1_api',
];

const codedRecords = codedKeys.flatMap((key) => governedSnapshotByKey.get(key)?.records ?? []);

describe('urban body code', () => {
  it('takes the register from the daily service sources, not from a numeric guess', () => {
    expect(urbanBodyCodes.size).toBe(serviceSnapshot.ulbs.length);
    expect(urbanBodyCodes.size).toBe(123);
  });

  it('separates the two code systems and never reports both for one row', () => {
    const record = { lgd_mandal_code: '1147' };
    expect(urbanBodyCode(record)).toBe('1147');
    expect(lgdMandalCode(record)).toBeNull();
    expect(urbanBodyIdentity(record)).toBe('urban:1147');

    // 5112 is ADDANKI's LGD mandal code. The same place, the other system.
    const mandal = { lgd_mandal_code: '5112' };
    expect(urbanBodyCode(mandal)).toBeNull();
    expect(lgdMandalCode(mandal)).toBe('5112');
    expect(urbanBodyIdentity(mandal)).toBeNull();
  });

  it('infers nothing for a row that declares no code', () => {
    for (const record of [{}, { lgd_mandal_code: '' }, { lgd_mandal_code: 'null' }, { ulb_nm: 'ADDANKI' }]) {
      expect(urbanBodyCode(record)).toBeNull();
      expect(lgdMandalCode(record)).toBeNull();
      expect(urbanBodyIdentity(record)).toBeNull();
    }
  });

  it('holds the evidence the contract rests on: the two bands never overlap', () => {
    // Registry membership and the numeric band must agree on real data. If the platform
    // ever issues an urban body code above the mandal band, this fails rather than
    // quietly reclassifying rows.
    expect([...urbanBodyCodes].every((code) => Number(code) < 2000)).toBe(true);
    const mandalCodes = codedRecords.map((record) => lgdMandalCode(record)).filter((code): code is string => Boolean(code));
    expect(mandalCodes.length).toBeGreaterThan(0);
    expect(mandalCodes.every((code) => Number(code) >= 4000)).toBe(true);
  });

  it('finds no urban body code in the retained tables that the register does not know', () => {
    // Every value below the mandal band is in the CDMA register. A single orphan would mean
    // the band is not the register and the whole identity claim would have to be withdrawn.
    const orphans = codedRecords
      .map((record) => record.lgd_mandal_code?.trim())
      .filter((code): code is string => Boolean(code) && Number(code) < 2000)
      .filter((code) => !urbanBodyCodes.has(code));
    expect(orphans).toEqual([]);
  });

  it('stops reporting a mandal code as a ULB code', () => {
    const mandalOnly = codedRecords.filter((record) => lgdMandalCode(record));
    expect(mandalOnly.length).toBeGreaterThan(0);
    expect(mandalOnly.every((record) => lgdIdentity(record).ulbCode === null)).toBe(true);
    expect(mandalOnly.every((record) => lgdIdentity(record).mandalCode !== null)).toBe(true);
  });
});

describe('cross-programme identity', () => {
  it('certifies the toilet programme against the service register by code', () => {
    const toilets = getRankingDefinition('toilets');
    const identified = toilets.inputs.filter((row) => row.identity);
    // The source's own code, so this is a link the data asserts rather than one we matched.
    expect(identified.length).toBeGreaterThan(90);
    expect(identified.length).toBeLessThan(toilets.inputs.length);

    const reach = getRankingDefinition('reach');
    const serviceIdentities = new Set(reach.inputs.map((row) => row.identity));
    expect(identified.every((row) => serviceIdentities.has(row.identity))).toBe(true);
  });

  it('leaves a programme whose source carries no ULB code as a name candidate', () => {
    // Legacy waste returns `ulb_name` and nothing else, and vehicles are district grain.
    // Neither gains an identity, and neither is given one from its name.
    for (const id of ['legacy', 'vehicles'] as const) {
      expect(getRankingDefinition(id).inputs.every((row) => row.identity === null)).toBe(true);
    }
  });
});
