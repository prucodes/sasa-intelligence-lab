'use client';
import {useState,useEffect} from 'react';
import {getUlbComparison,deliveryPosition} from '@/lib/ulb-comparison';
import {comparisonDiagnosticKey} from '@/lib/ulb-diagnostics-link';
import type {ReviewIssueId} from '@/lib/overview';
import './ulb-review.css';
import {ChartGuide,periodPhrase} from './chart-guide';
import {rateText} from '@/lib/format-rate';

const n=(v:number)=>v.toLocaleString('en-IN',{maximumFractionDigits:1});
/** What right and up mean in plain words, for the programme on screen. */
const readingWords={
  sanitation:{right:'More toilets approved, so a bigger job.',up:'A bigger share of approved toilets completed.'},
  collection:{right:'More vehicles on work orders, so a bigger job.',up:'A bigger share of those vehicles supplied.'},
  processing:{right:'More tonnes of legacy waste to clear, so a bigger job.',up:'A bigger share of the target tonnes cleared.'},
};
export function UlbRadar(){
  const [subject,setSubject]=useState<ReviewIssueId>('sanitation');
  const [selected,setSelected]=useState('');
  const [district,setDistrict]=useState('');
  const [comparison,setComparison]=useState('');
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search),requested=params.get('programme');
    const id:ReviewIssueId=requested&&['sanitation','collection','processing'].includes(requested)?requested as ReviewIssueId:'sanitation';
    const candidate=params.get('ulb');
    /* eslint-disable react-hooks/set-state-in-effect */
    setSubject(id);
    if(candidate&&getUlbComparison(id).points.some(point=>point.key===candidate))setSelected(candidate);
    /* eslint-enable react-hooks/set-state-in-effect */
  },[]);
  const data=getUlbComparison(subject);
  const rows=data.points.filter(row=>!district||row.district===district);
  const chosen=data.points.find(row=>row.key===selected);
  const other=data.points.find(row=>row.key===comparison);
  const maximum=Math.max(1,...data.points.map(row=>row.basis));
  const ceiling=Math.ceil(maximum/10**Math.floor(Math.log10(maximum)))*10**Math.floor(Math.log10(maximum));
  const x=(v:number)=>70+v/ceiling*610,y=(rate:number)=>430-rate*3.6;
  const groups=data.coordinates.map(group=>({...group,points:group.points.filter(row=>!district||row.district===district)})).filter(group=>group.points.length).sort((a,b)=>Number(a.points.some(p=>p.key===selected))-Number(b.points.some(p=>p.key===selected)));
  const allNames=[...data.points].sort((a,b)=>a.ulb.localeCompare(b.ulb));
  const districts=[...new Set(data.points.map(row=>row.district))].sort();
  const href=(row:typeof data.points[number])=>{const key=comparisonDiagnosticKey(row.key,subject,data.period);return key?`/diagnostics/${key}?mode=governed&programme=${subject}`:null;};
  return <section className="ulb-radar" aria-label="ULB delivery comparison">
    <header className="ur-intro"><div><span className="ur-kicker">ULB comparison · {data.period}</span><h2>Which places are further along?</h2><p>Compare reported completion and the size of the delivery workload, within one programme.</p></div><span className="ur-badge">{data.points.length} comparable ULB candidates</span></header>
    <div className="ur-controls"><label>Programme<select aria-label="ULB comparison programme" value={subject} onChange={e=>{setSubject(e.target.value as ReviewIssueId);setSelected('');setComparison('');setDistrict('');}}><option value="sanitation">Household toilets</option><option value="collection">Vehicle delivery</option><option value="processing">Legacy waste clearance</option></select></label><label>District<select aria-label="ULB comparison district" value={district} onChange={e=>{setDistrict(e.target.value);setSelected('');setComparison('');}}><option value="">All returned districts</option>{districts.map(d=><option key={d}>{d}</option>)}</select></label><label>Find a ULB<select aria-label="Select comparison ULB" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a ULB</option>{allNames.filter(row=>!district||row.district===district).map(row=><option key={row.key} value={row.key}>{row.ulb} · {row.district}</option>)}</select></label></div>
    <ChartGuide intro={`Each dot is one ULB ${periodPhrase(data.period)}.`} items={[{term:'Further right',text:(readingWords[subject as keyof typeof readingWords]??{right:`More ${data.basisLabel.toLowerCase()}, so a bigger job.`}).right},{term:'Higher up',text:(readingWords[subject as keyof typeof readingWords]??{up:`A bigger share of ${data.basisLabel.toLowerCase()} completed.`}).up},{term:'Lines',text:`Vertical: the middle ULB's workload (${n(data.median??0)}). Horizontal: half completed. Reading guides, not targets.`},{term:'Right is not worse',text:'A bigger workload is not a worse result. Compare dots at a similar width.'}]}/>
    <div className="ur-stage"><div className="ur-chart"><svg viewBox="0 0 740 510" role="group" aria-label="ULB workload versus reported completion">
      <rect x="70" y="70" width="610" height="180" className="ur-zone-upper"/><rect x="70" y="250" width="610" height="180" className="ur-zone-lower"/>
      {[0,.25,.5,.75,1].map(t=><g key={t}><line x1="70" x2="680" y1={y(t*100)} y2={y(t*100)} className="ur-grid"/><text x="58" y={y(t*100)+4} textAnchor="end" className="ur-tick">{t*100}%</text><text x={x(ceiling*t)} y="454" textAnchor="middle" className="ur-tick">{n(ceiling*t)}</text></g>)}
      <line x1="70" x2="680" y1="250" y2="250" className="ur-reference"/>{data.median!==null&&<line x1={x(data.median)} x2={x(data.median)} y1="70" y2="430" className="ur-reference"/>}
      <text x="78" y="24" className="ur-quadrant">Smaller workload</text><text x="674" y="24" textAnchor="end" className="ur-quadrant">Larger workload</text><text x="674" y="51" textAnchor="end" className="ur-zone-label">Upper half: at least half completed</text><text x="674" y="274" textAnchor="end" className="ur-zone-label">Lower half: more than half still to deliver</text>
      <text x="375" y="494" textAnchor="middle" className="ur-axis">Reported workload · {data.basisLabel}</text><text transform="translate(17 250) rotate(-90)" textAnchor="middle" className="ur-axis">{data.completedLabel} / {data.basisLabel} (%)</text>
      {groups.map((group,index)=>{const active=group.points.some(p=>p.key===selected),paired=group.points.some(p=>p.key===comparison);return <g key={index} tabIndex={0} role="button" aria-label={`${group.points.map(p=>p.ulb).join(', ')}: ${rateText(group.rate)}% complete, ${n(group.basis)} ${data.basisLabel}${group.points.length>1?`, ${group.points.length} overlapping ULBs`:''}`} aria-pressed={active} className={`ur-dot ${active?'is-selected':''} ${paired?'is-compared':''}`} onClick={()=>setSelected(group.points[0].key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(group.points[0].key);}}}><circle cx={x(group.basis)} cy={y(group.rate)} r="15" fill="transparent"/><circle cx={x(group.basis)} cy={y(group.rate)} r={active||paired?9:group.points.length>1?7:5} className={group.rate>=50?'ur-dot-high':'ur-dot-low'}/>{group.points.length>1&&<text x={x(group.basis)} y={y(group.rate)+3} textAnchor="middle" className="ur-cluster-count">{group.points.length}</text>}{active&&chosen&&<text x={x(group.basis)+(group.basis>ceiling*.75?-12:12)} y={y(group.rate)-16} textAnchor={group.basis>ceiling*.75?'end':'start'} className="ur-selected-label">{chosen.ulb}</text>}<title>{group.points.map(p=>p.ulb).join(', ')}</title></g>;})}
    </svg><p className="ur-chart-note">Vertical line: cohort median workload ({n(data.median??0)}). Horizontal line: 50% completed, a reading guide, not an official performance threshold. Numbered dots contain overlapping ULBs; use the selector to inspect every member. References stay fixed when filtering a district.</p></div>
    <aside className="ur-reading" aria-live="polite"><span className="ur-kicker">{chosen?'Selected ULB':'Read the comparison'}</span><h3>{chosen?.ulb??`${rows.length} ULBs in view`}</h3>{chosen?<><p>{chosen.district} · {data.period}</p><strong className="ur-rate">{rateText(chosen.rate)}%</strong><b className="ur-position">{deliveryPosition(chosen)}</b><dl><div><dt>{data.basisLabel}</dt><dd>{n(chosen.basis)}</dd></div><div><dt>{data.completedLabel}</dt><dd>{n(chosen.completed)}</dd></div><div><dt>Reported remaining</dt><dd>{n(chosen.value)}</dd></div></dl>{href(chosen)?<a href={href(chosen)!}>Open ULB Diagnostics ↗</a>:<p>No uniquely matched Diagnostics file. The source figures above remain available.</p>}<label>Compare with<select aria-label="Compare another ULB" value={comparison} onChange={e=>setComparison(e.target.value)}><option value="">Choose a peer</option>{allNames.filter(p=>p.key!==chosen.key).map(p=><option key={p.key} value={p.key}>{p.ulb} · {p.district}</option>)}</select></label>{other&&<div className="ur-peer"><b>{other.ulb}</b><strong>{rateText(other.rate)}%</strong><p>{n(other.completed)} / {n(other.basis)} {data.basisLabel}</p><p>{n(chosen.rate-other.rate)} percentage-point difference · different workloads</p>{href(other)&&<a href={href(other)!}>Inspect peer ↗</a>}</div>}</>:<><p>Select a ULB to read its delivery position and compare it with a named peer.</p><dl><div><dt>Reported complete</dt><dd>{rows.filter(p=>p.rate===100).length}</dd></div><div><dt>Partly delivered</dt><dd>{rows.filter(p=>p.rate>0&&p.rate<100).length}</dd></div><div><dt>No completion reported</dt><dd>{rows.filter(p=>p.rate===0).length}</dd></div></dl></>}<p className="ur-boundary">{data.boundary} This is programme delivery progress, not an overall ULB performance rating.</p></aside></div>
    <details className="ur-evidence"><summary>Evidence coverage · {data.unplotted.length} candidates without a plotted rate · {data.excluded} candidates/rows held out upstream</summary><p>{data.source} · {data.period}. One source, one period. Duplicate measure pairs count once; conflicting or missing required measurements are held out. Denominators are never substituted between programmes.</p>{data.unplotted.map(row=><p key={row.key}><b>{row.ulb}</b> · {row.district} · {row.reason}. {n(row.completed)} / {n(row.basis)}.</p>)}</details>
  </section>;
}
