import aggregate from '@/data/aggregates/rural-cohort.json';

/** Descriptive comparisons only: the register has no effective date. */
export function getRuralCohort() {
  const withCentre = aggregate.groups.find(group => group.id === 'with-centre');
  const withoutCentre = aggregate.groups.find(group => group.id === 'without-centre');
  const a = withCentre?.collectionRate;
  const b = withoutCentre?.collectionRate;
  return {
    ...aggregate,
    spreadPoints: a == null || b == null ? null : Math.abs(a - b) * 100,
    observedGridGap: aggregate.recordQuality.gridCeiling - aggregate.recordQuality.uniqueRows,
    heldOutRows: aggregate.recordQuality.conflictingRows + aggregate.recordQuality.missingKeyRows,
  };
}
