import { describe, expect, it } from 'vitest';
import { sourceNumber, sourcePeriod, sourceEntity, uniqueSourceRecords } from '../lib/record-contract.mjs';

describe('shared source record contract', () => {
  it('preserves zero while holding missing, invalid and negative measurements out', () => {
    expect(sourceNumber('0')).toBe(0);
    expect(sourceNumber('"1,250"')).toBe(1250);
    for (const value of [null, undefined, '', 'NULL', 'NA', '-1', 'unknown']) expect(sourceNumber(value)).toBeNull();
  });
  it('is invariant to exact repeats and holds every conflicting variant out', () => {
    const a = { id: 'one', count: 1 }, b = { id: 'one', count: 2 }, c = { id: 'two', count: 0 };
    for (const rows of [[a,b,a,c,c], [b,c,a,c,a]]) {
      const result = uniqueSourceRecords(rows, (row: typeof a) => row.id);
      expect(result.records).toEqual([c]);
      expect(result.quality).toEqual({ rawRows:5, uniqueRows:1, duplicateRows:1, conflictingKeys:1, conflictingRows:3, missingKeyRows:0 });
    }
  });
  it('understands revised period encodings without making up undated periods', () => {
    expect(sourcePeriod({ month:'202604',fin_year:'2026-2027' })).toBe('2026-04');
    expect(sourcePeriod({ month_no:'7',year:'2026' })).toBe('2026-07');
    expect(sourcePeriod({ month:'July',year:'2026' })).toBe('2026-07');
    expect(sourcePeriod({ COLLECTION_DATE:'2026-08-02' })).toBe('2026-08');
    expect(sourcePeriod({ fin_year:'2026-2027' })).toBeNull();
    expect(sourcePeriod({ month:'202613' })).toBeNull();
  });
  it('recognizes revised LGD and legacy ULB identity columns', () => {
    expect(sourceEntity({lgd_dist_code:'502',lgd_mandal_code:'1003'})).toBe('502|1003');
    expect(sourceEntity({dstrt_nm:'Anantapur',ulb_nm:'Guntakal'})).toBe('Anantapur|Guntakal');
    expect(sourceEntity({GRAM_PANCHAYAT_ID:'123'})).toBe('gp:123');
  });
});
