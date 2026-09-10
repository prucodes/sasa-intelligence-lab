import aggregate from '@/data/aggregates/month-series.json';
import { classifyDay, dateFromPeriodDay, NON_COLLECTION_LABEL, rateOverWorkingDays, type DayCount } from './collection-calendar';

/**
 * Reported collection is not flat across the week. Every retained Sunday reports near
 * zero, so a first-week rate blends six scheduled days with one that was never scheduled
 * and lands about twelve points below the working-day figure. Both readings are true of
 * different questions, so the screen offers both rather than picking one silently.
 */
export type RateBasis = 'all-days' | 'working-days';

const rateOn = (basis: RateBasis, period: string, days: readonly DayCount[], allDays: number | null) =>
  basis === 'working-days' ? rateOverWorkingDays(period, days).rate : allDays;

const trend = (points: { collectionRate: number | null }[]) =>
  points.every((p, i) => i === 0 || (p.collectionRate !== null && points[i - 1].collectionRate !== null && p.collectionRate > points[i - 1].collectionRate!)) ? 'increasing'
  : points.every((p, i) => i === 0 || (p.collectionRate !== null && points[i - 1].collectionRate !== null && p.collectionRate < points[i - 1].collectionRate!)) ? 'decreasing'
  : 'mixed';

export function getRuralMovement(basis: RateBasis = 'all-days') {
  const series = aggregate.series.map((entry) => ({
    ...entry,
    comparable: {
      ...entry.comparable,
      collectionRate: rateOn(basis, entry.period, entry.comparableByDay, entry.comparable.collectionRate),
      pairs: basis === 'working-days'
        ? rateOverWorkingDays(entry.period, entry.comparableByDay).pairs
        : entry.comparable.pairs,
    },
  }));

  const districts = aggregate.byDistrict.map((district) => {
    const points = district.points.map((point) => ({
      period: point.period,
      collectionRate: rateOn(basis, point.period, point.byDay, point.collectionRate),
    }));
    const open = points[0].collectionRate;
    const close = points[points.length - 1].collectionRate;
    return {
      ...district,
      points,
      pairs: basis === 'working-days'
        ? rateOverWorkingDays(district.points[0].period, district.points[0].byDay).pairs
        : district.pairs,
      changePercentagePoints: open === null || close === null ? null : (close - open) * 100,
      direction: trend(points),
    };
  }).sort((a, b) => Math.abs(b.changePercentagePoints ?? 0) - Math.abs(a.changePercentagePoints ?? 0));

  // Named, not hidden: which day each period drops on the working-day basis and why.
  const excludedDays = aggregate.series.map((entry) => ({
    period: entry.period,
    days: entry.comparableByDay.flatMap((day) => {
      const date = dateFromPeriodDay(entry.period, day.day);
      const cls = date ? classifyDay(date) : null;
      return date && cls && cls !== 'working'
        ? [{ date, reason: NON_COLLECTION_LABEL[cls], collectionRate: day.collectionRate }]
        : [];
    }),
  }));

  const cohortPairs = series[0]?.comparable.pairs ?? aggregate.cohort.pairs;

  return {
    ...aggregate,
    basis,
    series,
    districts,
    excludedDays,
    cohort: { ...aggregate.cohort, pairs: cohortPairs },
    declining: districts.filter((d) => d.direction === 'decreasing'),
    rising: districts.filter((d) => d.direction === 'increasing'),
  };
}
