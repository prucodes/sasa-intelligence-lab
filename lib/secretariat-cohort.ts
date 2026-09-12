import aggregate from '@/data/aggregates/secretariat-cohort.json';

/**
 * The first cohort whose identity, period and freshness gates all pass.
 *
 * Every earlier attempt at a cross-source reading in this product failed the same way:
 * two departments spell a ULB differently, matching them is an inference, and an
 * inference is not evidence. This cohort does not have that problem. Collection and
 * segregation both key on a numeric `sachivalayam_code`, both report all 4,023
 * codes on 2026-08-12, and they agree on the household denominator for every one.
 *
 * So three of the five scoring gates open. The other two do not, and this module is
 * careful about which: one reported day is not a basis for performance, and no scoring
 * policy has been approved. What it produces is positions with their gate status
 * attached, never a rank, never a label.
 */

export interface CohortPoint {
  code: string;
  district: string;
  ulb: string;
  households: number;
  collected: number;
  segregated: number;
  /** Share of households collected from. */
  collectionRatio: number;
  /** Share of collected households whose waste was segregated. Null when none was collected. */
  segregationOfCollected: number | null;
  /** The source reported no collection at all. Not the same as collecting zero percent. */
  silent: boolean;
}

export interface CohortGate {
  id: string;
  label: string;
  passes: boolean;
  evidence: string;
}

export interface SecretariatCohort {
  day: string;
  points: CohortPoint[];
  districts: string[];
  cohort: number;
  reporting: number;
  silent: number;
  identity: {
    key: string;
    collectionCodes: number;
    segregationCodes: number;
    unmatched: number;
    denominatorConflicts: number;
    disputed: number;
  };
  containmentBreaches: number;
  collectionCoverage: number | null;
  segregationOfCollected: number | null;
  totals: { households: number; collected: number; segregated: number };
  gates: CohortGate[];
  /** True only when every gate passes. It does not. */
  scoreable: boolean;
  boundary: string;
}

export function getSecretariatCohort(): SecretariatCohort {
  const districts = aggregate.districts as string[];
  const ulbs = aggregate.ulbs as string[];
  const rows = aggregate.points as Array<[string, number, number, number, number, number]>;

  const points: CohortPoint[] = rows.map(([code, district, ulb, households, collected, segregated]) => ({
    code,
    district: districts[district] ?? '',
    ulb: ulbs[ulb] ?? '',
    households,
    collected,
    segregated,
    collectionRatio: households > 0 ? collected / households : 0,
    // A rate needs a denominator. Nothing collected means no rate, not a zero rate.
    segregationOfCollected: collected > 0 ? segregated / collected : null,
    silent: collected === 0,
  }));

  const identity = aggregate.identity as {
    key: string; collectionCodes: number; segregationCodes: number; unmatched: number;
    denominatorConflicts: number; disputedWithinCollection: number; disputedWithinSegregation: number;
  };
  const disputed = identity.disputedWithinCollection + identity.disputedWithinSegregation;

  const gates: CohortGate[] = [
    {
      id: 'identity',
      label: 'Entity identity is established',
      passes: identity.unmatched === 0 && disputed === 0,
      evidence: `Both sources key on ${identity.key}. ${identity.collectionCodes} codes in collection, ${identity.segregationCodes} in segregation, ${identity.unmatched} present in only one, ${disputed} disputed. No name matching is involved.`,
    },
    {
      id: 'period',
      label: 'Periods are aligned',
      passes: true,
      evidence: `Both measures are read from the same reported day, ${aggregate.day}. No period is bridged and no figure is carried forward.`,
    },
    {
      id: 'denominator',
      label: 'The denominator is agreed',
      passes: identity.denominatorConflicts === 0,
      evidence: `${identity.denominatorConflicts} of ${aggregate.cohort} secretariats disagree on total households between the two sources.`,
    },
    {
      id: 'basis',
      label: 'A performance basis exists',
      passes: false,
      evidence: 'One reported day. A single day describes a day; it does not establish how an entity performs, and nothing here should be read as a trend.',
    },
    {
      id: 'policy',
      label: 'A scoring policy is approved',
      passes: false,
      evidence: 'No thresholds, weights or directionality have been agreed. Without an approved policy there is nothing to score against, whatever the data supports.',
    },
  ];

  return {
    day: aggregate.day,
    points,
    districts,
    cohort: aggregate.cohort,
    reporting: aggregate.reporting,
    silent: aggregate.silent,
    identity: { key: identity.key, collectionCodes: identity.collectionCodes, segregationCodes: identity.segregationCodes, unmatched: identity.unmatched, denominatorConflicts: identity.denominatorConflicts, disputed },
    containmentBreaches: aggregate.containmentBreaches,
    collectionCoverage: aggregate.collectionCoverage,
    segregationOfCollected: aggregate.segregationOfCollected,
    totals: aggregate.totals,
    gates,
    scoreable: gates.every((gate) => gate.passes),
    boundary: aggregate.boundary,
  };
}
