'use client';

import { useMemo, useState } from 'react';
import { getSecretariatCohort, type CohortPoint } from '@/lib/secretariat-cohort';
import './secretariat-cohort.css';

const format = (value: number) => value.toLocaleString('en-IN');
const percent = (value: number | null) => value === null ? 'No rate' : `${Math.round(value * 100)}%`;

/**
 * Positions, not scores.
 *
 * The axes are two ratios from one reported day. Nothing is ranked, no quadrant is
 * labelled good or bad, and the entities that reported no collection are drawn on their
 * own axis line rather than at zero, because "collected nothing" and "reported nothing"
 * are different facts and must not share a position.
 */
function CohortPlot({ points, district }: { points: CohortPoint[]; district: string }) {
  const width = 620;
  const height = 380;
  const pad = { left: 54, right: 26, top: 24, bottom: 52 };
  const x = (ratio: number) => pad.left + ratio * (width - pad.left - pad.right);
  const y = (ratio: number) => height - pad.bottom - ratio * (height - pad.top - pad.bottom);
  const inScope = (point: CohortPoint) => !district || point.district === district;
  const plotted = points.filter((point) => point.segregationOfCollected !== null && inScope(point));
  const silent = points.filter((point) => point.segregationOfCollected === null && inScope(point));

  return <figure className="sc-plot">
    <figcaption>
      <span>Reported collection against reported segregation</span>
      <b>One day. {format(plotted.length)} secretariats with a rate; {format(silent.length)} reported no collection and have none.</b>
    </figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Scatter of ${plotted.length} secretariats. Horizontal axis: share of households collected from. Vertical axis: share of collected households whose waste was segregated.`}>
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => <g key={tick} className="sc-grid">
        <line x1={x(tick)} x2={x(tick)} y1={pad.top} y2={height - pad.bottom}/>
        <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)}/>
        <text x={x(tick)} y={height - pad.bottom + 20} textAnchor="middle">{Math.round(tick * 100)}%</text>
        <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end">{Math.round(tick * 100)}%</text>
      </g>)}
      {plotted.map((point) => <circle key={point.code} className="sc-point"
        cx={x(Math.min(point.collectionRatio, 1))} cy={y(Math.min(point.segregationOfCollected!, 1))} r="2.6">
        <title>{`${point.ulb} · ${point.district}: ${percent(point.collectionRatio)} collected, ${percent(point.segregationOfCollected)} of that segregated`}</title>
      </circle>)}
      <text className="sc-axis-label" x={(pad.left + width - pad.right) / 2} y={height - 10} textAnchor="middle">Households collected from</text>
      <text className="sc-axis-label" transform="rotate(-90)" x={-(pad.top + height - pad.bottom) / 2} y={16} textAnchor="middle">Collected households segregating</text>
    </svg>
    {silent.length > 0 && <p className="sc-silent">
      <i aria-hidden="true"/><b>{format(silent.length)}</b> secretariats reported no collection on this day and are
      not plotted. They have no segregation rate because there is no denominator. That is
      absent evidence, not a zero, and placing them at the origin would invent a reading.
    </p>}
  </figure>;
}

export function SecretariatCohort() {
  const data = useMemo(() => getSecretariatCohort(), []);
  const [district, setDistrict] = useState('');
  const passing = data.gates.filter((gate) => gate.passes).length;

  return <section className="secretariat-cohort" aria-labelledby="sc-title">
    <header className="sc-intro">
      <div>
        <span className="sc-kicker">First cohort with a verified identity</span>
        <h2 id="sc-title">Three gates open.<br/><em>Two remain shut.</em></h2>
        <p>
          Collection and segregation both key on a numeric secretariat code, both report
          the same {format(data.identity.collectionCodes)} codes on {data.day}, and they
          agree on the household denominator for every one. No names are matched, so
          nothing here rests on an inference, which is why identity, period and
          denominator finally pass. Performance still does not.
        </p>
      </div>
      <dl className="sc-summary">
        <div><dt>Secretariats in cohort</dt><dd>{format(data.cohort)}<span> {format(data.reporting)} reported collection</span></dd></div>
        <div><dt>Collected of households</dt><dd>{percent(data.collectionCoverage)}<span> {format(data.totals.collected)} of {format(data.totals.households)}</span></dd></div>
        <div><dt>Segregated of collected</dt><dd>{percent(data.segregationOfCollected)}<span> never exceeds collection, in any secretariat</span></dd></div>
      </dl>
    </header>

    <div className="sc-gates" role="list" aria-label="Scoring gates">
      {data.gates.map((gate) => <div key={gate.id} role="listitem" className={gate.passes ? 'sc-gate is-open' : 'sc-gate'}>
        <span className="sc-gate-state">{gate.passes ? 'Open' : 'Shut'}</span>
        <b>{gate.label}</b>
        <p>{gate.evidence}</p>
      </div>)}
    </div>

    <div className="sc-verdict" role="note">
      <span className="sc-verdict-tag">{passing} of {data.gates.length} gates open · still UNSCORED</span>
      <p>
        This is the closest the product has come to a scoreable cohort, and it is still not
        one. The two gates that remain shut are not data problems that more pulling would
        fix: one reported day cannot establish performance, and no scoring policy exists to
        score against. Positions are shown; no entity is ranked or labelled.
      </p>
    </div>

    <div className="sc-plot-panel">
      <header>
        <div><span className="sc-kicker">Positions on {data.day}</span><h3>Two reported rates, one day</h3></div>
        <label>
          <span className="sc-sr-only">District</span>
          <select value={district} onChange={(event) => setDistrict(event.target.value)} aria-label="Filter by district">
            <option value="">All {data.districts.length} districts</option>
            {data.districts.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
      </header>
      <CohortPlot points={data.points} district={district}/>
    </div>

    <details className="sc-method">
      <summary>Source &amp; reading boundary</summary>
      <div>
        <p>{data.boundary}</p>
        <p>
          Joined on <code>{data.identity.key}</code>: {format(data.identity.collectionCodes)} codes in
          collection and {format(data.identity.segregationCodes)} in segregation,
          {' '}{data.identity.unmatched} present in only one, {data.identity.disputed} held out for
          disagreeing repeats, {data.identity.denominatorConflicts} disagreeing on total households.
          Segregated households never exceed collected households in any secretariat
          ({data.containmentBreaches} breaches), which is the containment the two measures must obey.
        </p>
      </div>
    </details>
  </section>;
}
