'use client';

import { useMemo, useState } from 'react';
import { getDeliveryPlans, type DeliveryPlan } from '@/lib/delivery-plan';
import './delivery-plans.css';

const format = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Plan against delivery over a financial year.
 *
 * The bars are split deliberately: the elapsed window is drawn solid, the months no
 * district has reported yet are drawn as an outline. Reading the outline as shortfall
 * is the mistake this view exists to prevent, so the two never share an encoding.
 */
function PlanChart({ plan }: { plan: DeliveryPlan }) {
  const max = Math.max(...plan.months.map((month) => Math.max(month.target ?? 0, month.achievement ?? 0)), 1);
  return <div className="dp-chart" role="img"
    aria-label={`${plan.label}: ${plan.elapsed.length} reported months and ${plan.remaining.length} months of plan only. ${plan.elapsed.map((month) => `${month.label} ${month.achievement} of ${month.target}`).join('; ')}.`}>
    {plan.months.map((month) => <div key={month.monthId} className={month.unreported ? 'dp-col is-planned' : 'dp-col'}>
      <div className="dp-stack">
        <i className="dp-target" style={{ height: `${((month.target ?? 0) / max) * 100}%` }}/>
        {!month.unreported && <i className="dp-actual" style={{ height: `${((month.achievement ?? 0) / max) * 100}%` }}/>}
      </div>
      <span>{month.label.slice(0, 3)}</span>
    </div>)}
  </div>;
}

export function DeliveryPlans() {
  const plans = useMemo(() => getDeliveryPlans(), []);
  const distinct = plans.filter((plan) => plan.duplicateOf === null);
  const [selected, setSelected] = useState(distinct[0]?.id ?? '');
  const plan = distinct.find((item) => item.id === selected) ?? distinct[0];
  const duplicates = plans.filter((item) => item.duplicateOf !== null);
  if (!plan) return null;

  return <section className="delivery-plans" aria-labelledby="dp-title">
    <header className="dp-intro">
      <div>
        <span className="dp-kicker">Plan against delivery / financial year 2026-27</span>
        {plan.periodicity === 'monthly'
          ? <>
            <h2 id="dp-title">{plan.months.length} months of plan.<br/><em>{plan.elapsed.length} months of evidence.</em></h2>
            <p>
              The works sources are the first retained evidence with a real horizon: a target
              for every reported month, and achievement filled in as months pass. Everything
              after the last reported month is plan only, and is never counted as a shortfall.
            </p>
          </>
          : <>
            <h2 id="dp-title">One target, one figure.<br/><em>No period at all.</em></h2>
            <p>
              This source returns a single target and achievement per district and no reporting
              month. It can be read as a position, never as progress — so no series is drawn and
              no pace over time is claimed.
            </p>
          </>}
      </div>
      <dl className="dp-summary">
        <div><dt>Reported months</dt><dd>{plan.periodicity === 'point-in-time' ? 'None' : plan.elapsed.length}<span>{plan.periodicity === 'point-in-time' ? ' no period column' : ` of ${plan.months.length}`}</span></dd></div>
        <div><dt>Delivered to date</dt><dd>{format(plan.deliveredToDate)}<span> {plan.unit}</span></dd></div>
        <div><dt>Pace against elapsed plan</dt><dd>{plan.paceToDate === null ? 'No rate' : `${Math.round(plan.paceToDate * 100)}%`}<span> {format(plan.plannedToDate)} planned</span></dd></div>
      </dl>
    </header>

    <div className="dp-tabs" role="tablist" aria-label="Works programme">
      {distinct.map((item, index) => <button key={item.id} type="button" role="tab"
        aria-selected={item.id === plan.id} className={item.id === plan.id ? 'is-selected' : ''}
        aria-label={`${item.label}: ${format(item.deliveredToDate)} of ${format(item.plannedToDate)} ${item.unit}`}
        onClick={() => setSelected(item.id)}>
        <span>{String(index + 1).padStart(2, '0')}</span>
        <b>{item.label}</b>
        <small>{format(item.deliveredToDate)} / {format(item.plannedToDate)} {item.unit}</small>
      </button>)}
    </div>

    <div className="dp-body">
      {plan.periodicity === 'monthly' ? <>
        <PlanChart plan={plan}/>
        <p className="dp-legend">
          <i className="dp-key-actual" aria-hidden="true"/>Reported achievement
          <i className="dp-key-target" aria-hidden="true"/>Monthly target
          <i className="dp-key-planned" aria-hidden="true"/>Plan only — not yet reported
        </p>
      </> : <div className="dp-flat">
        <div>
          <span>Delivered</span>
          <strong>{format(plan.deliveredToDate)}</strong>
          <small>of {format(plan.plannedToDate)} {plan.unit} targeted across {plan.districts.length} districts</small>
        </div>
        <div className="dp-flat-bar" aria-hidden="true">
          <i style={{ width: `${plan.paceToDate === null ? 0 : Math.min(100, plan.paceToDate * 100)}%` }}/>
        </div>
        <p>No chart is drawn: this source reports no period, so there is no series to plot.</p>
      </div>}
      <p className="dp-boundary">{plan.boundary}</p>
      {plan.transposedIdentity && <p className="dp-transposed">
        <b>Column transposition in this source.</b> Its identifier and name columns hold each
        other’s values — <code>dstrt_id</code> returns the district name and <code>dstrt_nm</code>
        returns the numeric id. The district labels below are read from the LGD name column
        instead. Nothing is silently swapped, and the flag clears itself if the source is fixed.
      </p>}
    </div>

    {duplicates.length > 0 && <div className="dp-duplicate" role="note">
      <span className="dp-duplicate-tag">Endpoint excluded from every total</span>
      {duplicates.map((item) => <p key={item.id}>
        <b>{item.tableKey}</b> returns rows identical to <b>{item.duplicateOf}</b>, and its own
        {' '}<code>work_name</code> column reads &ldquo;{item.reportedWorkName}&rdquo;. It is a
        second copy of one programme, not a second programme, so it is not counted twice.
      </p>)}
    </div>}

    <div className="dp-districts">
      <header>
        <span className="dp-kicker">{plan.periodicity === 'point-in-time' ? 'As reported' : 'Elapsed window only'}</span>
        <h3>{plan.label} by district<span>{plan.periodicity === 'point-in-time' ? `As reported · ${plan.unit}` : `${plan.elapsed.length} reported months · ${plan.unit}`}</span></h3>
      </header>
      <div className="dp-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">District</th><th scope="col">Planned</th>
              <th scope="col">Delivered</th><th scope="col">Pace</th>
              {plan.periodicity === 'monthly' && <th scope="col">Silent months</th>}
            </tr>
          </thead>
          <tbody>
            {plan.districts.map((district) => {
              const pace = district.target > 0 ? district.achievement / district.target : null;
              return <tr key={district.district}>
                <th scope="row">{district.district}</th>
                <td>{format(district.target)}</td>
                <td>{format(district.achievement)}</td>
                <td>{pace === null ? <em>No rate</em> : `${Math.round(pace * 100)}%`}</td>
                {plan.periodicity === 'monthly' && <td>{district.silentMonths || <em>None</em>}</td>}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="dp-note">
        {plan.periodicity === 'monthly'
          ? <>Planned and delivered cover the {plan.elapsed.length} reported months only, not the full-year plan of {format(plan.plannedTotal)} {plan.unit}. </>
          : <>Planned and delivered are the single figures the source returns per district. </>}
        A district with no rate reported no target, which is not a target of zero.
      </p>
    </div>

    <details className="dp-method">
      <summary>Source &amp; reading boundary</summary>
      <div>
        <p>
          {plan.tableKey} · district grain · unit <b>{plan.unit}</b>, read from the source&rsquo;s
          own <code>units</code> column rather than assumed from the dataset name.
          {plan.reportedWorkName && <> The source describes these rows as &ldquo;{plan.reportedWorkName}&rdquo;.</>}
          {' '}{plan.rows} rows retained, {plan.excluded} excluded for a missing period, a
          missing district, or two different measurements for one district-month.
        </p>
        <p>
          Pace is delivered over planned across the elapsed window. It describes reported
          progress against a reported plan. It is not a performance score, and no district
          is ranked by it.
        </p>
      </div>
    </details>
  </section>;
}
