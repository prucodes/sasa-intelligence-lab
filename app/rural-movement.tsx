'use client';
import {useCompactChart} from './use-compact-chart';
import {useEffect,useMemo,useState} from 'react';
import {getRuralMovement,type RateBasis} from '@/lib/rural-movement';
import {DistrictMap} from './district-map';
import './analysis-workspace.css';
import './evidence-expansion.css';
import './rural-movement.css';
const n=(v:number)=>v.toLocaleString('en-IN');
const pct=(v:number|null)=>v===null?'Not reported':`${(v*100).toFixed(2)}%`;
// "pp" reads as jargon to anyone who has not met it. The number stays bare and the
// column heading or caption beside it carries the unit in words.
const signed=(v:number)=>`${v>0?'+':''}${v.toFixed(2)}`;
const month=(p:string)=>new Date(`${p}-02T12:00:00Z`).toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'});
/** `findingStated` means a lede above already reports the result, so this section
 *  names its method instead of repeating the sentence. It follows `compact` by
 *  default because the Overview lede always states it, and Gap Radar now does too. */
export function RuralMovement({compact=false,findingStated=compact,href='/gap-radar?mode=governed&view=movement',basis:controlledBasis,onBasisChange}:{compact?:boolean;findingStated?:boolean;href?:string;basis?:RateBasis;onBasisChange?:(basis:RateBasis)=>void}) {
 const narrow=useCompactChart(),chartBottom=narrow?220:175,chartSpan=narrow?170:130;
 const chartX=(i:number)=>(narrow?75:65)+i*(narrow?93:130),chartY=(rate:number)=>chartBottom-rate*chartSpan;
 const [localBasis,setLocalBasis]=useState<RateBasis>('all-days');
 const basis=controlledBasis??localBasis;
 const setBasis=(next:RateBasis)=>{setLocalBasis(next);onBasisChange?.(next);};
 const data=useMemo(()=>getRuralMovement(basis),[basis]),[district,setDistrict]=useState(''),[showAll,setShowAll]=useState(false);
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search),requested=p.get('district');
  // Restore client URL context after hydration; server rendering has no browser location.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  if(requested&&getRuralMovement().districts.some(d=>d.district===requested))setDistrict(requested);
 },[]);
 const droppedRates=data.excludedDays.flatMap(e=>e.days.map(d=>d.collectionRate)).filter((v):v is number=>v!==null);
 const droppedRange=droppedRates.length?`${pct(Math.min(...droppedRates))}\u2013${pct(Math.max(...droppedRates))}`:'near zero';
 const selected=data.districts.find(d=>d.district===district),points=selected?.points??data.series.map(s=>({period:s.period,collectionRate:s.comparable.collectionRate}));
 const change=(points.at(-1)!.collectionRate!-points[0].collectionRate!)*100;
 const rows=showAll?data.districts:data.districts.filter(d=>d.direction!=='mixed');
 return <section className="evidence-workspace movement-reference movement-series" data-compact={compact} aria-label="Four-month rural collection comparison">
 {!compact&&<header className="ew-heading"><div><span className="ew-kicker">Rural collection · May → August 2026</span><h2>{findingStated?<>Four months, one cohort,<br/><em>read the same way each time.</em></>:<>A modest statewide shift.<br/><em>{data.declining.length} districts decline at every step.</em></>}</h2><p>First seven days of each month · one common cohort · reported collection activity</p></div></header>}
 <div className="ew-controls"><label>Days counted<select aria-label="Rural collection day basis" value={basis} onChange={e=>setBasis(e.target.value as RateBasis)}><option value="all-days">All seven days · includes the Sunday</option><option value="working-days">Working days only · excludes Sundays and second Saturdays</option></select></label></div>
 <details className="ew-caption"><summary>How the day selection affects these rates</summary><p>{basis==='all-days'
  ?`Each seven-day window contains one Sunday, and those Sundays report ${droppedRange} across the four months. That reads as a day off rather than a reporting failure, but no departmental schedule in the data confirms it. Every month carries exactly one, so the periods stay comparable, but the level sits below the rate on the other days.`
  :`Sundays and second Saturdays are excluded: ${data.excludedDays.map(e=>e.days.map(d=>`${d.date} (${d.reason})`).join(', ')).filter(Boolean).join(' · ')}. Rates are read over the remaining days of the same cohort.`}</p></details>
 <div className="movement-geography-layout"><div className="movement-series-story"><span className="ew-kicker">{district||'All matched districts'} · May–August 2026</span>{(!compact||district)&&<><strong className="movement-series-value">{signed(change)}</strong><p>percentage points, from {pct(points[0].collectionRate)} in {month(points[0].period)} to {pct(points.at(-1)!.collectionRate)} in {month(points.at(-1)!.period)}</p></>}<small>{n(selected?.pairs??data.cohort.pairs)} matched GP-day observations · first seven days · {basis==='all-days'?'all seven days':'working days'}</small>
 <svg className={narrow?'compact-trend':undefined} viewBox={narrow?'0 0 400 265':'0 0 520 220'} role="img" aria-label={`${district||'Statewide'} first-week collection rates: ${points.map(p=>`${month(p.period)} ${pct(p.collectionRate)}`).join(', ')}`}>
 <defs>
  {/* The fill is decoration under a line that already carries the value; it fades out
      well before the axis so it never reads as a quantity of its own. */}
  <linearGradient id="mv-fill" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0%" stopColor="var(--mv-line,#168d92)" stopOpacity=".22"/>
   <stop offset="100%" stopColor="var(--mv-line,#168d92)" stopOpacity="0"/>
  </linearGradient>
  <filter id="mv-glow" x="-60%" y="-60%" width="220%" height="220%">
   <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
 </defs>
 {[0,50,100].map(t=><g key={t}><line x1={narrow?60:45} x2={narrow?370:480} y1={chartY(t/100)} y2={chartY(t/100)}/><text x={narrow?50:35} y={chartY(t/100)+4} textAnchor="end">{t}%</text></g>)}
 <polygon className="movement-series-area" points={`${chartX(0)},${chartBottom} ${points.map((p,i)=>`${chartX(i)},${chartY(p.collectionRate!)}`).join(' ')} ${chartX(points.length-1)},${chartBottom}`} fill="url(#mv-fill)"/>
 <polyline points={points.map((p,i)=>`${chartX(i)},${chartY(p.collectionRate!)}`).join(' ')} fill="none" className="movement-series-line" filter="url(#mv-glow)"/>
 {points.map((p,i)=><g key={p.period}><circle className="movement-series-halo" cx={chartX(i)} cy={chartY(p.collectionRate!)} r="10"/><circle cx={chartX(i)} cy={chartY(p.collectionRate!)} r="5"/><text x={chartX(i)} y={chartY(p.collectionRate!)-18} textAnchor="middle">{pct(p.collectionRate)}</text><text x={chartX(i)} y={narrow?251:205} textAnchor="middle">{month(p.period)}</text></g>)}</svg>
 <p className="ew-caption">Yes ÷ valid Yes/No collection reports, {basis==='all-days'?'all seven days':'working days only'}. Full 0–100% scale; the same GP and day-of-month observations are used throughout.</p></div>
 <DistrictMap rows={data.districts.map(d=>({district:d.district,value:d.changePercentagePoints,detail:`${n(d.pairs)} matched observations · ${d.points.map(p=>pct(p.collectionRate)).join(' → ')}`}))} selected={district} onSelect={setDistrict} title="May → August change by district" unit="percentage points" diverging/>
 </div>
 <div className="movement-ledger"><span><b>{n(data.cohort.pairs)}</b> common GP-day observations</span><span><b>{data.declining.length}</b> districts decrease at every step</span><span><b>{data.rising.length}</b> increase at every step</span><span><b>{data.periods.length}</b> validated retained months</span></div>
 <div className="movement-districts"><header><div><h3>Follow the district trajectories</h3><p>Four reported first-week rates · May, June, July, August</p></div></header><div className="movement-series-table"><table><thead><tr><th>District</th>{data.periods.map(p=><th key={p}>{month(p)}</th>)}<th>Change<small className="th-unit">percentage points</small></th><th>Pattern</th></tr></thead><tbody>{rows.map(d=><tr key={d.district}><th><button aria-pressed={district===d.district} onClick={()=>setDistrict(district===d.district?'':d.district)}>{d.district}</button></th>{d.points.map(p=><td key={p.period}>{pct(p.collectionRate)}</td>)}<td>{signed(d.changePercentagePoints??0)}</td><td>{d.direction==='mixed'?'Mixed direction':d.direction==='decreasing'?'↓ Every step':'↑ Every step'}</td></tr>)}</tbody></table></div><button className="vi-text-button" onClick={()=>setShowAll(!showAll)} aria-expanded={showAll}>{showAll?'Show consistent trajectories':`Browse all ${data.districts.length} districts`}</button></div>
 <p className="ew-notice">These are reported first-week trends, not full-month service ratings or established programme effects. Day-of-month pairing holds the weekday mix roughly constant rather than eliminating it, and the working-day basis excludes Sundays and second Saturdays by calendar rather than by any published holiday list. Stored zero/No responses may reflect reporting behaviour.</p>
 {compact&&<a className="evidence-link" href={`${href}&basis=${basis}${district?`&district=${encodeURIComponent(district)}`:''}`}>Inspect {district||'these districts'} in Gap Radar ↗</a>}
 <details className="ew-evidence"><summary>Common cohort, source validation & full-period context</summary><p>{data.cohort.rule} {data.comparableWindow}. Full-period rates use different denominators and are not used in this comparison.</p>{data.series.map(s=><p key={s.period}><b>{s.period}</b>: {n(data.recordQuality[s.period as keyof typeof data.recordQuality].rawRows)} raw rows → {n(s.distinctPanchayatDays)} distinct GP-days; {s.daysRetained} days retained; {(s.observedGridCoverage*100).toFixed(2)}% observed-grid coverage. Full-period context: {pct(s.context.collectionRate)}. Conflicting keys: {data.recordQuality[s.period as keyof typeof data.recordQuality].conflictingKeys}.</p>)}</details>
 </section>;
}
