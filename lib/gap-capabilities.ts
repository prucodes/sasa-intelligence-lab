import {getRuralMovement,type RateBasis} from './rural-movement';
import infrastructure from '@/data/aggregates/infrastructure-series.json';
import {getDistinctDeliveryPlans} from './delivery-plan';
import {getUlbComparison} from './ulb-comparison';
import {serviceSnapshot,serviceExclusions} from './ulb-service';
import {rankingSubjects} from './subject-rankings';

/** Eligibility belongs to an analysis, rather than one global all-or-nothing gate. */
export function getGapCapabilities(basis:RateBasis='all-days') {
  const movement=getRuralMovement(basis);
  // Sourced from the four-month series the tab actually renders. The older rural-cohort
  // aggregate is August only, so labelling this tab from it described a narrower
  // window than the screen behind it.
  const registered=Math.max(...infrastructure.series.map(s=>s.matchedPanchayats));
  const plans=getDistinctDeliveryPlans().filter(p=>p.selectedMonth?.achievement!==null && p.selectedMonth!==null);
  // Every tab states the figure its own comparison rests on. None is invented: a tab
  // with nothing it could stand on would carry no figure rather than a decorative one.
  const placed=serviceSnapshot.ulbs.filter(u=>!serviceExclusions(u).length).length;
  const plotted=getUlbComparison().points.length;
  const shift=(movement.series.at(-1)!.comparable.collectionRate ?? 0)*100-(movement.series[0].comparable.collectionRate ?? 0)*100;
  const last=infrastructure.series.at(-1)!;
  const group=(id:string)=>last.comparable.find(entry=>entry.id===id)?.rate ?? null;
  const withCentre=group('with-centre'), withoutCentre=group('without-centre');
  const separation=withCentre===null||withoutCentre===null?null:(withCentre-withoutCentre)*100;
  const signed=(value:number)=>`${value>0?'+':''}${value.toFixed(2)}`;
  return [
    {id:'service',label:'ULB service snapshot',figure:{value:`${placed}`,unit:`of ${serviceSnapshot.ulbs.length} ULBs carry both measures on the reference day`},finding:'Two reported household measures, read against draft references.',available:serviceSnapshot.ulbs.some(u=>!serviceExclusions(u).length),scope:'Collection and segregation · 12 August 2026',boundary:'Draft reference categories for one reported day; not overall ULB ratings.'},
    {id:'rankings',label:'Subject rankings & profiles',figure:{value:`${rankingSubjects.length}`,unit:'subjects ranked, each within its own source and period'},finding:'Ranked per subject, with no overall index formed across them.',available:serviceSnapshot.ulbs.length>0,scope:'Five subject-specific measures',boundary:'Ranks within a defined source and period; no overall index.'},
    {id:'ulb',label:'ULB delivery comparison',figure:{value:`${plotted}`,unit:'ULBs with both a denominator and a completion figure'},finding:'One programme and one period, positioned rather than scored.',available:getUlbComparison().points.length>0,scope:'ULB-level delivery positions',boundary:'One programme and period; no overall performance rating.'},
    {id:'movement',label:'May–August trends',figure:{value:signed(shift),unit:`percentage points across four months, on ${movement.cohort.pairs.toLocaleString('en-IN')} matched observations`},finding:`A modest statewide shift, and ${movement.declining.length} districts that decline at every step.`,available:movement.cohort.pairs>0,scope:`${movement.cohort.pairs.toLocaleString('en-IN')} common GP-day observations`,boundary:'Reported first-week trends across four months; not programme effects.'},
    {id:'register',label:'Infrastructure & activity',figure:{value:separation===null?'Not reported':signed(separation),unit:'percentage points between registered with and without a processing centre'},finding:'A separation too small to establish an effect, or to rule one out.',available:registered>0,scope:`${registered.toLocaleString('en-IN')} registered GPs matched across ${infrastructure.series.length} months`,boundary:'The facility register is undated; no programme effect is inferred.'},
    {id:'works',label:'Reported programme gaps',figure:{value:`${plans.length}`,unit:'distinct monthly programmes with a reported achievement'},finding:'Selected-month targets and achievements, never summed across months.',available:plans.length>0,scope:`${plans.length} distinct monthly programmes`,boundary:'Selected-month targets and achievements; no cross-month sum.'},
  ];
}
