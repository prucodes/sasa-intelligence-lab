import { describe, expect, it } from 'vitest';
import { getGroundwaterContext } from '@/lib/groundwater-context';

describe('groundwater context', () => {
  it('keeps partial retention, mixed grains and unchanged observations explicit', () => {
    const data = getGroundwaterContext();
    expect(data.returned).toBe(717);
    expect(data.expected).toBe(718);
    expect(data.complete).toBe(false);
    expect(data.missing).toBe(1);
    expect(data.districts).toBe(28);
    expect(data.subDistricts).toBe(689);
    expect(data.matched).toBe(717);
    expect(data.changed).toBe(0);
  });
  it('dates the measurements separately from the October capture dates', () => {
    const data = getGroundwaterContext();
    expect(data.captureDates).toEqual(['2026-10-04', '2026-10-05']);
    expect(data.readingFrom).toBe('2026-09-01');
    expect(data.readingTo).toBe('2026-09-09');
  });
});
