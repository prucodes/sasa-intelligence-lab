/** Parse reported non-negative measurements without converting absence to zero. */
export function measurement(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim().replace(/^"+|"+$/g, '').trim();
  if (!text || !/^\+?(?:\d[\d,]*(?:\.\d*)?|\.\d+)%?$/.test(text)) return null;
  const parsed = Number(text.replace(/,/g, '').replace(/%$/, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function reportedSum(values: Array<number | null>): number | null {
  return values.length && values.every((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + value!, 0) : null;
}

/** Compare complete year/month pairs; an undated row cannot win latest-period selection. */
export function latestMonthlyRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  const period = (row: T) => {
    const year = measurement(row.year ?? row.YEAR);
    const month = measurement(row.month ?? row.month_id ?? row.mnth_no ?? row.month_number);
    return year !== null && year >= 1900 && Number.isInteger(year) && month !== null && Number.isInteger(month) && month >= 1 && month <= 12 ? year * 100 + month : null;
  };
  const periods = rows.map(period).filter((value): value is number => value !== null);
  if (!periods.length) return [];
  const latest = Math.max(...periods);
  return rows.filter((row) => period(row) === latest);
}
