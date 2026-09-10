'use client';
import {useState} from 'react';
import {getProgrammeGeography,geographicProgrammes} from '@/lib/programme-geography';
import {DistrictMap} from './district-map';
import './analysis-workspace.css';
import './visual-intelligence.css';

export function ProgrammeExplorer(){
  const [programme,setProgramme]=useState('green-spaces');
  const [period,setPeriod]=useState<string>();
  const [district,setDistrict]=useState('');
  const data=getProgrammeGeography(programme,period);
  const scope=data.rows.filter(row=>!district||row.district===district);
  const paired=scope.filter(row=>row.target!==null&&row.achievement!==null);
  const target=paired.reduce((sum,row)=>sum+row.target!,0),achievement=paired.reduce((sum,row)=>sum+row.achievement!,0);
  const ratio=paired.length&&target>0?achievement/target:null;
  return <section className="evidence-workspace programme-explorer" aria-labelledby="programme-map-title"><header className="ew-heading"><div><span className="ew-kicker">Community, green & water · one programme at a time</span><h2 id="programme-map-title">From programme totals<br/><em>to the places behind them.</em></h2><p>Each measure keeps its source population and period. No cross-programme score is calculated.</p></div></header>
    <div className="ew-controls"><label>Programme<select aria-label="Geographic programme" value={programme} onChange={event=>{setProgramme(event.target.value);setPeriod(undefined);setDistrict('');}}>{geographicProgrammes.map(spec=><option key={spec.id} value={spec.id}>{spec.label}</option>)}</select></label>{data.periods.length>0&&<label>Source period<select aria-label="Programme map period" value={data.selectedPeriod??''} onChange={event=>{setPeriod(event.target.value);setDistrict('');}}>{data.periods.map(value=><option key={value}>{value}</option>)}</select></label>}</div>
    <div className="vi-map-review"><div className="vi-map-finding" role="group" aria-label="Selected geographic programme"><span>{data.selectedPeriod??'Reporting period not supplied'} · {data.spec.grain} source</span><h3>{district||'All returned districts'}</h3><strong>{ratio===null?'No rate':`${(ratio*100).toFixed(1)}%`}</strong><p>achievement against target</p><dl><div><dt>Paired achievement</dt><dd>{paired.length?achievement.toLocaleString('en-IN',{maximumFractionDigits:2}):'Not available'}</dd></div><div><dt>Paired target</dt><dd>{paired.length?target.toLocaleString('en-IN',{maximumFractionDigits:2}):'Not available'}</dd></div><div><dt>Unit</dt><dd>{data.spec.unit}</dd></div><div><dt>Eligible source-name candidates</dt><dd>{paired.length} / {scope.length}</dd></div></dl><p className="vi-note">Zero targets do not produce a rate. Only candidates with both measurements enter the ratio.</p></div><DistrictMap rows={data.mapRows} selected={district} onSelect={setDistrict} title={data.spec.label} unit="%" maximum={100}/></div>
    <details className="vi-disclosure"><summary>Inspect {scope.length} source records in this selection</summary><div className="ew-table-scroll"><table><thead><tr><th>Source name</th><th>District</th><th>Target</th><th>Achievement</th></tr></thead><tbody>{scope.map(row=><tr key={row.key}><th scope="row">{row.entity}</th><td>{row.district}</td><td>{row.target?.toLocaleString('en-IN')??'Not reported'}</td><td>{row.achievement?.toLocaleString('en-IN')??'Not reported'}</td></tr>)}</tbody></table></div></details>
    <details className="vi-disclosure"><summary>Source and eligibility</summary><p>{data.spec.label} · source response generated {data.retainedAt}. {data.quality.duplicateRows} repeated measure pairs collapsed and {data.quality.conflictingRows+data.quality.missingKeyRows} rows held out in the selected period. Map ratios sum paired quantities within one district; they never average ULB percentages. Source-name matches are candidates, not an approved cross-source identity.</p></details>
  </section>;
}
