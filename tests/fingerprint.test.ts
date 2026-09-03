import { describe, expect, it } from 'vitest';
import { compareManifests, fingerprintEnvelope, periodOf } from '../scripts/fingerprint.mjs';

const envelope = (records: Array<Record<string, string>>) => ({
  responseMetadata: { tableKey: 'test_api', generatedAt: '2026-08-28T00:00:00Z' },
  records,
});

const june = { district_name: 'Anakapalli', ulb_name: 'Narsipatnam', year: '2026', month_number: '6', month_name: 'JUNE', completed: '0' };
const july = { district_name: 'Anakapalli', ulb_name: 'Yelamanchali', year: '2026', month_number: '7', month_name: 'JULY', completed: '0' };

const manifest = (records: Array<Record<string, string>>) => ({
  version: 1,
  datasets: { test: fingerprintEnvelope(envelope(records)) },
});

describe('period resolution', () => {
  it('reads the four month field names the snapshots actually use', () => {
    expect(periodOf({ year: '2026', month_number: '7' })).toBe('2026-07');
    expect(periodOf({ year: '2026', month_id: '6' })).toBe('2026-06');
    expect(periodOf({ year: '2026', mnth_no: '5' })).toBe('2026-05');
    expect(periodOf({ year: '2026', month: 'July' })).toBe('2026-07');
  });

  it('falls back to the month name when the number is absent', () => {
    expect(periodOf({ year: '2024', month_name: 'MARCH' })).toBe('2024-03');
  });

  it('keeps rows without any period in an explicit bucket', () => {
    expect(periodOf({ district_name: 'Anakapalli' })).toBe('unperiodized');
  });
});

describe('drift detection', () => {
  it('reports nothing when the snapshot is unchanged', () => {
    expect(compareManifests(manifest([june, july]), manifest([june, july]))).toEqual([]);
  });

  it('ignores row reordering, which is not a source revision', () => {
    expect(compareManifests(manifest([june, july]), manifest([july, june]))).toEqual([]);
  });

  it('catches a row re-dated between periods even though the total is unchanged', () => {
    const before = manifest([june, june, july]);
    const after = manifest([june, { ...june, month_number: '7', month_name: 'JULY' }, july]);
    const drift = compareManifests(before, after);
    expect(drift.join('\n')).toContain('rows were re-dated');
    expect(drift.some((line) => line.includes('period 2026-06 rows 2 -> 1'))).toBe(true);
    expect(drift.some((line) => line.includes('period 2026-07 rows 1 -> 2'))).toBe(true);
  });

  it('catches a changed value at an identical row count and entity set', () => {
    const drift = compareManifests(manifest([june]), manifest([{ ...june, completed: '9' }]));
    expect(drift.join('\n')).toContain('values changed at the same row count and entity set');
  });

  it('catches a swapped entity at an identical row count', () => {
    const drift = compareManifests(manifest([june]), manifest([{ ...june, ulb_name: 'Gooty' }]));
    expect(drift.join('\n')).toContain('covers different entities');
  });

  it('reports an added and a removed reported period', () => {
    expect(compareManifests(manifest([june]), manifest([june, july])).join('\n')).toContain('new reported period 2026-07');
    expect(compareManifests(manifest([june, july]), manifest([june])).join('\n')).toContain('reported period 2026-07 disappeared');
  });

  it('reports a snapshot that has gone missing entirely', () => {
    const drift = compareManifests(manifest([june]), { version: 1, datasets: {} });
    expect(drift.join('\n')).toContain('snapshot file is missing');
  });
});
