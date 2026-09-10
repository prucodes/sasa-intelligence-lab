'use client';
import { WorksTimeline } from './works-timeline';
import { useEffect, useMemo, useState } from 'react';
import { getDeliveryPlans } from '@/lib/delivery-plan';
import {DistrictMap} from './district-map';
import './analysis-workspace.css';

const number=(value:number|null)=>value===null?'Not reported':value.toLocaleString('en-IN',{maximumFractionDigits:3});

export function DeliveryPlans({overview=false}:{overview?:boolean}={}) {
  const [programme,setProgramme]=useState('compost-pits');
  const [period,setPeriod]=useState<string|null>(null);
  const [sort,setSort]=useState('district');
  const [district,setDistrict]=useState('');
  const [mapMeasure,setMapMeasure]=useState('rate');
  const [visual,setVisual]=useState(overview?'map':'timeline');
  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get('programme');
    // Hydration-safe deep link to a selected programme.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if(requested) setProgramme(requested);
  },[]);
  const plans=useMemo(()=>getDeliveryPlans(period),[period]);
  const distinct=plans.filter(p=>!p.duplicateOf);
  const plan=distinct.find(p=>p.id===programme)??distinct[0];
  if(!plan)return null;
  const month=plan.selectedMonth;
  const achievement=plan.periodicity==='monthly'?month?.achievement??null:plan.districts.some(d=>!d.achievementMissing)?plan.deliveredToDate:null;
  const target=plan.periodicity==='monthly'?month?.target??null:plan.districts.some(d=>!d.targetMissing)?plan.plannedToDate:null;
  const ratio=plan.paceToDate;
  const rows=[...plan.districts].filter(d=>!district||d.district===district).sort((a,b)=>sort==='district'?a.district.localeCompare(b.district):sort==='gap'?((b.targetMissing||b.achievementMissing?-Infinity:b.target-b.achievement)-(a.targetMissing||a.achievementMissing?-Infinity:a.target-a.achievement)):(b.achievementMissing?-Infinity:b.achievement)-(a.achievementMissing?-Infinity:a.achievement));
  const mapScope=plan.districts.filter(d=>!district||d.district===district),mapPaired=mapScope.filter(d=>!d.targetMissing&&!d.achievementMissing);
  const mapTarget=mapPaired.reduce((sum,d)=>sum+d.target,0),mapAchievement=mapPaired.reduce((sum,d)=>sum+d.achievement,0),mapRate=mapTarget>0?mapAchievement/mapTarget:null;
  const duplicates=plans.filter(p=>p.duplicateOf);
  return <section className="evidence-workspace" aria-labelledby="delivery-title">
    <header className="ew-heading"><div><span className="ew-kicker">Works &amp; programmes · district grain</span><h2 id="delivery-title">Reported progress, <em>in view.</em></h2><p>Read one programme and reporting period, with its target and coverage.</p></div><span className="ew-vintage">Retained {plan.retrievedAt.slice(0,10)}</span></header>
    <div className="ew-controls"><label>Programme<select aria-label="Works programme" value={plan.id} onChange={e=>{setProgramme(e.target.value);setPeriod(null);setDistrict('');}}>{distinct.map(p=><option value={p.id} key={p.id}>{p.label}</option>)}</select></label>{plan.periodicity==='monthly'&&<label className="ew-period">Reporting period<select value={month?.monthId??''} onChange={e=>{setPeriod(e.target.value);setDistrict('');}}>{plan.months.map(m=><option value={m.monthId} key={m.monthId}>{m.label} {m.year}{m.unreported?' · plan only':''}</option>)}</select></label>}</div>
    <div className="radar-view-switch" role="group" aria-label="Works visualization"><button aria-pressed={visual==='map'} onClick={()=>setVisual('map')}>District map</button><button aria-pressed={visual==='timeline'} onClick={()=>{setVisual('timeline');setDistrict('');}}>{plan.periodicity==='monthly'?'Monthly series':'Reported position'}</button></div>
    {visual==='timeline'&&<>
    <div className="ew-reading" aria-live="polite">
      <div className="ew-primary" role="group" aria-label="Selected programme position"><span>{month?`${month.label} ${month.year} ${month.unreported?'· plan only':'achievement'}`:'Reported achievement · no period supplied'}</span><strong>{number(achievement)}</strong><small>{plan.unit} · target {number(target)}</small><hr/><div className="ew-secondary"><b>{ratio===null?'No rate':`${(ratio*100).toFixed(1)}%`}</b><small>of target · districts with both measures</small></div></div>
      <div className="ew-chart-panel"><h3>{plan.label}</h3><p className="ew-caption">{plan.periodicity==='monthly'?'Reported achievement and forward targets · common scale':'One reported position per district'}</p>{plan.periodicity==='monthly'?<WorksTimeline months={plan.months} selected={month?.monthId} onSelect={setPeriod} unit={plan.unit}/>:<><div className="ew-state-bar" role="img" aria-label={`${number(achievement)} achieved against ${number(target)} targeted`}><i style={{width:`${Math.min(100,(ratio??0)*100)}%`}}/></div><p className="ew-caption">No reporting period is supplied. This is a reported position; a monthly trend cannot be inferred.</p></>}</div>
    </div>
    </>}
    <div className="ew-meta"><span>{month?`${month.reportedDistricts} of ${plan.expectedDistricts} districts report achievement`:`${plan.districts.length} district positions`}</span><span>{plan.excluded} raw rows held out</span>{plan.remaining.length>0&&<span>{plan.remaining.length} months carry targets only</span>}</div>
    {plan.periodicity==='monthly'&&<p className="ew-caption vi-reading-note">Monthly or cumulative basis is unconfirmed. Months are kept separate; future targets do not imply zero achievement.</p>}
    {plan.transposedIdentity&&<div className="ew-notice">The source&rsquo;s original district name and ID fields are transposed. The table uses the supplied LGD district name.</div>}
    {visual==='map'&&<section className="vi-geography-section"><div className="ew-controls"><label>Map measure<select aria-label="Works map measure" value={mapMeasure} onChange={e=>setMapMeasure(e.target.value)}><option value="rate">Achievement against target</option><option value="gap">Reported target balance</option></select></label></div><div className="vi-map-review"><div className="ew-primary" role="group" aria-label="Selected programme position"><span>{month?`${month.label} ${month.year}`:'Reported position'}</span><strong>{mapRate===null?'No rate':`${(mapRate*100).toFixed(1)}%`}</strong><p>achievement against target</p><small>{number(mapAchievement)} achieved / {number(mapTarget)} target · {plan.unit}</small><hr/><p>{district||'All returned districts'}</p><small>Figures use districts with both target and achievement in this selection.</small></div><DistrictMap rows={plan.districts.map(d=>({district:d.district,value:d.targetMissing||d.achievementMissing?null:mapMeasure==='gap'?Math.max(0,d.target-d.achievement):d.target>0?d.achievement/d.target*100:null,detail:`${d.achievementMissing?'Not reported':number(d.achievement)} achieved / ${d.targetMissing?'not reported':number(d.target)} target ${plan.unit} · ${month?`${month.label} ${month.year}`:'Reporting period not supplied'}`}))} selected={district} onSelect={setDistrict} title={mapMeasure==='gap'?'Reported balance by district':'Delivery by district'} unit={mapMeasure==='gap'?plan.unit:'%'} maximum={mapMeasure==='rate'?100:undefined}/></div></section>}
    <details className="vi-disclosure"><summary>Inspect {rows.length} district positions</summary><section className="ew-table-section"><header><div><h3>{plan.label} by district</h3><p className="ew-caption">{month?`${month.label} ${month.year}`:'No reporting period supplied'} · {plan.unit}</p></div><label className="ew-caption">Order<select aria-label="Order programme districts" value={sort} onChange={e=>setSort(e.target.value)}><option value="district">District name</option><option value="gap">Largest reported target gap</option><option value="achievement">Reported achievement</option></select></label></header><div className="ew-table-scroll"><table><thead><tr><th scope="col">District</th><th scope="col">Target</th><th scope="col">Achievement</th><th scope="col">Of target</th></tr></thead><tbody>{rows.map(d=><tr key={d.district}><th scope="row">{d.district}</th><td>{d.targetMissing?<em>Not reported</em>:number(d.target)}</td><td>{d.achievementMissing?<em>Not reported</em>:number(d.achievement)}</td><td>{d.targetMissing||d.achievementMissing||d.target===0?<em>No rate</em>:`${(d.achievement/d.target*100).toFixed(1)}%`}</td></tr>)}</tbody></table></div></section></details>
    <div className="ew-evidence"><details><summary>Source &amp; reading boundary</summary><div><p><code>{plan.tableKey}</code> · {plan.rows} raw rows · {plan.expectedDistricts} observed districts.</p><p>{plan.boundary}</p></div></details>{duplicates.length>0&&<details><summary>{duplicates.length} duplicate programme route excluded</summary><div>{duplicates.map(p=><p key={p.id}><code>{p.tableKey}</code> returns the same programme records as <code>{p.duplicateOf}</code>. Reported work: {p.reportedWorkName}.</p>)}</div></details>}{plan.remaining.length>0&&<details><summary>Future targets · {plan.remaining.length} unreported months</summary><div>{plan.remaining.map(m=><p key={m.monthId}>{m.label} {m.year}: target {number(m.target)} {plan.unit}; achievement not reported.</p>)}</div></details>}</div>
  </section>;
}
