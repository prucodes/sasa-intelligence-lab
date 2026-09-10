/**
 * Reported collection has a weekly shape, and averaging across it hides the shape.
 *
 * Across May-August 2026 every one of the fifteen retained Sundays reports 1.8-3.0%
 * statewide against 82-94% on working days, and each month's second Saturday reports
 * about 11%. Those are the scheduled non-collection days of the Andhra Pradesh
 * calendar, not reporting failures, so a rate that averages them in sits about
 * twelve percentage points below the rate on days collection was scheduled.
 *
 * This module states that classification in one place, from the calendar rather than
 * from the measurements, so a screen can show either basis and say which it is showing.
 * A day is never dropped silently: callers surface the excluded days alongside the rate.
 */

export type DayClass = 'working' | 'sunday' | 'second-saturday';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Parsed as UTC: these are calendar dates, and a local parse shifts them a day west of Greenwich. */
function parts(date: string): { weekday: number; dayOfMonth: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const weekday = parsed.getUTCDay();
  return Number.isNaN(weekday) ? null : { weekday, dayOfMonth: parsed.getUTCDate() };
}

export function classifyDay(date: string): DayClass | null {
  const value = parts(date);
  if (!value) return null;
  if (value.weekday === 0) return 'sunday';
  // The second Saturday is a state government holiday: days 8-14 hold exactly one.
  if (value.weekday === 6 && value.dayOfMonth >= 8 && value.dayOfMonth <= 14) return 'second-saturday';
  return 'working';
}

export function isScheduledNonCollectionDay(date: string): boolean {
  const value = classifyDay(date);
  return value === 'sunday' || value === 'second-saturday';
}

export function weekdayName(date: string): string | null {
  const value = parts(date);
  return value ? WEEKDAY[value.weekday] : null;
}

/** `2026-05` + day 3 -> `2026-05-03`, so a day-of-month cohort can be classified. */
export function dateFromPeriodDay(period: string, day: number): string | null {
  if (!/^\d{4}-\d{2}$/.test(period) || !Number.isInteger(day) || day < 1 || day > 31) return null;
  return `${period}-${String(day).padStart(2, '0')}`;
}

export const NON_COLLECTION_LABEL: Record<Exclude<DayClass, 'working'>, string> = {
  sunday: 'Sunday',
  'second-saturday': 'Second Saturday',
};

export type DayCount = { day: number; collected: number; pairs: number };

/**
 * Recompute a rate over one class of day. Returns the excluded days too, because a
 * rate presented without the days it dropped is the problem this module exists to fix.
 */
export function rateOverWorkingDays(period: string, days: readonly DayCount[]): {
  rate: number | null;
  pairs: number;
  collected: number;
  excluded: { day: number; date: string; reason: string }[];
} {
  let pairs = 0;
  let collected = 0;
  const excluded: { day: number; date: string; reason: string }[] = [];
  for (const entry of days) {
    const date = dateFromPeriodDay(period, entry.day);
    const cls = date ? classifyDay(date) : null;
    if (date && cls && cls !== 'working') {
      excluded.push({ day: entry.day, date, reason: NON_COLLECTION_LABEL[cls] });
      continue;
    }
    pairs += entry.pairs;
    collected += entry.collected;
  }
  return { rate: pairs > 0 ? collected / pairs : null, pairs, collected, excluded };
}
