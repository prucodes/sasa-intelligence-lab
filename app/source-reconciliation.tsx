'use client';

import { useMemo, useState } from 'react';
import { getIhhlReconciliation, type Reconciliation } from '@/lib/source-reconciliation';
import './source-reconciliation.css';

const format = (value: number | null) => value === null ? 'Not returned' : value.toLocaleString('en-IN');
const Arrow = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;

/**
 * The divergence plot. Each line is scaled to its own maximum, because the two
 * programmes differ by an order of magnitude and the comparison being drawn is of
 * shape, not level. The axis is therefore deliberately unlabelled — putting numbers
 * on it would invite exactly the cross-source reading this screen refuses.
 */
function ShapePlot({ data, active }: { data: Reconciliation; active: 'left' | 'right' }) {
  const width = 430;
  const height = 232;
  const pad = { left: 26, right: 26, top: 26, bottom: 42 };
  const series = (['left', 'right'] as const).map((side) => {
    const byMonth = new Map<number, number>();
    for (const row of data.rows) {
      const value = row[side].achievement;
      if (value !== null) byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + value);
    }
    const values = data.months.map((month) => byMonth.get(month) ?? 0);
    const max = Math.max(...values, 1);
    return { side, values, max, spec: data[side].spec, basis: data[side].basis };
  });

  const x = (index: number) => pad.left + index * ((width - pad.left - pad.right) / Math.max(1, data.months.length - 1));
  const y = (value: number, max: number) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom);

  return <figure className="sr-shape">
    <figcaption>
      <span>Statewide reported achievement</span>
      <b>Each line scaled to its own maximum. Shapes are comparable; levels are not.</b>
    </figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Reported achievement across ${data.monthLabels.join(', ')}. ${series.map((entry) => `${entry.spec.department}: ${entry.values.join(', ')}`).join('. ')}`}>
      {data.months.map((month, index) => <line key={month} className="sr-grid" x1={x(index)} x2={x(index)} y1={pad.top - 6} y2={height - pad.bottom}/>)}
      <line className="sr-axis" x1={pad.left - 10} x2={width - pad.right + 10} y1={height - pad.bottom} y2={height - pad.bottom}/>
      {series.map((entry) => <g key={entry.side} className={`sr-line sr-line-${entry.side} ${active === entry.side ? 'is-active' : ''}`}>
        <polyline points={entry.values.map((value, index) => `${x(index)},${y(value, entry.max)}`).join(' ')} fill="none"/>
        {entry.values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value, entry.max)} r={active === entry.side ? 5 : 3.5}/>)}
      </g>)}
      {data.monthLabels.map((label, index) => <text key={label} className="sr-month" x={x(index)} y={height - pad.bottom + 22} textAnchor="middle">{label}</text>)}
    </svg>
    <ul className="sr-shape-key">
      {series.map((entry) => <li key={entry.side} className={`sr-key-${entry.side} ${active === entry.side ? 'is-active' : ''}`}>
        <i aria-hidden="true"/>{entry.spec.department}
        <b>{entry.basis === 'non-decreasing' ? 'never falls' : entry.basis === 'varies' ? 'rises and falls' : 'not determinable'}</b>
      </li>)}
    </ul>
  </figure>;
}

/**
 * Mode isolation, matching the executive brief: governed findings must never appear in
 * Demo or Live. Neither mode has two sources sharing an identity frame, so neither can
 * show this analysis — and saying so is more useful than a synthetic stand-in.
 */
export function SourceReconciliationScreen({ mode, href }: { mode: 'DEMO' | 'SAMPLE' | 'LIVE'; href: (path: string) => string }) {
  if (mode === 'SAMPLE') return <SourceReconciliation href={href}/>;
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

export function SourceReconciliation({ href = (path: string) => path }: { href?: (path: string) => string }) {
  const data = useMemo(() => getIhhlReconciliation(), []);
  const [month, setMonth] = useState(() => data.months[data.months.length - 1] ?? 0);
  const [active, setActive] = useState<'left' | 'right'>('left');
  const monthLabel = data.monthLabels[data.months.indexOf(month)] ?? String(month);
  const scope = data.rows.filter((row) => row.month === month);
  const sides = [{ key: 'left' as const, state: data.left }, { key: 'right' as const, state: data.right }];
  const activeState = data[active];

  return <div className="source-reconciliation">
    <header className="sr-intro">
      <div>
        <span className="sr-kicker">SASA Intelligence Lab / Cross-source</span>
        <h1>Two departments.<br/>One district list.</h1>
      </div>
      <a className="sr-edition" href={href('/data-readiness')}>
        <span>GOVERNED EVIDENCE</span><b>Retained 8 September 2026 <Arrow/></b>
      </a>
    </header>

    <section className="sr-workspace" aria-label="Cross-source reconciliation">
      <div className="sr-stage">
        <div className="sr-story">
          <div className="sr-story-top"><span>01 / RECONCILIATION TEST</span><span>{data.left.period}</span></div>
          <h2>Household latrine construction</h2>
          <div className="sr-hero-value">{data.targetsCoincide}</div>
          <p className="sr-hero-unit">district-months where the two sources report the same target</p>
          <div className="sr-hero-scope"><i/>{data.matched} of {data.matched} joined · {data.districts} districts · {data.monthLabels.length} months</div>
          <div className="sr-hero-insight">
            <span>THE REFUSAL</span>
            <p>A complete join establishes <b>shared identity,</b> not <b>shared meaning.</b></p>
            <small>{data.refusal}</small>
          </div>
        </div>
        <ShapePlot data={data} active={active}/>
      </div>

      <div className="sr-sources" role="group" aria-label="Choose a source to emphasise">
        <p id="sr-source-basis" className="sr-selector-basis">
          Each source on its own terms <span>Totals for {monthLabel} 2026 · never added across the two</span>
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
            <strong>{format(scope.reduce((sum, row) => sum + (row[key].achievement ?? 0), 0))}</strong>
            <small>achieved of {format(scope.reduce((sum, row) => sum + (row[key].target ?? 0), 0))} target</small>
          </span>
        </button>)}
      </div>

      <div className="sr-detail-layout">
        <aside className="sr-focus-context">
          <span className="sr-kicker">Why they cannot be compared</span>
          <h2>The same word,<br/><em>a different measure.</em></h2>
          <p>
            One column never decreases across the three months; the other decreases in most
            districts. A running year-to-date total cannot fall, and a per-month figure usually
            does — but a rising monthly series is also possible, so neither column is labelled here.
          </p>
          <div className="sr-basis-facts">
            {sides.map(({ key, state }) => <div key={key} className={active === key ? 'is-active' : ''}>
              <b>{state.nonDecreasingDistricts}<span> / {state.districtsWithSeries}</span></b>
              <small>{state.spec.department} districts never report a lower figure than the month before</small>
            </div>)}
          </div>
          <p className="sr-established">
            What is established is narrower and firmer: <b>the two columns do not behave the same
            way</b>, so a difference between them would not be a measurement of anything.
          </p>
        </aside>

        <div className="sr-table-panel">
          <header className="sr-workspace-head">
            <div>
              <span className="sr-kicker">Side by side</span>
              <h2>Reported by district<span>{monthLabel} 2026 · {scope.length} districts</span></h2>
            </div>
            <label>
              <span className="sr-sr-only">Reported month</span>
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))} aria-label="Reported month">
                {data.months.map((entry, index) => <option key={entry} value={entry}>{data.monthLabels[index]} 2026</option>)}
              </select>
            </label>
          </header>
          <div className="sr-scroll">
            <table>
              <caption className="sr-sr-only">Housing and SBM reported IHHL construction by district for {monthLabel} 2026. No value is combined across the two sources.</caption>
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
                {scope.map((row) => <tr key={`${row.district}-${row.month}`}>
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
            Targets coincide in {data.targetsCoincide} of {data.matched} district-months across every
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
          present on every row of both sources, plus the reported month. A district-month returning
          two different measurements within one source is held out entirely rather than resolved.
          Reported zeroes are retained; blanks are never read as zero.
        </p>
        <p>{data.boundary}</p>
      </div>
    </details>
  </div>;
}
