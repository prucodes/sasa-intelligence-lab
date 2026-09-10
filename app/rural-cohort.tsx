'use client';

import { useMemo, useState } from 'react';
import { getRuralCohort } from '@/lib/rural-cohort';
import './analysis-workspace.css';
import './rural-cohort.css';

const format = (value: number) => value.toLocaleString('en-IN');
const percent = (value: number | null) => value === null ? 'Not reported' : `${(value * 100).toFixed(2)}%`;

export function RuralCohort() {
  const data = useMemo(() => getRuralCohort(), []);
  const [scope, setScope] = useState('presence');
  const groups = data.groups.filter(group => group.panchayats > 0);
  const quality = data.recordQuality;
  const dates = data.usableDays;
  const period = `${dates[0]} to ${dates.at(-1)}`;
  return <section id="rural-evidence" className="evidence-workspace rural-reference" aria-labelledby="rc-title">
    <header className="ew-heading">
      <div><span className="ew-kicker">Rural collection · descriptive comparison</span>
        <h2 id="rc-title">Similar collection rates.<br/><em>The cause remains open.</em></h2>
        <p>{period} · {format(data.identity.matched)} registered gram panchayats · {dates.length} observed days included</p>
      </div><span className="rc-status">Source completeness unproven</span>
    </header>
    <div className="rc-evidence-flow" aria-label="Record quality">
      <div><span>Raw rows</span><strong>{format(quality.rawRows)}</strong></div>
      <div><span>Exact repeats collapsed</span><strong>{format(quality.duplicateRows)}</strong></div>
      <div className="rc-distinct"><span>Distinct GP-days retained</span><strong>{format(quality.uniqueRows)}</strong></div>
      <div><span>Rows held out</span><strong>{format(data.heldOutRows)}</strong><small>{format(quality.conflictingKeys)} conflicting keys</small></div>
    </div>
    <div className="rc-coverage">
      <div><strong>{percent(quality.uniqueRows / quality.gridCeiling)}</strong><span>of the observed GP × day grid</span></div>
      <div><div className="ew-track" aria-hidden="true"><i style={{width:`${quality.uniqueRows / quality.gridCeiling * 100}%`}}/></div><p>{format(data.observedGridGap)} combinations unobserved out of {format(quality.gridCeiling)}. This grid uses all GPs seen in the activity export; it is not a certified source roster.</p></div>
    </div>
    <div className="ew-reading">
      <div className="ew-primary"><span>With centre vs without centre</span><strong>{data.spreadPoints?.toFixed(2) ?? '—'} <small>pp</small></strong><small>Absolute difference in observed collection rates</small><hr/><p className="rc-hero-note">A small descriptive difference does not establish equivalence, predictive value or a programme effect.</p></div>
      <div className="ew-chart-panel">
        <h3>Collection reported on GP-days</h3><p className="ew-caption">Yes ÷ valid Yes/No responses · full 0–100% scale</p>
        <ul className="rc-comparison">{groups.map(group => <li key={group.id}>
          <div><span>{group.label}</span><strong>{percent(group.collectionRate)}</strong></div>
          <div className="ew-track" aria-hidden="true"><i style={{width:`${(group.collectionRate ?? 0) * 100}%`}}/></div>
          <small>{format(group.collectedDays)} Yes / {format(group.validCollectionDays)} valid GP-days · {format(group.panchayats)} GPs</small>
        </li>)}</ul>
      </div>
    </div>
    <p className="ew-notice"><b>August evidence stops at 7 August.</b> All seven returned days are included. Low activity on 2 August is an anomaly to investigate; an outage has not been established. The retained response does not establish that later August dates are absent from the underlying source.</p>
    <section className="ew-table-section" aria-labelledby="rc-detail-title">
      <header><h3 id="rc-detail-title">Inspect the comparison</h3><label className="rc-selector">Breakdown<select value={scope} onChange={event=>setScope(event.target.value)}><option value="presence">Facility presence</option><option value="condition">Condition of present centres</option></select></label></header>
      <div className="ew-table-scroll"><table><thead><tr><th scope="col">{scope === 'presence' ? 'Register statement' : 'Working condition'}</th><th scope="col">GPs</th><th scope="col">Valid collection days</th><th scope="col">Missing responses</th><th scope="col">Collection rate</th><th scope="col">Segregated households / valid GP-day</th></tr></thead>
        <tbody>{(scope === 'presence' ? groups : data.byCondition).map((group,index)=><tr key={index}><th scope="row">{'label' in group ? group.label : group.condition || 'Not stated'}</th><td>{format(group.panchayats)}</td><td>{format(group.validCollectionDays)}</td><td>{format(group.missingActivityDays)}</td><td>{percent(group.collectionRate)}</td><td>{group.segregatedPerPanchayatDay?.toFixed(1) ?? 'Not reported'}</td></tr>)}</tbody></table></div>
      <p className="ew-caption">Working condition is evaluated only where the register says a centre is present. Blank measurements are excluded from their measure’s denominator; a reported zero remains valid.</p>
    </section>
    <div className="ew-evidence">
      <details><summary>Daily activity and measurement coverage</summary><div className="ew-table-scroll"><table><thead><tr><th scope="col">Observed date</th><th scope="col">Distinct GP-days</th><th scope="col">Collection reported Yes</th></tr></thead><tbody>{data.days.map(day=><tr key={day.date}><th scope="row">{day.date}</th><td>{format(day.rows)}</td><td>{format(day.collectedRows)}</td></tr>)}</tbody></table><p>These daily counts cover the whole activity export. The comparison above includes only GPs matched to the register. In that comparison, {format(groups.reduce((sum,g)=>sum+g.validSegregationDays,0))} GP-days carry a valid segregation count.</p></div></details>
      <details><summary>May → August: available in the trend view</summary><div><p>The monthly trend view compares 85,769 common GP-day observations across days 1–7 in May, June, July and August. This centre comparison remains an August cross-section against an undated facility register.</p><p>Four reported first-week points support descriptive trajectories. They do not establish full-month performance or a processing-centre effect; weekday and holiday differences remain uncontrolled.</p></div></details>
      <details><summary>Source, identity and completeness boundary</summary><div><p>{data.boundary}</p><p>Register effective date: {data.registerCurrency}. {format(data.identity.matched)} registered GPs matched by <code>{data.identity.key}</code>; {format(data.identity.activityOnlyPanchayats)} activity GPs have no register match.</p><p>Raw row counts reconcile to response totals. A repeated-offset check at 5,000 returned identical rows and ordering across three requests. This supports stability at the tested offset. The observed grid has missing GP-day combinations; their absence is not treated as zero activity or an outage.</p>{Object.entries(data.generatedFrom).map(([key,source])=><p key={key}><code>{key}</code><br/>Retained {source.generatedAt} · {format(source.rows)} rows</p>)}</div></details>
    </div>
  </section>;
}
