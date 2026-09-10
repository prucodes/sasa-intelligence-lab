/** Checks the values published by each aggregate, independently of its builder. */
export function validateAggregate(name, data) {
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(`${name}: ${message}`); };
  const sum = (rows, field) => rows.reduce((n, row) => n + row[field], 0);
  const equal = (actual, expected, field, tolerance = 0.000051) => check(actual === expected || (typeof actual === 'number' && typeof expected === 'number' && Math.abs(actual - expected) <= tolerance), `${field} does not reconcile (${actual} versus ${expected})`);
  const ratio = (top, bottom) => bottom > 0 ? top / bottom : null;
  function quality(q, prefix) {
    for (const field of ['rawRows','uniqueRows','duplicateRows','conflictingKeys','conflictingRows','missingKeyRows']) check(Number.isInteger(q[field]) && q[field]>=0, `${prefix}.${field} must be a non-negative integer`);
    equal(q.rawRows, q.uniqueRows + q.duplicateRows + q.conflictingRows + q.missingKeyRows, `${prefix}.rawRows`, 0);
    check(q.conflictingKeys <= q.conflictingRows, `${prefix}: conflicting keys exceed held-out rows`);
  }
  if (name === 'infrastructure-series.json') {
    check(data.series.length>0,'no retained months');
    check(data.windowDays>0&&data.windowDays<=31,'invalid common window');
    const groupCheck=g=>{equal(g.observations,g.valid+g.missing,'valid/missing observations',0);check(g.yes>=0&&g.yes<=g.valid,'Yes exceeds valid responses');equal(g.rate,ratio(g.yes,g.valid),'group rate');check(g.segregationValid<=g.observations,'segregation denominator exceeds observations');};
    for(const m of data.series){
      quality(m.quality,m.period);
      equal(sum(m.days,'observations'),m.quality.uniqueRows,'daily distinct counts',0);
      equal(sum(m.full,'observations')+m.unmatchedObservations,m.quality.uniqueRows,'register join coverage',0);
      equal(sum(m.comparable,'valid'),data.commonObservations,'common cohort population',0);
      for(const g of [...m.full,...m.comparable,...m.sensitivity,...m.byCondition,...m.byDistrict.flatMap(d=>d.groups)])groupCheck(g);
      for(const g of m.comparable)equal(g.valid,data.series[0].comparable.find(r=>r.id===g.id).valid,'fixed register group population',0);
      equal(sum(m.byCondition,'observations'),m.full.find(g=>g.id==='with-centre').observations,'condition population',0);
      for(const field of ['observations','valid','yes','missing'])equal(sum(m.byDistrict.flatMap(d=>d.groups),field),sum(m.full,field),'district '+field,0);
      check(m.lowDays.every(date=>m.days.some(d=>d.date===date&&d.rate<.2)),'low-reporting dates');
      check(sum(m.sensitivity,'observations')<=sum(m.full,'observations'),'sensitivity population');
    }
  } else if (name === 'ulb-service-snapshot.json') {
    quality(data.recordQuality.collection,'collection'); quality(data.recordQuality.segregation,'segregation');
    check(data.recordQuality.collection.conflictingKeys===0 && data.recordQuality.segregation.conflictingKeys===0,'conflicting source keys');
    check(data.recordQuality.collection.missingKeyRows===0 && data.recordQuality.segregation.missingKeyRows===0,'missing source keys');
    equal(data.points.length,data.recordQuality.collection.uniqueRows,'paired collection population',0);
    equal(data.points.length,data.recordQuality.segregation.uniqueRows,'paired segregation population',0);
    check(new Set(data.points.map(p=>p[0])).size===data.points.length,'duplicate secretariat codes');
    check(new Set(data.ulbs.map(u=>u.code)).size===data.ulbs.length,'duplicate native ULB codes');
    check(data.points.every(p=>data.ulbs.some(u=>u.code===p[1])),'orphan secretariat ULB');
    for (const p of data.points) {
      check(p.slice(2,5).every(v=>Number.isFinite(v)&&v>=0),'invalid paired measure');
      check(p[4]<=p[3]&&p[3]<=p[2],'paired measure containment breach');
      check(p[5]===0||p[5]===1,'invalid mapping review flag');
    }
    for (const u of data.ulbs) {
      const points=data.points.filter(p=>p[1]===u.code);
      check(!!u.code && !!u.name && !!u.district && points.length>0,'empty ULB identity or cohort');
      equal(u.secretariats,points.length,`${u.code}.secretariats`,0);
      equal(u.positiveHouseholdSecretariats,points.filter(p=>p[2]>0).length,`${u.code}.positiveHouseholdSecretariats`,0);
      equal(u.mappingReviewSecretariats,points.filter(p=>p[5]).length,`${u.code}.mappingReviewSecretariats`,0);
      for(const [index,field] of ['households','collected','segregated'].entries()) equal(u[field],points.reduce((n,p)=>n+p[index+2],0),`${u.code}.${field}`,0);
    }
    for(const field of ['households','collected','segregated']) equal(data.totals[field],sum(data.ulbs,field),`totals.${field}`,0);
  } else if (name === 'secretariat-cohort.json') {
    const index = Object.fromEntries(data.pointFields.map((field,i)=>[field,i]));
    const points = data.points.map(row=>Object.fromEntries(Object.entries(index).map(([field,i])=>[field,row[i]])));
    equal(data.cohort, points.length, 'cohort', 0);
    check(new Set(points.map(p=>p.code)).size === points.length, 'duplicate secretariat identities');
    for(const field of ['households','collected','segregated']) {
      check(points.every(p=>Number.isFinite(p[field]) && p[field]>=0), `${field}: invalid measurement`);
      equal(data.totals[field],sum(points,field),`totals.${field}`);
    }
    equal(data.reporting,points.filter(p=>p.collected>0).length,'reporting',0);
    equal(data.silent,points.filter(p=>p.collected===0).length,'zero-collection count',0);
    equal(data.containmentBreaches,points.filter(p=>p.segregated>p.collected).length,'containmentBreaches',0);
    equal(data.collectionCoverage,ratio(data.totals.collected,data.totals.households),'collectionCoverage');
    equal(data.segregationCoverage,ratio(data.totals.segregated,data.totals.households),'segregationCoverage');
    equal(data.segregationOfCollected,ratio(data.totals.segregated,data.totals.collected),'segregationOfCollected');
  } else if (name === 'reporting-continuity.json') {
    for(const d of data.datasets) {
      quality(d.quality,d.tableKey);
      equal(d.rows,d.quality.uniqueRows,`${d.tableKey}.uniqueRows`,0);
      equal(d.rawRows,d.quality.rawRows,`${d.tableKey}.rawRows`,0);
      equal(d.rows,sum(d.days,'rows'),`${d.tableKey}.day rows`,0);
      equal(d.totalValue,sum(d.days,'value'),`${d.tableKey}.totalValue`);
      equal(d.totalDenominator,sum(d.days,'denominator'),`${d.tableKey}.totalDenominator`);
      equal(d.missingExpectedRecords,d.entities*d.days.length-d.rows,`${d.tableKey}.observed grid gap`,0);
      check(new Set(d.days.map(day=>day.date)).size===d.days.length,`${d.tableKey}: repeated dates`);
      for(const day of d.days) {
        equal(day.rows,day.positive+day.zero+day.missing,`${d.tableKey}/${day.date}: states`,0);
        equal(day.reporting,day.positive+day.zero,`${d.tableKey}/${day.date}: valid measurements`,0);
        equal(day.reportingRatio,ratio(day.reporting,day.rows),`${d.tableKey}/${day.date}: reportingRatio`);
        equal(day.positiveRatio,ratio(day.positive,day.rows),`${d.tableKey}/${day.date}: positiveRatio`);
        check(day.rows<=d.entities && day.pairedRows<=day.reporting,`${d.tableKey}/${day.date}: population bounds`);
      }
      equal(d.naiveRatio,ratio(sum(d.days,'pairedValue'),d.totalDenominator),`${d.tableKey}.paired ratio`);
      const busiest=d.days.find(day=>day.date===d.busiestDate);
      equal(d.busiestDateShare,ratio(busiest?.value ?? 0,d.totalValue),`${d.tableKey}.busiestDateShare`);
      check(d.entitiesNeverReporting<=d.entities && d.entitiesReportingEveryDay<=d.entities,`${d.tableKey}: entity bounds`);
    }
  } else if(name === 'rural-cohort.json') {
    quality(data.recordQuality,'recordQuality');
    equal(data.recordQuality.uniqueRows,sum(data.days,'rows'),'daily distinct rows',0);
    equal(data.recordQuality.gridCoverage,ratio(data.recordQuality.uniqueRows,data.recordQuality.gridCeiling),'gridCoverage');
    equal(data.cohort,sum(data.groups,'panchayats'),'group population',0);
    equal(data.cohort,sum(data.byDistrict,'panchayats'),'district population',0);
    equal(data.identity.matched,data.cohort,'matched population',0);
    for(const g of [...data.groups,...data.byCondition,...data.byDistrict]) {
      check(g.panchayatDays<=g.panchayats*data.usableDays.length,'GP-days exceed possible population');
      if ('validCollectionDays' in g) {
        equal(g.panchayatDays,g.validCollectionDays+g.missingActivityDays,'valid and missing collection days',0);
        check(g.collectedDays<=g.validCollectionDays && g.validSegregationDays<=g.panchayatDays,'valid measurement bounds');
        equal(g.collectionRate,ratio(g.collectedDays,g.validCollectionDays),'group collection rate');
        equal(g.segregatedPerPanchayatDay,ratio(g.segregatedHouseholds,g.validSegregationDays),'group segregation mean');
      }
    }
    for(const field of ['panchayatDays','validCollectionDays','collectedDays','missingActivityDays','segregatedHouseholds','validSegregationDays']) {
      if(field in data.groups[0]) equal(sum(data.groups,field),sum(data.byDistrict,field),`${field}: group / district reconciliation`);
    }
    equal(data.collectionRateWithCentre,data.groups.find(g=>g.id==='with-centre')?.collectionRate,'with-centre headline');
    equal(data.collectionRateWithoutCentre,data.groups.find(g=>g.id==='without-centre')?.collectionRate,'without-centre headline');
  } else if(name === 'rural-swpc-districts.json') {
    equal(data.panchayatsCounted,sum(data.districts,'panchayats'),'district population',0);
    for(const d of data.districts) {
      equal(d.panchayats,d.withSwpc+d.withoutSwpc+d.swpcNotStated,`${d.district}: presence states`,0);
      equal(d.withSwpc,d.fullyFunctioning+d.partiallyFunctioning+d.notFunctioning+d.conditionNotStated,`${d.district}: present-centre conditions`,0);
      check(d.functionalWithoutCentre<=d.conditionConflicts && d.conditionConflicts<=d.withoutSwpc+d.swpcNotStated,`${d.district}: inconsistent-condition bounds`);
    }
  } else if(name === 'july-august-comparison.json') {
    for(const period of ['2026-07','2026-08']) quality(data.recordQuality[period],period);
    const p = data.pairing;
    for(const field of ['eligibleCollectionPairs','eligibleSegregationPairs','droppedForInvalidMeasure','julyOnlyPanchayatDays','augustOnlyPanchayatDays'])
      check(Number.isInteger(p[field]) && p[field]>=0,`pairing.${field} must be a non-negative integer`);
    // A pair is one panchayat-day present in BOTH months, so it can never exceed either
    // month's distinct holdings, and segregation pairs are a subset of the paired window.
    check(p.eligibleCollectionPairs<=data.generatedFrom['2026-07'].distinctPanchayatDays
       && p.eligibleCollectionPairs<=data.generatedFrom['2026-08'].distinctPanchayatDays,'eligible pairs exceed a month\u2019s distinct panchayat-days');
    check(p.eligibleSegregationPairs<=p.eligibleCollectionPairs+p.droppedForInvalidMeasure,'segregation pairs exceed the paired window');
    for(const side of ['julyRate','augustRate']) check(data.collection[side]===null||(data.collection[side]>=0&&data.collection[side]<=1),`collection.${side} out of range`);
    equal(data.collection.changePercentagePoints,
      data.collection.julyRate===null||data.collection.augustRate===null?null:(data.collection.augustRate-data.collection.julyRate)*100,
      'collection.changePercentagePoints',0.00006);
    // Districts partition the paired window exactly: no pair belongs to two districts.
    equal(sum(data.byDistrict,'pairs'),p.eligibleCollectionPairs,'district pairs',0);
    check(new Set(data.byDistrict.map(d=>d.district)).size===data.byDistrict.length,'repeated district');
    for(const d of data.byDistrict) {
      for(const side of ['julyRate','augustRate']) check(d[side]===null||(d[side]>=0&&d[side]<=1),`${d.district}: ${side} out of range`);
      equal(d.changePercentagePoints,d.julyRate===null||d.augustRate===null?null:(d.augustRate-d.julyRate)*100,`${d.district}: change`,0.00006);
    }
  } else if(name === 'ulb-service-series.json') {
    check(Array.isArray(data.days) && data.days.length>0,'no days built');
    check(new Set(data.days).size===data.days.length,'repeated day');
    check(Array.isArray(data.daysWithheld),'daysWithheld must be present, even when empty');
    const count = data.ulbs.length;
    check(new Set(data.ulbs.map(u=>u[0])).size===count,'repeated ULB code');
    check(data.stability.length===count,'stability does not cover every ULB');
    for(const day of data.days) {
      const row = data.series[day];
      check(Array.isArray(row) && row.length===count,`${day}: series row does not align with the ULB roster`);
      for(const cell of row) {
        if(cell===null) continue;
        const [households,collected,segregated]=cell;
        check([households,collected,segregated].every(v=>Number.isFinite(v)&&v>=0),`${day}: invalid measure`);
        // The same containment the single-day builder asserts, re-checked on what shipped.
        check(segregated<=collected && collected<=households,`${day}: measure containment breach`);
      }
    }
    // Stability must be derivable from the series it claims to summarise.
    for(const entry of data.stability) {
      const position = data.ulbs.findIndex(u=>u[0]===entry.code);
      const cells = data.days.map(day=>data.series[day][position]).filter(Boolean);
      equal(entry.daysObserved,cells.length,`${entry.code}: daysObserved`,0);
      equal(entry.daysPossible,data.days.length,`${entry.code}: daysPossible`,0);
      equal(entry.zeroCollectionDays,cells.filter(([,collected])=>collected===0).length,`${entry.code}: zeroCollectionDays`,0);
      const above = cells.filter(([h,c])=>h>0 && c/h>=data.references.collection).length;
      equal(entry.collection.daysAtOrAboveReference,above,`${entry.code}: collection days at/above reference`,0);
      check(entry.consistentlyBelowCollection === (cells.some(([h])=>h>0) && above===0),`${entry.code}: consistentlyBelowCollection disagrees with the series`);
      for(const side of ['collection','segregation']) {
        const m=entry[side];
        for(const field of ['median','low','high']) check(m[field]===null||(m[field]>=0&&m[field]<=1),`${entry.code}: ${side}.${field} out of range`);
        if(m.low!==null&&m.high!==null) check(m.low<=m.high,`${entry.code}: ${side} span inverted`);
      }
    }
  } else if(name === 'month-series.json') {
    check(Array.isArray(data.periods) && data.periods.length>=2,'a series needs at least two periods');
    check(new Set(data.periods).size===data.periods.length,'repeated period');
    for(const period of data.periods) quality(data.recordQuality[period],period);
    equal(data.series.length,data.periods.length,'series length',0);
    const pairs = data.cohort.pairs;
    check(Number.isInteger(pairs) && pairs>0,'cohort.pairs must be a positive integer');
    for(const entry of data.series) {
      // One cohort across the whole series: every period reports the same pair count, or
      // the periods are not being compared on the same population.
      equal(entry.comparable.pairs,pairs,`${entry.period}: comparable pairs differ from the cohort`,0);
      check(entry.comparable.collected<=pairs,`${entry.period}: collected exceeds the cohort`);
      equal(entry.comparable.collectionRate,ratio(entry.comparable.collected,pairs),`${entry.period}: collection rate`);
      check(entry.distinctPanchayatDays<=data.generatedFrom[entry.period].rows,`${entry.period}: distinct exceeds raw rows`);
      check(entry.observedGridCoverage===null||(entry.observedGridCoverage>0&&entry.observedGridCoverage<=1),`${entry.period}: grid coverage out of range`);
      check(entry.context.collectionRate===null||(entry.context.collectionRate>=0&&entry.context.collectionRate<=1),`${entry.period}: context rate out of range`);
      // The published days must reconstitute the published rate exactly. A screen that
      // recomputes a working-day rate from these is only safe if they partition the cohort.
      check(Array.isArray(entry.comparableByDay)&&entry.comparableByDay.length>0,`${entry.period}: comparableByDay is missing`);
      equal(sum(entry.comparableByDay,'pairs'),pairs,`${entry.period}: days do not partition the cohort`,0);
      equal(sum(entry.comparableByDay,'collected'),entry.comparable.collected,`${entry.period}: days do not reconstitute the collected count`,0);
      check(new Set(entry.comparableByDay.map(d=>d.day)).size===entry.comparableByDay.length,`${entry.period}: repeated day`);
      for(const day of entry.comparableByDay) {
        check(Number.isInteger(day.day)&&day.day>=1&&day.day<=31,`${entry.period}: day ${day.day} out of range`);
        check(day.collected<=day.pairs,`${entry.period}/day ${day.day}: collected exceeds pairs`);
        equal(day.collectionRate,ratio(day.collected,day.pairs),`${entry.period}/day ${day.day}: rate`);
      }
    }
    // Every period must carry the same days, or the periods are not comparable day by day.
    const dayShape = data.series.map(entry=>entry.comparableByDay.map(d=>d.day).join(','));
    check(new Set(dayShape).size===1,'periods do not share the same comparable days');
    // Districts partition the cohort exactly: no pair counted twice, none dropped.
    equal(sum(data.byDistrict,'pairs'),pairs,'district pairs do not partition the cohort',0);
    check(new Set(data.byDistrict.map(d=>d.district)).size===data.byDistrict.length,'repeated district');
    for(const district of data.byDistrict) {
      equal(district.points.length,data.periods.length,`${district.district}: point count`,0);
      district.points.forEach((point,i)=>{
        check(point.period===data.periods[i],`${district.district}: point ${i} period is out of order`);
        check(point.collectionRate===null||(point.collectionRate>=0&&point.collectionRate<=1),`${district.district}/${point.period}: rate out of range`);
      });
      const open=district.points[0].collectionRate, close=district.points[district.points.length-1].collectionRate;
      equal(district.changePercentagePoints,open===null||close===null?null:(close-open)*100,`${district.district}: first-to-last change`,0.00006);
    }
  } else check(false,'no aggregate reconciliation contract registered');
  return failures;
}
