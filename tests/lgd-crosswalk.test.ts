import { describe, expect, it } from 'vitest';
import { getIdentityReach, getLgdCrosswalk, sameNameDifferentSpelling, lgdEnrichedKeys } from '@/lib/lgd-crosswalk';
import { getDeliveryPlans, getDistinctDeliveryPlans } from '@/lib/delivery-plan';
import { governedSnapshotByKey, lgdIdentity, sourceCandidateKey } from '@/lib/snapshots';
import { getDuplicateSourceGroups, getDuplicateSourceSummary } from '@/lib/duplicate-sources';
import { getSecretariatCohort } from '@/lib/secretariat-cohort';
import { getRuralCohort } from '@/lib/rural-cohort';

describe('LGD crosswalk', () => {
  it('reads the mapping the source supplies, across every enriched dataset', () => {
    const crosswalk = getLgdCrosswalk();
    expect(crosswalk.datasets).toBe(lgdEnrichedKeys.length);
    expect(crosswalk.candidates).toBeGreaterThan(100);
    expect(crosswalk.resolved + crosswalk.unresolved).toBe(crosswalk.candidates);
    // Coverage is partial and must be reported as partial, never rounded up to complete.
    expect(crosswalk.rowsWithUlbCode).toBeLessThan(crosswalk.rows);
  });

  it('separates a respelled name from an unrelated one', () => {
    expect(sameNameDifferentSpelling('Anantapur', 'ANANTHAPURAMU')).toBe(true);
    expect(sameNameDifferentSpelling('Baptla', 'BAPATLA')).toBe(true);
    expect(sameNameDifferentSpelling('SPSR Nellore', 'SRI POTTI SRIRAMULU NELLORE')).toBe(true);
    expect(sameNameDifferentSpelling('NTR District', 'NTR')).toBe(true);
    expect(sameNameDifferentSpelling('SPSR Nellore', 'KURNOOL')).toBe(false);
    expect(sameNameDifferentSpelling('Kurnool', 'KRISHNA')).toBe(false);
    expect(sameNameDifferentSpelling('Chittoor', 'ANNAMAYYA')).toBe(false);
  });

  it('catches a source that maps one district label to two different LGD districts', () => {
    const crosswalk = getLgdCrosswalk();
    expect(crosswalk.selfContradictions.length).toBeGreaterThan(0);
    const nellore = crosswalk.selfContradictions.find((entry) => entry.sourceDistrict.includes('SPSR Nellore'));
    expect(nellore?.tableKey).toBe('swacch_survekshan_info_new1_api');
    expect(nellore?.lgdDistricts).toContain('KURNOOL');
    expect(nellore?.lgdDistricts).toContain('SRI POTTI SRIRAMULU NELLORE');
    // Every contradiction names the dataset it came from, so it can be reported upstream.
    expect(crosswalk.selfContradictions.every((entry) => lgdEnrichedKeys.includes(entry.tableKey as never))).toBe(true);
  });

  it('refuses the mapping as canonical identity while it contradicts itself', () => {
    const reach = getIdentityReach();
    expect(reach.blocker).toBeTruthy();
    expect(reach.blocker).toContain('cannot be adopted as canonical identity');
    // A disputed code identifies nothing, so it is never counted as covered.
    expect(reach.covered).toBeLessThan(reach.totalCandidates);
    expect(reach.covered + reach.uncovered).toBe(reach.totalCandidates);
    expect(reach.coverageRatio).toBeLessThan(1);
    expect(reach.enrichedDatasets).toBeLessThan(reach.totalDatasets);
  });

  it('never invents an LGD code for a row that lacks one', () => {
    const snapshot = governedSnapshotByKey.get('ihhl_new_identification_new1_api')!;
    const blank = snapshot.records.filter((record) => !String(record.lgd_mandal_code ?? '').trim());
    expect(blank.length).toBeGreaterThan(0);
    expect(blank.every((record) => lgdIdentity(record).ulbCode === null)).toBe(true);
  });

  it('keeps one source-candidate key meaning across both retained vintages', () => {
    // The LGD exports carry dstrt_nm AND district_name; the older ones carry only one.
    // The key must read the departmental label in both, or a ULB stops matching itself.
    const old = governedSnapshotByKey.get('sasa_sac_identification_of_new_ihhls_api')!;
    const lgd = governedSnapshotByKey.get('ihhl_new_identification_new1_api')!;
    const oldKeys = new Set(old.records.map(sourceCandidateKey).filter(Boolean));
    const lgdKeys = new Set(lgd.records.map(sourceCandidateKey).filter(Boolean));
    expect(oldKeys.size).toBe(123);
    expect(lgdKeys.size).toBe(123);
    expect([...lgdKeys].filter((key) => oldKeys.has(key as string))).toHaveLength(123);
  });
});

describe('delivery plans', () => {
  it('builds a twelve-month plan and only counts elapsed months', () => {
    const compost = getDeliveryPlans().find((plan) => plan.id === 'compost-pits')!;
    expect(compost.months).toHaveLength(12);
    expect(compost.elapsed).toHaveLength(5);
    expect(compost.remaining).toHaveLength(7);
    // Unreported months carry a target and no achievement, and are never a shortfall.
    expect(compost.remaining.every((month) => month.unreported && month.achievement === null)).toBe(true);
    expect(compost.plannedToDate).toBe(compost.plannedTotal);
    expect(compost.paceToDate).toBeCloseTo(compost.deliveredToDate / compost.plannedToDate);
  });

  it('detects a mislabelled endpoint serving another dataset', () => {
    const plans = getDeliveryPlans();
    const soak = plans.find((plan) => plan.id === 'soak-pits')!;
    // soak_pits_api returns Compost Pits rows and says so in its own work_name column.
    expect(soak.duplicateOf).toBe('compost_pits_api');
    expect(soak.reportedWorkName).toBe('Compost Pits');
    expect(getDistinctDeliveryPlans().map((plan) => plan.id))
      .toEqual(['compost-pits', 'magic-drains', 'sanitary-complexes', 'itc-wow-schools', 'gobardhan']);
  });

  it('takes the unit from the source rather than the dataset name', () => {
    const plans = getDeliveryPlans();
    expect(plans.find((plan) => plan.id === 'compost-pits')!.unit).toBe('Nos');
    // Magic drains are measured in kilometres, so a count label would be wrong.
    expect(plans.find((plan) => plan.id === 'magic-drains')!.unit).toBe('KMs');
  });

  it('scopes district totals to one selected reporting month', () => {
    const compost = getDeliveryPlans().find((plan) => plan.id === 'compost-pits')!;
    expect(compost.boundary).toContain('not added across months');
    expect(compost.selectedMonth?.monthId).toBe('202608');
    expect(compost.deliveredToDate).toBe(compost.selectedMonth?.achievement);
    // District totals must reconcile to the elapsed window, not the whole plan — the
    // seven unreported months carry a target that is not anyone's shortfall.
    const districtAchievement = compost.districts.reduce((sum, district) => sum + district.achievement, 0);
    const districtTarget = compost.districts.reduce((sum, district) => sum + district.target, 0);
    expect(districtAchievement).toBe(compost.deliveredToDate);
    expect(districtTarget).toBe(compost.plannedToDate);
    expect(districtTarget).toBe(compost.plannedTotal);
    // Every district reported in all five elapsed months, so there is nothing silent
    // to report yet. The counter still has to exist and be zero, not absent.
    expect(compost.districts.every((district) => district.silentMonths === 0)).toBe(true);
  });
});

describe('duplicate source detection', () => {
  it('finds endpoints serving another endpoint’s rows, by content not by name', () => {
    const summary = getDuplicateSourceSummary();
    const group = summary.groups.find((entry) => entry.canonical === 'compost_pits_api');
    expect(group?.duplicates).toEqual(['soak_pits_api']);
    // The duplicate admits it in its own descriptive column.
    expect(group?.claimedLabels).toEqual(['Compost Pits']);
    expect(summary.redundantKeys).toBe(1);
    expect(summary.redundantRows).toBe(336);
  });

  it('never treats two empty datasets as duplicates of each other', () => {
    // Content comparison would make every empty set identical, which is not evidence.
    expect(getDuplicateSourceGroups().every((group) => group.rows > 0)).toBe(true);
  });

  it('states that detection is by content so it self-heals', () => {
    expect(getDuplicateSourceSummary().boundary).toContain('comparing row content, not dataset names');
  });
});

describe('plan shapes beyond a monthly series', () => {
  it('does not manufacture a period for a source that reports none', () => {
    const plans = getDeliveryPlans();
    const gobardhan = plans.find((plan) => plan.id === 'gobardhan')!;
    expect(gobardhan.periodicity).toBe('point-in-time');
    // No months means no chart and no elapsed window to reason about.
    expect(gobardhan.months).toEqual([]);
    expect(gobardhan.elapsed).toEqual([]);
    expect(gobardhan.remaining).toEqual([]);
    expect(gobardhan.boundary).toContain('No trend is shown because none is reported');
    // District totals still reconcile, because the single bucket is the counted scope.
    expect(gobardhan.districts.reduce((sum, d) => sum + d.target, 0)).toBe(gobardhan.plannedToDate);
    expect(gobardhan.plannedTotal).toBe(gobardhan.plannedToDate);
  });

  it('reads a month-number-plus-year period as well as a YYYYMM one', () => {
    const csc = getDeliveryPlans().find((plan) => plan.id === 'sanitary-complexes')!;
    expect(csc.periodicity).toBe('monthly');
    // construction_of_csc_api encodes May/June/July as month_no + year, not YYYYMM.
    expect(csc.months.map((month) => month.monthId)).toEqual(['202605', '202606', '202607']);
    expect(csc.districts).toHaveLength(28);
    expect(csc.excluded).toBe(0);
  });

  it('flags a source whose id and name columns hold each other’s values', () => {
    const plans = getDeliveryPlans();
    // itc_wow_schools_api returns dstrt_id="ANANTAPUR" and dstrt_nm="12".
    expect(plans.find((plan) => plan.id === 'itc-wow-schools')!.transposedIdentity).toBe(true);
    // Gobardhan carries the same column pair the right way round.
    expect(plans.find((plan) => plan.id === 'gobardhan')!.transposedIdentity).toBe(false);
  });

  it('takes the district label from the column that is actually a name', () => {
    const itc = getDeliveryPlans().find((plan) => plan.id === 'itc-wow-schools')!;
    // Reading dstrt_nm would have produced numeric "district" labels.
    expect(itc.districts.every((district) => !Number.isFinite(Number(district.district)))).toBe(true);
    expect(itc.districts.length).toBe(24);
  });
});

describe('secretariat cohort', () => {
  it('establishes identity on a shared numeric key, with nothing inferred', () => {
    const cohort = getSecretariatCohort();
    expect(cohort.identity.key).toBe('sachivalayam_code');
    // Both sources return the same code set on this day; nothing is name-matched.
    expect(cohort.identity.collectionCodes).toBe(cohort.identity.segregationCodes);
    expect(cohort.identity.unmatched).toBe(0);
    expect(cohort.identity.disputed).toBe(0);
    expect(cohort.identity.denominatorConflicts).toBe(0);
  });

  it('opens identity, period and denominator — and keeps basis and policy shut', () => {
    const cohort = getSecretariatCohort();
    const gate = (id: string) => cohort.gates.find((entry) => entry.id === id)!;
    expect(gate('identity').passes).toBe(true);
    expect(gate('period').passes).toBe(true);
    expect(gate('denominator').passes).toBe(true);
    // One day is not a performance basis, and no policy exists to score against.
    expect(gate('basis').passes).toBe(false);
    expect(gate('policy').passes).toBe(false);
    expect(cohort.scoreable).toBe(false);
  });

  it('gives no segregation rate where nothing was collected', () => {
    const cohort = getSecretariatCohort();
    const silent = cohort.points.filter((point) => point.collected === 0);
    expect(silent.length).toBeGreaterThan(0);
    // No denominator means no rate. A zero rate would assert something the source did not.
    expect(silent.every((point) => point.segregationOfCollected === null && point.silent)).toBe(true);
    expect(cohort.silent).toBe(silent.length);
  });

  it('holds the containment the two measures must obey', () => {
    const cohort = getSecretariatCohort();
    // Segregated waste is a subset of collected waste. Not one secretariat breaks it.
    expect(cohort.containmentBreaches).toBe(0);
    expect(cohort.points.every((point) => point.segregated <= point.collected)).toBe(true);
    expect(cohort.points.every((point) => point.segregationOfCollected === null || point.segregationOfCollected <= 1)).toBe(true);
  });
});

describe('rural cohort — descriptive evidence', () => {
  it('joins the register to the activity with nothing inferred', () => {
    const cohort = getRuralCohort();
    expect(cohort.identity.key).toBe('GRAM_PANCHAYAT_ID');
    expect(cohort.identity.matched).toBe(cohort.identity.registered);
    expect(cohort.identity.registeredWithoutActivity).toBe(0);
    expect(cohort.identity.registerDisputed).toBe(0);
  });

  it('retains the low-activity day without declaring an outage', () => {
    const cohort = getRuralCohort();
    expect(cohort.outageDays).toEqual([]);
    expect(cohort.usableDays).toHaveLength(7);
    expect(cohort.anomalousDays).toContain('2026-08-02');
    expect(cohort.groups.every(g => g.panchayatDays <= g.panchayats * 7)).toBe(true);
  });

  it('reports the with/without difference without asserting no relationship', () => {
    const cohort = getRuralCohort();
    expect(cohort.spreadPoints).toBeCloseTo(0.17, 2);
    expect(cohort).not.toHaveProperty('noRelationship');
    expect(cohort.recordQuality.uniqueRows).toBe(91427);
    expect(cohort.recordQuality.rawRows).toBe(280371);
    expect(cohort.observedGridGap).toBe(2030);
  });

  it('keeps the register’s unknown currency attached to the reading', () => {
    const cohort = getRuralCohort();
    expect(cohort.registerCurrency).toContain('no date column');
    expect(cohort.boundary).toContain('does not establish');
  });
});

it('does not add cumulative-looking CSC and drain positions across months',()=>{
  const plans=getDeliveryPlans();
  const csc=plans.find(p=>p.id==='sanitary-complexes')!;
  expect(csc.deliveredToDate).toBe(2758);
  expect(csc.plannedToDate).toBe(6429);
  const drains=plans.find(p=>p.id==='magic-drains')!;
  expect(drains.deliveredToDate).toBeCloseTo(32.757,3);
  const may=getDeliveryPlans('202605').find(p=>p.id==='sanitary-complexes')!;
  expect(may.deliveredToDate).toBe(1179);
  expect(may.selectedMonth?.monthId).toBe('202605');
});
