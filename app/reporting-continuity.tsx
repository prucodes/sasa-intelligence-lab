'use client';

import { useMemo, useState } from 'react';
import { continuityReading, getReportingContinuity } from '@/lib/reporting-continuity';
import './reporting-continuity.css';

const format = (value: number) => value.toLocaleString('en-IN');
const percent = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;

/**
 * Reporting continuity, drawn as days rather than totals.
 *
 * Each bar is the share of entities that reported anything that day. Height is
 * participation, not volume — because volume is exactly what misleads here: one day at
 * 58% participation carries 94.6% of the door-to-door export's reported collection.
 */
function ParticipationChart({ days, measureLabel }: { days: ReturnType<typeof getReportingContinuity>['datasets'][number]['days']; measureLabel: string }) {
  return <div className="rc-chart" role="img"
    aria-label={`Share of entities reporting each day. ${days.map((day) => `${day.date}: ${day.reporting} of ${day.rows}`).join('; ')}.`}>
    {days.map((day) => {
      const ratio = day.reportingRatio ?? 0;
      return <div key={day.date} className="rc-col">
        <div className="rc-stack"><i style={{ height: `${Math.max(ratio * 100, ratio > 0 ? 1.5 : 0)}%` }} data-silent={ratio < 0.02}/></div>
        <span>{day.date.slice(8)}</span>
      </div>;
    })}
    <span className="rc-sr-only">Each bar is the share of entities reporting any {measureLabel} that day.</span>
  </div>;
}

export function ReportingContinuity() {
  const data = useMemo(() => getReportingContinuity(), []);
  const [selected, setSelected] = useState(
    data.datasets.find((dataset) => dataset.verdict === 'single-day-concentration')?.tableKey ?? data.datasets[0]?.tableKey ?? '',
  );
  const dataset = data.datasets.find((item) => item.tableKey === selected) ?? data.datasets[0];
  if (!dataset) return null;
  const reading = continuityReading(dataset.verdict);
  const reporting = dataset.entities - dataset.entitiesNeverReporting;

  return <section className="reporting-continuity" aria-labelledby="rc-title">
    <header className="rc-intro">
      <div>
        <span className="rc-kicker">Filled is not reported</span>
        <h2 id="rc-title">Nothing is missing.<br/><em>Almost nothing was reported.</em></h2>
        <p>
          These secretariat-day exports arrive 100% complete on every column, so every
          completeness check in this product passes them. The defect is a value that is
          present and zero — indistinguishable from &ldquo;nothing happened&rdquo; unless you
          look at who reported, and when.
        </p>
      </div>
      <dl className="rc-summary">
        <div><dt>Rows retained</dt><dd>{format(dataset.rows)}<span> {dataset.entityGrain ?? 'row'} · day</span></dd></div>
        <div><dt>Entities ever reporting</dt><dd>{format(reporting)}<span> of {format(dataset.entities)}</span></dd></div>
        <div><dt>Reporting every day</dt><dd>{format(dataset.entitiesReportingEveryDay)}<span> of {format(dataset.entities)}</span></dd></div>
      </dl>
    </header>

    <div className="rc-tabs" role="tablist" aria-label="Retained secretariat-day exports">
      {data.datasets.map((item, index) => <button key={item.tableKey} type="button" role="tab"
        aria-selected={item.tableKey === dataset.tableKey}
        aria-label={`${item.label}: ${continuityReading(item.verdict).title}`}
        className={item.tableKey === dataset.tableKey ? 'is-selected' : ''}
        onClick={() => setSelected(item.tableKey)}>
        <span>{String(index + 1).padStart(2, '0')}</span>
        <b>{item.label}</b>
        <small>{format(item.rows)} rows · {item.days.length} days</small>
      </button>)}
    </div>

    <div className="rc-body">
      <div className={`rc-verdict rc-${dataset.verdict}`}>
        <span>{dataset.verdict.replace(/-/g, ' ')}</span>
        <b>{reading.title}</b>
        <p>{reading.reading}</p>
      </div>

      <ParticipationChart days={dataset.days} measureLabel={dataset.measureLabel}/>
      <p className="rc-legend">
        Share of {dataset.entityGrain?.toLowerCase() ?? 'entity'} rows reporting any
        {' '}{dataset.measureLabel} that day. Height is participation, not volume — a day
        where almost nobody reported is drawn hatched so it cannot read as a low figure.
      </p>

      {dataset.busiestDateShare !== null && dataset.evenShare !== null && <div className="rc-concentration">
        <div>
          <strong>{percent(dataset.busiestDateShare)}</strong>
          <span>of all reported {dataset.measureLabel} falls on <b>{dataset.busiestDate}</b></span>
          <small>Even reporting across {dataset.days.length} days would put {percent(dataset.evenShare)} on any one of them.</small>
        </div>
      </div>}

      {dataset.naiveRatio !== null && dataset.busiestDayRatio !== null && <div className="rc-ratio" role="note">
        <span className="rc-ratio-tag">The ratio this data invites — and why it is not published</span>
        <div className="rc-ratio-pair">
          <div><strong>{percent(dataset.naiveRatio)}</strong><small>across all {format(dataset.rows)} rows</small></div>
          <i aria-hidden="true">vs</i>
          <div><strong>{percent(dataset.busiestDayRatio)}</strong><small>on {dataset.busiestDate} alone</small></div>
        </div>
        <p>
          Same source, same column, same arithmetic — a {(dataset.busiestDayRatio / dataset.naiveRatio).toFixed(0)}× swing
          decided entirely by which rows are included. No coverage figure is published from
          this export, and none should be quoted from it.
        </p>
      </div>}
    </div>

    <details className="rc-method">
      <summary>Source &amp; reading boundary</summary>
      <div>
        <p>
          {dataset.tableKey} · {format(dataset.rows)} rows across {dataset.days.length} reported
          days, retained {dataset.retrievedAt?.slice(0, 10)}. Too large to bundle, so the raw
          pages stay in data/large-snapshots and only this summary ships.
          {dataset.measure && <> Measure column <code>{dataset.measure}</code></>}
          {dataset.denominator && <>, denominator <code>{dataset.denominator}</code></>}.
        </p>
        <p>{data.boundary}</p>
      </div>
    </details>
  </section>;
}
