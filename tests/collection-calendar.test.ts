import { describe, expect, it } from 'vitest';
import { classifyDay, dateFromPeriodDay, isScheduledNonCollectionDay, rateOverWorkingDays, weekdayName } from '@/lib/collection-calendar';
import { getRuralMovement } from '@/lib/rural-movement';
import aggregate from '@/data/aggregates/month-series.json';

describe('scheduled non-collection days', () => {
  it('classifies Sundays and second Saturdays from the calendar', () => {
    expect(classifyDay('2026-05-03')).toBe('sunday');
    expect(classifyDay('2026-08-02')).toBe('sunday');
    // 9 May, 13 June and 11 July 2026 are second Saturdays; 4 July and 18 July are not.
    expect(classifyDay('2026-05-09')).toBe('second-saturday');
    expect(classifyDay('2026-06-13')).toBe('second-saturday');
    expect(classifyDay('2026-07-11')).toBe('second-saturday');
    expect(classifyDay('2026-07-04')).toBe('working');
    expect(classifyDay('2026-07-18')).toBe('working');
    expect(classifyDay('2026-05-28')).toBe('working');
    expect(classifyDay('not-a-date')).toBeNull();
  });

  it('reads dates as calendar dates rather than local instants', () => {
    expect(weekdayName('2026-05-03')).toBe('Sunday');
    expect(weekdayName('2026-05-04')).toBe('Monday');
    expect(isScheduledNonCollectionDay('2026-05-03')).toBe(true);
    expect(isScheduledNonCollectionDay('2026-05-04')).toBe(false);
    expect(dateFromPeriodDay('2026-05', 3)).toBe('2026-05-03');
    expect(dateFromPeriodDay('2026-05', 0)).toBeNull();
    expect(dateFromPeriodDay('bad', 3)).toBeNull();
  });

  it('drops only the non-working days and reports which it dropped', () => {
    // Day 3 of May 2026 is a Sunday; days 1, 2 and 4 are not.
    const result = rateOverWorkingDays('2026-05', [
      { day: 1, pairs: 100, collected: 90 },
      { day: 2, pairs: 100, collected: 80 },
      { day: 3, pairs: 100, collected: 2 },
      { day: 4, pairs: 100, collected: 90 },
    ]);
    expect(result.pairs).toBe(300);
    expect(result.collected).toBe(260);
    expect(result.rate).toBeCloseTo(260 / 300, 10);
    expect(result.excluded).toEqual([{ day: 3, date: '2026-05-03', reason: 'Sunday' }]);
  });

  it('returns no rate rather than a zero when every day is excluded', () => {
    expect(rateOverWorkingDays('2026-05', [{ day: 3, pairs: 10, collected: 1 }]).rate).toBeNull();
  });
});

describe('rural movement on both day bases', () => {
  it('reproduces the published rate when every day is counted', () => {
    const all = getRuralMovement('all-days');
    all.series.forEach((entry, index) => {
      expect(entry.comparable.collectionRate).toBe(aggregate.series[index].comparable.collectionRate);
    });
    expect(all.cohort.pairs).toBe(aggregate.cohort.pairs);
  });

  it('lifts the level without inventing a different trend', () => {
    const all = getRuralMovement('all-days');
    const working = getRuralMovement('working-days');
    const change = (view: ReturnType<typeof getRuralMovement>) =>
      (view.series[view.series.length - 1].comparable.collectionRate! - view.series[0].comparable.collectionRate!) * 100;

    // Sundays drag every month by about the same amount, so the level moves and the
    // direction does not. If these ever diverge, the comparison was resting on the drag.
    working.series.forEach((entry, index) => {
      expect(entry.comparable.collectionRate!).toBeGreaterThan(all.series[index].comparable.collectionRate!);
    });
    expect(Math.sign(change(working))).toBe(Math.sign(change(all)));
    expect(Math.abs(change(working) - change(all))).toBeLessThan(1);
    expect(working.cohort.pairs).toBeLessThan(all.cohort.pairs);
  });

  it('excludes exactly one scheduled day from each first-week window', () => {
    const working = getRuralMovement('working-days');
    expect(working.excludedDays).toHaveLength(aggregate.periods.length);
    for (const period of working.excludedDays) {
      expect(period.days).toHaveLength(1);
      expect(period.days[0].reason).toBe('Sunday');
      // The day it drops is one that genuinely reports near zero, not an arbitrary cut.
      expect(period.days[0].collectionRate!).toBeLessThan(0.05);
    }
  });
});
