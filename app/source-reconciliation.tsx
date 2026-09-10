'use client';

import { useEffect, useMemo, useState } from 'react';
import { getIhhlReconciliation, sumReturned, type Reconciliation } from '@/lib/source-reconciliation';
import {SourceRevisions} from './source-revisions';
import './source-reconciliation.css';
import './evidence-expansion.css';

const format = (value: number | null) => value === null ? 'Not returned' : value.toLocaleString('en-IN');
const Arrow = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;

/** Separate zero-based scales and labelled values keep each source readable. */
function ShapePlot({ data, active, month, onMonth }: { data: Reconciliation; active: 'left' | 'right'; month:string; onMonth:(period:string)=>void }) {
  return <figure className="sr-small-multiples"><figcaption><span>Achievement across matched districts</span><b>Separate source scales · exact values shown</b></figcaption>{(['left','right'] as const).map(side=>{
    const values=data.periods.map(period=>sumReturned(data.rows.filter(row=>row.periodKey===period.key).map(row=>row[side].achievement)));
    const maximum=Math.max(...values.filter((value):value is number=>value!==null),1);
    return <div key={side} className={active===side?'is-active':''}><header><b>{data[side].spec.department}</b><small>Scale: 0–{format(maximum)}</small></header>{data.periods.map((period,index)=><button type="button" className="sr-source-bar" key={period.key} aria-label={`Inspect ${period.label} · ${data[side].spec.department}: ${format(values[index])} achieved`} aria-pressed={month===period.key} onClick={()=>onMonth(period.key)}><span>{period.label}</span><i aria-hidden="true"><em style={{width:`${(values[index]??0)/maximum*100}%`}}/></i><strong>{format(values[index])}</strong></button>)}</div>;
  })}</figure>;
}

/**
 * Mode isolation, matching the executive brief: governed findings must never appear in
 * Demo or Live. Neither mode has two sources sharing an identity frame, so neither can
 * show this analysis — and saying so is more useful than a synthetic stand-in.
 */
export function SourceReconciliationScreen({ mode, href }: { mode: 'DEMO' | 'SAMPLE' | 'LIVE'; href: (path: string) => string }) {
  if (mode === 'SAMPLE') return <ReconciliationWorkspace href={href}/>;
  return <div className="source-reconciliation sr-unavailable">
    <span className="sr-kicker">SASA Intelligence Lab / Cross-source</span>
    <h1>Reconciliation needs governed evidence.</h1>
    <p>
      {mode === 'DEMO'
        ? 'Demo mode uses synthetic fixtures. Two fabricated sources would agree or disagree exactly as designed, which would demonstrate nothing.'
        : 'Live mode carries no runtime Data Lake connection. This analysis reads two retained, authenticated exports.'}
      {' '}Switch to Governed data to compare the Housing and Swachh Bharat Mission returns for household latrine construction.
    </p>
  </div>;
}

function ReconciliationWorkspace({href}:{href:(path:string)=>string}) {
  const [view,setView]=useState('ihhl');
  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if(new URLSearchParams(window.location.search).get('view')==='revisions')setView('revisions');
  },[]);
  return <><div className="evidence-tabs" role="group" aria-label="Source reconciliation views"><button aria-pressed={view==='ihhl'} onClick={()=>setView('ihhl')}>Housing & SBM · paired returns</button><button aria-pressed={view==='revisions'} onClick={()=>setView('revisions')}>Current source revisions · 9 routes</button></div>{view==='ihhl'?<SourceReconciliation href={href}/>:<SourceRevisions/>}</>;
}

export function SourceReconciliation({ href = (path: string) => path }: { href?: (path: string) => string }) {
  const data = useMemo(() => getIhhlReconciliation(), []);
  const [month, setMonth] = useState(() => data.periods.at(-1)?.key ?? '');
  const [active, setActive] = useState<'left' | 'right'>('left');
  const monthLabel = data.periods.find(period=>period.key===month)?.label ?? month;
  const [query,setQuery]=useState('');
  const scope = data.rows.filter((row) => row.periodKey === month);
  const visibleRows=scope.filter(row=>row.district.toLowerCase().includes(query.trim().toLowerCase()));
  const sides = [{ key: 'left' as const, state: data.left }, { key: 'right' as const, state: data.right }];
  const activeState = data[active];

  return <div className="source-reconciliation">
    <header className="sr-intro">
      <div>
        <span className="sr-kicker">SASA Intelligence Lab / Cross-source</span>
        <h1>Two departments.<br/>One evidence workspace.</h1>
      </div>
      <a className="sr-edition" href={href('/data-readiness')}>
        <span>GOVERNED EVIDENCE</span><b>Retained 8 September 2026 <Arrow/></b>
      </a>
    </header>

    <section className="sr-workspace" aria-label="Cross-source reconciliation">
      <div className="sr-stage">
        <div className="sr-story">
          <div className="sr-story-top"><span>01 / RECONCILIATION TEST</span><span>{data.periods[0]?.label} – {data.periods.at(-1)?.label}</span></div>
          <h2>Household latrine construction</h2>
          <div className="sr-hero-value">{data.targetsCoincide}</div>
          <p className="sr-hero-unit">district-months where the two sources report the same target</p>
          <div className="sr-hero-scope"><i/>{data.matched} district-month pairs joined · {data.districts} districts · {data.monthLabels.length} months</div>
          <div className="sr-hero-insight">
            <span>THE READING</span>
            <p>A complete join establishes <b>shared identity,</b> not <b>shared meaning.</b></p>
            <small>{data.refusal}</small>
          </div>
        </div>
        <ShapePlot data={data} active={active} month={month} onMonth={setMonth}/>
      </div>

      <div className="sr-sources" role="group" aria-label="Choose a source to emphasise">
        <p id="sr-source-basis" className="sr-selector-basis">
          Each source on its own terms <span>All matched districts · {monthLabel} · sources kept separate</span>
        </p>
        {sides.map(({ key, state }, index) => <button key={key} type="button" aria-pressed={active === key}
          className={active === key ? 'is-selected' : ''}
          aria-label={`Emphasise ${state.spec.department}: ${state.spec.label}`}
          onClick={() => setActive(key)}>
          <span className="sr-source-index">0{index + 1}</span>
          <span className="sr-source-copy">
            <b>{state.spec.department}</b>
            <small>{state.spec.label}</small>
          </span>
          <span className="sr-source-figures">
            <strong>{format(sumReturned(scope.map(row=>row[key].achievement)))}</strong>
            <small>achieved of {format(sumReturned(scope.map(row=>row[key].target)))} target</small>
          </span>
        </button>)}
      </div>

      <div className="sr-detail-layout">
        <aside className="sr-focus-context">
          <span className="sr-kicker">What the join establishes</span><h2>Shared places.<br/><em>Separate returns.</em></h2>
          <p>{data.matched} district-month pairs can be inspected side by side. The source definitions do not yet establish comparable scope or accounting basis.</p>
          <div className="sr-basis-facts">{sides.map(({key,state})=><div key={key} className={active===key?'is-active':''}><b>{state.nonDecreasingDistricts}<span> / {state.districtsWithSeries}</span></b><small>{state.spec.department} district series never decrease within their reported year</small></div>)}</div>
          <details className="sr-basis-note"><summary>Why the series cannot identify the accounting basis</summary><p>Monthly figures can rise every month. Cumulative figures can fall after revisions. These patterns describe the returns; they do not prove whether a column is monthly or cumulative.</p><p>Confirm programme scope, units and accounting definitions before calculating a cross-source difference.</p></details>
        </aside>

        <div className="sr-table-panel">
          <header className="sr-workspace-head">
            <div>
              <span className="sr-kicker">Side by side</span>
              <h2>Reported by district<span>{monthLabel} · {visibleRows.length} of {scope.length} districts</span></h2>
            </div>
            <label>
              <span className="sr-sr-only">Reported month</span>
              <select value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Reported month">
                {data.periods.map(entry => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
              </select>
            </label>
          </header>
          <label className="sr-district-search"><span>Find a district</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="District name"/></label>
          <div className="sr-scroll">
            <table>
              <caption className="sr-sr-only">Housing and SBM reported IHHL construction by district for {monthLabel}. No value is combined across the two sources.</caption>
              <thead>
                <tr>
                  <th scope="col" rowSpan={2}>District</th>
                  <th scope="colgroup" colSpan={2} className={`sr-col-left ${active === 'left' ? 'is-active' : ''}`}>{data.left.spec.department}</th>
                  <th scope="colgroup" colSpan={2} className={`sr-col-right ${active === 'right' ? 'is-active' : ''}`}>{data.right.spec.department}</th>
                </tr>
                <tr>
                  <th scope="col" className={`sr-col-left ${active === 'left' ? 'is-active' : ''}`}>Target</th>
                  <th scope="col" className={`sr-col-left ${active === 'left' ? 'is-active' : ''}`}>Achieved</th>
                  <th scope="col" className={`sr-col-right ${active === 'right' ? 'is-active' : ''}`}>Target</th>
                  <th scope="col" className={`sr-col-right ${active === 'right' ? 'is-active' : ''}`}>Achieved</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length===0&&<tr><td colSpan={5}>No district matches this search.</td></tr>}
                {visibleRows.map((row) => <tr key={`${row.district}-${row.periodKey}`}>
                  <th scope="row">{row.district}</th>
                  <td className={`sr-col-left ${active === 'left' ? 'is-active' : ''}`}>{format(row.left.target)}</td>
                  <td className={`sr-col-left ${active === 'left' ? 'is-active' : ''}`}>{format(row.left.achievement)}</td>
                  <td className={`sr-col-right ${active === 'right' ? 'is-active' : ''}`}>{format(row.right.target)}</td>
                  <td className={`sr-col-right ${active === 'right' ? 'is-active' : ''}`}>{format(row.right.achievement)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <p className="sr-table-note">
            {data.leftOnly.length} left-only district labels · {data.rightOnly.length} right-only district labels. Targets coincide in {data.targetsCoincide} of {data.matched} district-months across every
            reported period. No row is totalled across the vertical divider.
          </p>
        </div>
      </div>

      <footer className="sr-source-line">
        <span><b>{activeState.period}</b> · {activeState.spec.label}</span>
        <span>
          {data.matched} district-months joined · {data.left.disputed + data.right.disputed} held out for
          conflicting measurements · {data.left.missing + data.right.missing} rows lack identity or period
        </span>
      </footer>
    </section>

    <details className="sr-method">
      <summary>Source &amp; reading boundary</summary>
      <div>
        <p>
          {data.left.spec.tableKey} · {data.right.spec.tableKey}. Joined on the LGD district name
          present on every row of both sources, plus the reported year and month. A district-month returning
          two different measurements within one source is held out entirely rather than resolved.
          Reported zeroes are retained; blanks are never read as zero.
        </p>
        <p>{data.boundary}</p>
      </div>
    </details>
  </div>;
}
