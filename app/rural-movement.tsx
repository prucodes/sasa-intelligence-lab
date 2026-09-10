'use client';
import {useMemo,useState} from 'react';
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
export function RuralMovement({compact=false,href='/gap-radar?mode=governed&view=movement'}:{compact?:boolean;href?:string}) {
 const [basis,setBasis]=useState<RateBasis>('all-days');
 const data=useMemo(()=>getRuralMovement(basis),[basis]),[district,setDistrict]=useState(''),[showAll,setShowAll]=useState(false);
 const droppedRates=data.excludedDays.flatMap(e=>e.days.map(d=>d.collectionRate)).filter((v):v is number=>v!==null);
 const droppedRange=droppedRates.length?`${pct(Math.min(...droppedRates))}\u2013${pct(Math.max(...droppedRates))}`:'near zero';
 const selected=data.districts.find(d=>d.district===district),points=selected?.points??data.series.map(s=>({period:s.period,collectionRate:s.comparable.collectionRate}));
 const change=(points.at(-1)!.collectionRate!-points[0].collectionRate!)*100;
 const rows=showAll?data.districts:data.districts.filter(d=>d.direction!=='mixed');
 return <section className="evidence-workspace movement-reference movement-series" data-compact={compact} aria-label="Four-month rural collection comparison">
 <header className="ew-heading"><div><span className="ew-kicker">Rural collection · May → August 2026</span><h2>{compact?<>Four months, one cohort,<br/><em>read the same way each time.</em></>:<>A modest statewide shift.<br/><em>{data.declining.length} districts decline at every step.</em></>}</h2><p>First seven days of each month · one common cohort · reported collection activity</p></div></header>
 <div className="ew-controls"><label>Days counted<select aria-label="Rural collection day basis" value={basis} onChange={e=>setBasis(e.target.value as RateBasis)}><option value="all-days">All seven days · includes the Sunday</option><option value="working-days">Working days only · excludes scheduled non-collection days</option></select></label></div>
 <p className="ew-caption">{basis==='all-days'
  ?`Each seven-day window contains one Sunday, and those Sundays report ${droppedRange} across the four months — they are the scheduled non-collection day, not a reporting failure. Every month carries exactly one, so the periods stay comparable, but the level sits below the rate on days collection was scheduled.`
  :`Scheduled non-collection days are excluded: ${data.excludedDays.map(e=>e.days.map(d=>`${d.date} (${d.reason})`).join(', ')).filter(Boolean).join(' · ')}. Rates are read over the remaining working days of the same cohort.`}</p>
 <div className="movement-geography-layout"><div className="movement-series-story"><span className="ew-kicker">{district||'All matched districts'}</span><strong className="movement-series-value">{signed(change)}</strong><p>percentage points &mdash; {pct(points[0].collectionRate)} in {month(points[0].period)} to {pct(points.at(-1)!.collectionRate)} in {month(points.at(-1)!.period)}</p><small>{n(selected?.pairs??data.cohort.pairs)} matched GP-day observations in every month</small>
 <svg viewBox="0 0 520 220" role="img" aria-label={`${district||'Statewide'} first-week collection rates: ${points.map(p=>`${month(p.period)} ${pct(p.collectionRate)}`).join(', ')}`}>
 {[0,50,100].map(t=><g key={t}><line x1="45" x2="480" y1={175-t*1.3} y2={175-t*1.3}/><text x="35" y={179-t*1.3} textAnchor="end">{t}%</text></g>)}
 <polyline points={points.map((p,i)=>`${65+i*130},${175-p.collectionRate!*130}`).join(' ')} fill="none" className="movement-series-line"/>
 {points.map((p,i)=><g key={p.period}><circle cx={65+i*130} cy={175-p.collectionRate!*130} r="5"/><text x={65+i*130} y={160-p.collectionRate!*130} textAnchor="middle">{pct(p.collectionRate)}</text><text x={65+i*130} y="205" textAnchor="middle">{month(p.period)}</text></g>)}</svg>
 <p className="ew-caption">Yes ÷ valid Yes/No collection reports, {basis==='all-days'?'all seven days':'working days only'}. Full 0–100% scale; the same GP and day-of-month observations are used throughout.</p></div>
 <DistrictMap rows={data.districts.map(d=>({district:d.district,value:d.changePercentagePoints,detail:`${n(d.pairs)} matched observations · ${d.points.map(p=>pct(p.collectionRate)).join(' → ')}`}))} selected={district} onSelect={setDistrict} title="May → August change by district" unit="percentage points" diverging/>
 </div>
 <div className="movement-ledger"><span><b>{n(data.cohort.pairs)}</b> common GP-day observations</span><span><b>{data.declining.length}</b> districts decrease at every step</span><span><b>{data.rising.length}</b> increase at every step</span><span><b>{data.periods.length}</b> validated retained months</span></div>
 <div className="movement-districts"><header><div><h3>Follow the district trajectories</h3><p>Four reported first-week rates · May, June, July, August</p></div></header><div className="movement-series-table"><table><thead><tr><th>District</th>{data.periods.map(p=><th key={p}>{month(p)}</th>)}<th>Change<small className="th-unit">percentage points</small></th><th>Pattern</th></tr></thead><tbody>{rows.map(d=><tr key={d.district}><th><button aria-pressed={district===d.district} onClick={()=>setDistrict(district===d.district?'':d.district)}>{d.district}</button></th>{d.points.map(p=><td key={p.period}>{pct(p.collectionRate)}</td>)}<td>{signed(d.changePercentagePoints??0)}</td><td>{d.direction==='mixed'?'Mixed direction':d.direction==='decreasing'?'↓ Every step':'↑ Every step'}</td></tr>)}</tbody></table></div><button className="vi-text-button" onClick={()=>setShowAll(!showAll)} aria-expanded={showAll}>{showAll?'Show consistent trajectories':`Browse all ${data.districts.length} districts`}</button></div>
 <p className="ew-notice">These are reported first-week trends, not full-month service ratings or established programme effects. Day-of-month pairing holds the weekday mix roughly constant rather than eliminating it, and the working-day basis excludes Sundays and second Saturdays by calendar rather than by any published holiday list. Stored zero/No responses may reflect reporting behaviour.</p>
 {compact&&<a className="evidence-link" href={href}>Explore the rural evidence ↗</a>}
 <details className="ew-evidence"><summary>Common cohort, source validation & full-period context</summary><p>{data.cohort.rule} {data.comparableWindow}. Full-period rates use different denominators and are not used in this comparison.</p>{data.series.map(s=><p key={s.period}><b>{s.period}</b>: {n(data.recordQuality[s.period as keyof typeof data.recordQuality].rawRows)} raw rows → {n(s.distinctPanchayatDays)} distinct GP-days; {s.daysRetained} days retained; {(s.observedGridCoverage*100).toFixed(2)}% observed-grid coverage. Full-period context: {pct(s.context.collectionRate)}. Conflicting keys: {data.recordQuality[s.period as keyof typeof data.recordQuality].conflictingKeys}.</p>)}</details>
 </section>;
}
