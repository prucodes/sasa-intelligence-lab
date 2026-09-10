'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import { getReportingContinuity } from '@/lib/reporting-continuity';
import './analysis-workspace.css';
import './visual-intelligence.css';

const number = (value: number) => value.toLocaleString('en-IN');
const percent = (value: number | null) => value === null ? 'Not available' : `${(value * 100).toFixed(1)}%`;

export function ReportingContinuity() {
  const data = useMemo(() => getReportingContinuity(), []);
  const [key, setKey] = useState('msw_door_to_door_collection_api');
  const [date, setDate] = useState<string | null>(null);
  const dataset = data.datasets.find(d => d.tableKey === key) ?? data.datasets[0];
  if (!dataset) return null;
  const day = dataset.days.find(d => d.date === date) ?? dataset.days.find(d => d.date === dataset.busiestDate) ?? dataset.days[0];
  const positive = dataset.days.reduce((s,d) => s+d.positive,0);
  const zero = dataset.days.reduce((s,d) => s+d.zero,0);
  const missing = dataset.days.reduce((s,d) => s+d.missing,0);
  return <section className="evidence-workspace" aria-labelledby="continuity-title">
    <header className="ew-heading"><div><span className="ew-kicker">Daily evidence · secretariat grain</span><h2 id="continuity-title">Activity and <em>reporting coverage</em></h2><p>Separate positive activity, reported zero and missing observations.</p></div><span className="ew-vintage">Retained {dataset.retrievedAt.slice(0,10)}</span></header>
    <div className="ew-controls"><label>Dataset<select value={dataset.tableKey} onChange={e=>{setKey(e.target.value);setDate(null);}}>{data.datasets.map(d=><option value={d.tableKey} key={d.tableKey}>{d.label}</option>)}</select></label></div>
    <div className="ew-reading">
      <div className="ew-primary"><span>{day.date} · positive activity</span><strong>{number(day.positive)}</strong><small>of {number(day.rows)} unique secretariat records</small><hr/><div className="ew-secondary"><b>{percent(day.positiveRatio)}</b><small>of records for this day</small></div></div>
      <div className="ew-chart-panel"><h3>Choose a reported day</h3><p className="ew-caption">Positive activity as a share of that day&rsquo;s retained records</p><div className="ew-day-grid reporting-heatmap">{dataset.days.map(d=><button type="button" className="ew-day" key={d.date} style={{'--day-intensity':`${12+(d.positiveRatio??0)*68}%`} as CSSProperties} data-missing={d.positiveRatio===null} aria-label={`${d.date}: ${percent(d.positiveRatio)} positive activity`} aria-pressed={d.date===day.date} onClick={()=>setDate(d.date)}><span>{d.date.slice(5)}</span><b>{percent(d.positiveRatio)}</b></button>)}</div><div className="map-scale reporting-scale"><span>0% positive</span><i/><span>100%</span></div><p className="ew-caption">Colour intensity shows the share reporting positive activity. Select a day to see reported zeros and missing measures separately.</p><div aria-live="polite"><div className="ew-state-bar" role="img" aria-label={`${day.positive} positive, ${day.zero} zero, ${day.missing} missing measurements`}><i style={{width:`${day.rows?day.positive/day.rows*100:0}%`}}/><i data-state="zero" style={{width:`${day.rows?day.zero/day.rows*100:0}%`}}/><i data-state="missing" style={{width:`${day.rows?day.missing/day.rows*100:0}%`}}/></div><div className="ew-state-key"><span><b>{number(day.positive)}</b> positive</span><span><b>{number(day.zero)}</b> reported zero</span><span><b>{number(day.missing)}</b> missing measure</span></div></div></div>
    </div>
    <div className="ew-meta"><span>{number(dataset.rows)} unique records</span><span>{number(dataset.quality.duplicateRows)} exact repeats collapsed</span><span>{number(dataset.quality.conflictingKeys)} conflicting keys held out</span></div>
    {dataset.busiestDateShare!==null && dataset.busiestDateShare>=.5 && <div className="ew-notice"><b>{percent(dataset.busiestDateShare)} of reported {dataset.measureLabel}</b> is concentrated on {dataset.busiestDate}. Review the reporting pattern before treating this short window as typical service activity.</div>}
    <div className="ew-table-section"><header><h3>Coverage across the retained window</h3><span className="ew-caption">{dataset.days[0].date} – {dataset.days.at(-1)?.date}</span></header><div className="ew-table-scroll"><table><thead><tr><th>Observation</th><th>Count</th></tr></thead><tbody><tr><th>Records with positive activity</th><td>{number(positive)}</td></tr><tr><th>Records with a valid zero</th><td>{number(zero)}</td></tr><tr><th>Records missing the measure</th><td>{number(missing)}</td></tr><tr><th>Entities with a valid measure on every observed date</th><td>{number(dataset.entitiesReportingEveryDay)} / {number(dataset.entities)}</td></tr><tr><th>Entity/date combinations absent from this export</th><td>{number(dataset.missingExpectedRecords)}</td></tr></tbody></table></div></div>
    <div className="ew-evidence"><details><summary>Source, duplicate handling &amp; coverage basis</summary><div><p><code>{dataset.tableKey}</code> · {number(dataset.rawRows)} raw rows → {number(dataset.rows)} unique records. A valid zero remains a reported observation. Missing combinations use the entities and dates observed in this export, not a certified roster.</p><p>{data.boundary}</p></div></details></div>
  </section>;
}
