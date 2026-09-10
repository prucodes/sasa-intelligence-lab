import {getRuralMovement} from './rural-movement';
import infrastructure from '@/data/aggregates/infrastructure-series.json';
import {getDistinctDeliveryPlans} from './delivery-plan';
import {getUlbComparison} from './ulb-comparison';
import {serviceSnapshot,serviceExclusions} from './ulb-service';

/** Eligibility belongs to an analysis, rather than one global all-or-nothing gate. */
export function getGapCapabilities() {
  const movement=getRuralMovement();
  // Sourced from the four-month series the tab actually renders. The older rural-cohort
  // aggregate is August only, so labelling this tab from it described a narrower
  // window than the screen behind it.
  const registered=Math.max(...infrastructure.series.map(s=>s.matchedPanchayats));
  const plans=getDistinctDeliveryPlans().filter(p=>p.selectedMonth?.achievement!==null && p.selectedMonth!==null);
  return [
    {id:'service',label:'ULB service snapshot',available:serviceSnapshot.ulbs.some(u=>!serviceExclusions(u).length),scope:'Collection and segregation · 12 August 2026',boundary:'Draft reference categories for one reported day; not overall ULB ratings.'},
    {id:'rankings',label:'Subject rankings & profiles',available:serviceSnapshot.ulbs.length>0,scope:'Five subject-specific measures',boundary:'Ranks within a defined source and period; no overall index.'},
    {id:'ulb',label:'ULB delivery comparison',available:getUlbComparison().points.length>0,scope:'ULB-level delivery positions',boundary:'One programme and period; no overall performance rating.'},
    {id:'movement',label:'May–August trends',available:movement.cohort.pairs>0,scope:`${movement.cohort.pairs.toLocaleString('en-IN')} common GP-day observations`,boundary:'Reported first-week trends across four months; not programme effects.'},
    {id:'register',label:'Infrastructure & activity',available:registered>0,scope:`${registered.toLocaleString('en-IN')} registered GPs matched across ${infrastructure.series.length} months`,boundary:'The facility register is undated; no programme effect is inferred.'},
    {id:'works',label:'Reported programme gaps',available:plans.length>0,scope:`${plans.length} distinct monthly programmes`,boundary:'Selected-month targets and achievements; no cross-month sum.'},
  ];
}
