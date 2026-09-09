'use client';

import { useMemo } from 'react';
import { getRuralCohort } from '@/lib/rural-cohort';
import './rural-cohort.css';

const format = (value: number) => value.toLocaleString('en-IN');
const percent = (value: number | null) => value === null ? 'No rate' : `${(value * 100).toFixed(1)}%`;

/**
 * A null result, presented as one.
 *
 * The bars are drawn to a common scale and deliberately not exaggerated: the whole point
 * is that they are the same height. A zoomed axis would manufacture the difference this
 * panel exists to say is absent.
 */
export function RuralCohort() {
  const data = useMemo(() => getRuralCohort(), []);
  const groups = data.groups.filter((group) => group.panchayats > 0);

  return <section className="rural-cohort" aria-labelledby="rc2-title">
    <header className="rc2-intro">
      <div>
        <span className="rc2-kicker">Infrastructure against activity · a null result</span>
        <h2 id="rc2-title">The register joins perfectly.<br/><em>It predicts nothing.</em></h2>
        <p>
          All {format(data.identity.registered)} registered gram panchayats appear in the August
          collection export, joined on a numeric id with nothing inferred and nothing disputed.
          Identity and denominator are established as firmly as anywhere in this product. What the
          pairing then shows is an absence — and an absence is a finding, so it is stated rather
          than dressed up.
        </p>
      </div>
      <dl className="rc2-summary">
        <div><dt>Panchayats joined</dt><dd>{format(data.identity.matched)}<span> of {format(data.identity.registered)} registered · {data.identity.registerDisputed} disputed</span></dd></div>
        <div><dt>Reported days used</dt><dd>{data.usableDays.length}<span> {data.outageDays.length > 0 ? `${data.outageDays.join(', ')} excluded as an outage` : 'all reported days'}</span></dd></div>
        <div><dt>Spread between groups</dt><dd>{data.spreadPoints}<span> percentage points</span></dd></div>
      </dl>
    </header>

    <div className="rc2-compare">
      <h3>Collection rate by what the register says</h3>
      <ul>
        {groups.map((group) => <li key={group.id}>
          <div className="rc2-label"><b>{group.label}</b><small>{format(group.panchayats)} panchayats · {format(group.panchayatDays)} panchayat-days</small></div>
          <div className="rc2-bar" aria-hidden="true"><i style={{ width: `${(group.collectionRate ?? 0) * 100}%` }}/></div>
          <strong>{percent(group.collectionRate)}</strong>
        </li>)}
      </ul>
      <p className="rc2-scale">Bars are drawn to a full 0–100% scale. A zoomed axis would manufacture the difference this panel exists to report as absent.</p>
    </div>

    <div className="rc2-condition">
      <h3>And by reported working condition</h3>
      <div className="rc2-scroll">
        <table>
          <thead><tr><th scope="col">Reported condition</th><th scope="col">Panchayats</th><th scope="col">Collection rate</th><th scope="col">Segregated households / panchayat-day</th></tr></thead>
          <tbody>
            {data.byCondition.map((group) => <tr key={group.condition ?? 'not-stated'}>
              <th scope="row">{group.condition ?? <em>Not stated</em>}</th>
              <td>{format(group.panchayats)}</td>
              <td>{percent(group.collectionRate)}</td>
              <td>{group.segregatedPerPanchayatDay?.toFixed(1) ?? '—'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="rc2-nonmono">
        The ordering does not hold: <b>Not Functioning</b> segregates more per panchayat-day than
        <b> Partially Functioning</b>. If a working centre drove the outcome, it could not.
      </p>
    </div>

    <div className="rc2-readings" role="note">
      <span className="rc2-readings-tag">Two readings this data cannot separate</span>
      <ol>
        <li><b>The register may be stale.</b> It carries no date column at all — {data.registerCurrency}. Whether it describes August is unknown.</li>
        <li><b>The pairing may be wrong.</b> A processing centre and door-to-door collection are different activities. A centre may simply not govern whether a household&rsquo;s waste is picked up.</li>
      </ol>
      <p>
        Distinguishing them needs a dated register, which the source does not provide. Until then
        this stands as what it is: a clean join, and no relationship across it.
      </p>
    </div>

    <details className="rc2-method">
      <summary>Source &amp; reading boundary</summary>
      <div>
        <p>{data.boundary}</p>
        <p>
          Joined on <code>{data.identity.key}</code>. {format(data.identity.matched)} of
          {' '}{format(data.identity.registered)} registered panchayats matched,
          {' '}{data.identity.registeredWithoutActivity} registered with no activity rows,
          {' '}{format(data.identity.activityOnlyPanchayats)} collecting panchayats absent from the
          register. Rates are over panchayat-days actually reported, never over the calendar.
          No per-panchayat points are published: with no relationship to show, a scatter would
          imply one.
        </p>
      </div>
    </details>
  </section>;
}
