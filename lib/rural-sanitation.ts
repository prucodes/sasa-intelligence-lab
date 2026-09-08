import aggregate from '@/data/aggregates/rural-swpc-districts.json';

/**
 * Rural solid-waste processing, rolled up from the PR gram-panchayat export.
 *
 * This is the first rural evidence in the product. Everything else describes ULBs —
 * urban local bodies — so nothing here joins to anything there, and the two must not be
 * added together or compared. A district appears in both, but "gram panchayats with a
 * processing centre" and "ULBs with a processing facility" are different populations
 * counted under the same district name.
 *
 * The source is 26,702 rows across 12,874 gram panchayats, retained in
 * data/large-snapshots and too large to bundle. `scripts/aggregate-rural.mjs` produces
 * the district rollup this module reads, applying the same evidence rules used
 * everywhere else: identical repeats collapse, disagreeing repeats are held out, and a
 * blank is "not stated" rather than "No".
 */

export interface RuralDistrict {
  districtId: string;
  district: string;
  panchayats: number;
  blocks: number;
  withSwpc: number;
  withoutSwpc: number;
  swpcNotStated: number;
  fullyFunctioning: number;
  partiallyFunctioning: number;
  notFunctioning: number;
  conditionNotStated: number;
  disputedPanchayats: number;
  mandalOperators: number | null;
  reportedMandalOperators: number | null;
}

export interface RuralSanitation {
  districts: RuralDistrict[];
  panchayats: number;
  blocks: number;
  withSwpc: number;
  withoutSwpc: number;
  swpcNotStated: number;
  /** Coverage across panchayats that actually stated a value. Null if none did. */
  coverageRatio: number | null;
  fullyFunctioning: number;
  partiallyFunctioning: number;
  notFunctioning: number;
  conditionNotStated: number;
  /** Panchayats reported as having a centre but with no condition stated. */
  presentWithoutCondition: number;
  heldOut: number;
  sourceRows: number;
  boundary: string;
}

export function getRuralSanitation(): RuralSanitation {
  const districts = aggregate.districts as RuralDistrict[];
  const sum = (pick: (district: RuralDistrict) => number) => districts.reduce((total, district) => total + pick(district), 0);

  const withSwpc = sum((district) => district.withSwpc);
  const withoutSwpc = sum((district) => district.withoutSwpc);
  const swpcNotStated = sum((district) => district.swpcNotStated);
  const stated = withSwpc + withoutSwpc;
  const conditionStated = sum((district) => district.fullyFunctioning + district.partiallyFunctioning + district.notFunctioning);

  return {
    districts,
    panchayats: aggregate.panchayatsCounted,
    blocks: sum((district) => district.blocks),
    withSwpc,
    withoutSwpc,
    swpcNotStated,
    // The denominator is panchayats that stated a value, never the full population.
    coverageRatio: stated > 0 ? withSwpc / stated : null,
    fullyFunctioning: sum((district) => district.fullyFunctioning),
    partiallyFunctioning: sum((district) => district.partiallyFunctioning),
    notFunctioning: sum((district) => district.notFunctioning),
    conditionNotStated: sum((district) => district.conditionNotStated),
    // A centre reported present with no condition is a gap in the evidence, not a
    // broken centre. It is counted separately so it cannot be read as either.
    presentWithoutCondition: Math.max(withSwpc - conditionStated, 0),
    heldOut: aggregate.panchayatsHeldOut,
    sourceRows: Object.values(aggregate.generatedFrom).reduce((total, entry) => total + (entry as { rows: number }).rows, 0),
    boundary: aggregate.boundary,
  };
}
