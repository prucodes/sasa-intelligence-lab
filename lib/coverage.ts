/**
 * Coverage: the denominator that travels with every rate.
 *
 * A percentage on its own is not a finding. "84%" is only meaningful once a
 * reader knows how many entities were behind it and how many were expected to
 * report. Across the SASA sources a rate built from 40 of 123 ULBs looks exactly
 * like one built from 119, and the difference is usually larger than the effect
 * anyone is trying to read.
 *
 * The house rule this module exists to enforce: a value rendered as a bare
 * percentage must carry a Coverage. `assertRateHasCoverage` is the check, and
 * `tests/coverage.test.ts` runs it over every metric the product ships, so a new
 * uncovered rate fails the build rather than reaching a reviewer.
 */

export interface Coverage {
  /** Entities that actually returned a usable value. */
  reported: number;
  /** Entities the source is meant to cover. Never inferred from what came back. */
  expected: number;
  /** What is being counted, for the label: 'ULBs', 'districts', 'datasets'. */
  unit: string;
  /**
   * Optional caveat shown under the count, for when the arithmetic is right but
   * the reading would still be wrong (for example a figure that is not a state total).
   */
  basis?: string;
}

/** How much of the expected population reported. Null when nothing is expected. */
export function coverageRatio(coverage: Coverage): number | null {
  if (!Number.isFinite(coverage.expected) || coverage.expected <= 0) return null;
  return coverage.reported / coverage.expected;
}

/** Entities that were expected but did not report. Never negative. */
export function notReturned(coverage: Coverage): number {
  return Math.max(0, coverage.expected - coverage.reported);
}

export type CoverageTier = 'full' | 'partial' | 'thin';

/**
 * Bands for how much weight a figure can carry. These are presentation
 * thresholds, not statistical ones: 'thin' means a reader should not quote the
 * number without the denominator beside it.
 *
 * The thin boundary sits at three quarters deliberately. An earlier draft put it
 * at 60%, which meant nothing in the product ever qualified — the collection
 * ratio rests on 83 of 123 ULBs (67%) and still rendered at full strength. A
 * figure missing a third of the state is thin by any reasonable reading, so the
 * band was moved to where it does some work.
 */
export function coverageTier(coverage: Coverage): CoverageTier {
  const ratio = coverageRatio(coverage);
  if (ratio === null) return 'thin';
  if (ratio >= 0.9) return 'full';
  if (ratio >= 0.75) return 'partial';
  return 'thin';
}

/** The compact form that sits beside the number: "103 / 123". */
export function formatCoverage(coverage: Coverage): string {
  return `${coverage.reported.toLocaleString('en-IN')} / ${coverage.expected.toLocaleString('en-IN')}`;
}

/**
 * The sentence under the number. Says what reported and what did not, because
 * "20 did not return" is the part a reader acts on.
 */
export function coverageNote(coverage: Coverage): string {
  const missing = notReturned(coverage);
  const head = `${coverage.reported.toLocaleString('en-IN')} ${coverage.unit} reported`;
  return missing > 0 ? `${head} · ${missing.toLocaleString('en-IN')} did not return` : `${head} · all returned`;
}

/**
 * True when a rendered value is a bare rate, so the coverage rule applies.
 * Deliberately narrow: it matches a number with a percent sign and nothing else
 * of substance, so counts ("193 rows") and placeholders ("Not returned") pass
 * through untouched.
 */
export function isBareRate(value: string): boolean {
  return /^\s*-?\d+(\.\d+)?\s*%\s*$/.test(value);
}

/**
 * The rule itself. Returns a reason string when a value breaks it, or null when
 * it is fine. Used by the test suite over every shipped metric.
 */
export function rateCoverageViolation(value: string, coverage?: Coverage): string | null {
  if (!isBareRate(value)) return null;
  if (!coverage) return `"${value}" is rendered as a rate with no coverage. Attach a denominator or render it as a count.`;
  if (coverage.expected <= 0) return `"${value}" carries a coverage with a non-positive expected count.`;
  if (coverage.reported > coverage.expected) {
    return `"${value}" reports ${coverage.reported} of an expected ${coverage.expected}. More returned than were expected, so the denominator is wrong.`;
  }
  return null;
}
