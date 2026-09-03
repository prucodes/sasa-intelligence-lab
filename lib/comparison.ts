/**
 * Peer context for a single reported value.
 *
 * Every figure in the product has been absolute: "7% delivery ratio" tells a reviewer
 * nothing without knowing what the other 82 ULBs reported. These helpers place one value
 * inside the distribution of its peers, using only the entities that actually reported a
 * comparable value in the same period from the same source.
 *
 * This is not a ranking of performance. Two ULBs sit in the same distribution only because
 * the same source returned a comparable field for both, and a higher position can equally
 * mean better reporting rather than better delivery. Every label the UI renders says so.
 */

export interface Distribution {
  /** Reported values, ascending. Nulls are excluded rather than treated as zero. */
  values: number[];
  count: number;
  min: number;
  max: number;
  median: number;
  p25: number;
  p75: number;
}

export interface PeerContext {
  value: number;
  /** 1 is the highest reported value. */
  rank: number;
  of: number;
  median: number;
  /**
   * Position among reporting peers, 0 to 1, by rank rather than by value. A single ULB
   * reporting 200% would otherwise squash every real value into the left of the strip,
   * so the scale is robust to outliers by design.
   */
  position: number;
  /** How many peers reported a lower value. */
  below: number;
  aboveMedian: boolean;
}

function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/** Builds a distribution from reported values only. `null` means not reported, never zero. */
export function distributionOf(values: Array<number | null | undefined>): Distribution | null {
  const reported = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (reported.length === 0) return null;
  const sorted = [...reported].sort((left, right) => left - right);
  return {
    values: sorted,
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
  };
}

/** Places one value inside a distribution. Returns null when the value was not reported. */
export function peerContext(value: number | null | undefined, distribution: Distribution | null): PeerContext | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !distribution) return null;
  const { values, count, median, min, max } = distribution;
  const below = values.filter((entry) => entry < value).length;
  // Ties share the best rank, so two ULBs both reporting the highest value are both 1st.
  const higher = values.filter((entry) => entry > value).length;
  return {
    value,
    rank: higher + 1,
    of: count,
    median,
    // Everyone tied, or a single reporter: sit in the middle rather than at the far left.
    position: count <= 1 || min === max ? 0.5 : below / (count - 1),
    below,
    aboveMedian: value > median,
  };
}

/** Change between two reported values. Null when either side was not reported. */
export function periodChange(current: number | null | undefined, previous: number | null | undefined) {
  if (typeof current !== 'number' || typeof previous !== 'number') return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const delta = current - previous;
  return {
    delta,
    /** Relative change is suppressed when the earlier value was zero. */
    relative: previous === 0 ? null : delta / Math.abs(previous),
    direction: delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'flat' as const,
  };
}

const ordinals = ['th', 'st', 'nd', 'rd'];

export function ordinal(value: number): string {
  const remainder = value % 100;
  return `${value}${ordinals[(remainder - 20) % 10] ?? ordinals[remainder] ?? ordinals[0]}`;
}
