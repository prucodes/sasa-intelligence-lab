import { describe, expect, it } from 'vitest';
import { distributionOf, ordinal, peerContext, periodChange } from '@/lib/comparison';

describe('distribution', () => {
  it('excludes values that were never reported rather than counting them as zero', () => {
    const distribution = distributionOf([10, null, 20, undefined, 30]);
    expect(distribution?.count).toBe(3);
    expect(distribution?.median).toBe(20);
  });

  it('returns null when nothing was reported', () => {
    expect(distributionOf([null, undefined])).toBeNull();
  });

  it('interpolates quartiles rather than picking a nearby row', () => {
    const distribution = distributionOf([0, 10, 20, 30]);
    expect(distribution?.median).toBe(15);
    expect(distribution?.p25).toBe(7.5);
    expect(distribution?.p75).toBe(22.5);
  });
});

describe('peer context', () => {
  const distribution = distributionOf([0, 0.1, 0.25, 0.5, 0.9]);

  it('ranks the highest reported value first', () => {
    expect(peerContext(0.9, distribution)?.rank).toBe(1);
    expect(peerContext(0, distribution)?.rank).toBe(5);
  });

  it('gives tied values the same rank', () => {
    const tied = distributionOf([0.5, 0.5, 0.2]);
    expect(peerContext(0.5, tied)?.rank).toBe(1);
    expect(peerContext(0.2, tied)?.rank).toBe(3);
  });

  it('reports how many peers sit below the value', () => {
    expect(peerContext(0.25, distribution)?.below).toBe(2);
  });

  // Position is rank-based, not value-based, so one extreme outlier cannot squash the rest.
  it('spreads values evenly by rank rather than by magnitude', () => {
    expect(peerContext(0, distribution)?.position).toBe(0);
    expect(peerContext(0.9, distribution)?.position).toBe(1);
    // 0.25 is third of five, so it sits halfway even though it is far from the midpoint by value.
    expect(peerContext(0.25, distribution)?.position).toBe(0.5);
  });

  it('is not distorted by a single extreme outlier', () => {
    const skewed = distributionOf([0, 0.1, 0.2, 0.3, 20]);
    // By magnitude 0.3 would sit at 1.5% of the range; by rank it sits at three quarters.
    expect(peerContext(0.3, skewed)?.position).toBe(0.75);
  });

  it('returns null for a value that was not reported', () => {
    expect(peerContext(null, distribution)).toBeNull();
  });

  it('handles a distribution where every peer reported the same value', () => {
    const flat = distributionOf([0.4, 0.4, 0.4]);
    expect(peerContext(0.4, flat)?.position).toBe(0.5);
    expect(peerContext(0.4, flat)?.rank).toBe(1);
  });
});

describe('period change', () => {
  it('reports direction and size', () => {
    expect(periodChange(120, 100)).toMatchObject({ delta: 20, direction: 'up' });
    expect(periodChange(80, 100)).toMatchObject({ delta: -20, direction: 'down' });
    expect(periodChange(100, 100)?.direction).toBe('flat');
  });

  it('suppresses a relative change when the earlier value was zero', () => {
    expect(periodChange(50, 0)?.relative).toBeNull();
  });

  it('returns null when either period was not reported', () => {
    expect(periodChange(50, null)).toBeNull();
    expect(periodChange(null, 50)).toBeNull();
  });
});

describe('ordinals', () => {
  it('formats the awkward cases correctly', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(101)).toBe('101st');
  });
});
