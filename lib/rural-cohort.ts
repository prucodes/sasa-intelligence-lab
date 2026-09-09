import aggregate from '@/data/aggregates/rural-cohort.json';

/**
 * Infrastructure against activity — and a null result.
 *
 * The SWPC register and the August collection export join on a numeric gram panchayat
 * id with nothing inferred: all 12,874 registered panchayats appear in the collection
 * data, none disputed. Identity and denominator are established as firmly as anywhere in
 * this product.
 *
 * What the pairing then shows is nothing. Panchayats with a registered processing centre
 * collect on 85.5% of reported days; those without collect on 85.2%. Reported working
 * condition does not order sensibly either — "Not Functioning" segregates more per
 * panchayat-day than "Partially Functioning", which cannot be true if the centre were
 * driving the outcome.
 *
 * Two readings survive and this data cannot separate them: the register may be stale —
 * it carries no date column at all, so whether it describes August is unknown — or a
 * processing centre may simply not govern door-to-door collection, which are different
 * activities. Either way the honest output is the absence of a relationship, stated as
 * such. No per-panchayat points are shipped, because plotting 12,874 of them would draw
 * a shapeless cloud that implies a signal the comparison does not support.
 */

export interface RuralGroup {
  id?: string;
  label?: string;
  condition?: string | null;
  district?: string;
  panchayats: number;
  panchayatDays: number;
  collectionRate: number | null;
  segregatedPerPanchayatDay: number | null;
  anySegregation: number | null;
}

export interface RuralCohort {
  month: string;
  cohort: number;
  usableDays: string[];
  outageDays: string[];
  days: Array<{ date: string; rows: number; collectedRows: number; reportingRatio: number }>;
  identity: { key: string; registered: number; matched: number; registeredWithoutActivity: number; registerDisputed: number; activityOnlyPanchayats: number };
  groups: RuralGroup[];
  byCondition: RuralGroup[];
  registerCurrency: string;
  /** The spread between the best and worst group's collection rate, in points. */
  spreadPoints: number | null;
  /** True when no group differs from another by more than a trivial margin. */
  noRelationship: boolean;
  boundary: string;
}

/** Below this, a difference between groups is not worth calling a difference. */
const MATERIAL_DIFFERENCE = 0.05;

export function getRuralCohort(): RuralCohort {
  const groups = aggregate.groups as RuralGroup[];
  const rates = groups.filter((group) => group.collectionRate !== null && group.panchayats > 0).map((group) => group.collectionRate!);
  const spread = rates.length > 1 ? Math.max(...rates) - Math.min(...rates) : null;

  return {
    month: aggregate.month,
    cohort: aggregate.cohort,
    usableDays: aggregate.usableDays,
    outageDays: aggregate.outageDays,
    days: aggregate.days,
    identity: aggregate.identity,
    groups,
    byCondition: aggregate.byCondition as RuralGroup[],
    registerCurrency: aggregate.registerCurrency,
    spreadPoints: spread === null ? null : Math.round(spread * 1000) / 10,
    noRelationship: spread !== null && spread < MATERIAL_DIFFERENCE,
    boundary: aggregate.boundary,
  };
}
