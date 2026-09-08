'use client';

import { useMemo, useState } from 'react';
import { getRuralSanitation } from '@/lib/rural-sanitation';
import './rural-sanitation.css';

const format = (value: number) => value.toLocaleString('en-IN');

type SortKey = 'panchayats' | 'coverage' | 'functioning';

export function RuralSanitation() {
  const data = useMemo(() => getRuralSanitation(), []);
  const [sort, setSort] = useState<SortKey>('panchayats');

  const rows = [...data.districts].sort((a, b) => {
    const cover = (district: typeof a) => {
      const stated = district.withSwpc + district.withoutSwpc;
      return stated > 0 ? district.withSwpc / stated : -1;
    };
    const working = (district: typeof a) => {
      const stated = district.fullyFunctioning + district.partiallyFunctioning + district.notFunctioning;
      return stated > 0 ? district.fullyFunctioning / stated : -1;
    };
    if (sort === 'coverage') return cover(b) - cover(a);
    if (sort === 'functioning') return working(b) - working(a);
    return b.panchayats - a.panchayats;
  });

  const conditionTotal = data.fullyFunctioning + data.partiallyFunctioning + data.notFunctioning;
  const bar = (value: number) => conditionTotal > 0 ? `${(value / conditionTotal) * 100}%` : '0%';

  return <section className="rural-sanitation" aria-labelledby="rs-title">
    <header className="rs-intro">
      <div>
        <span className="rs-kicker">Rural evidence / gram panchayat grain</span>
        <h2 id="rs-title">Twelve thousand villages,<br/><em>counted for the first time.</em></h2>
        <p>
          Every other view in this product describes urban local bodies. This one describes
          gram panchayats — a different population under the same district names. Nothing
          here may be added to, or compared with, a ULB figure.
        </p>
      </div>
      <dl className="rs-summary">
        <div><dt>Gram panchayats</dt><dd>{format(data.panchayats)}<span> across {format(data.blocks)} blocks</span></dd></div>
        <div><dt>With a processing centre</dt><dd>{data.coverageRatio === null ? 'Not stated' : `${Math.round(data.coverageRatio * 100)}%`}<span> {format(data.withSwpc)} of {format(data.withSwpc + data.withoutSwpc)} stated</span></dd></div>
        <div><dt>Held out for disagreement</dt><dd>{data.heldOut}<span> of {format(data.sourceRows)} source rows</span></dd></div>
      </dl>
    </header>

    <div className="rs-condition">
      <div className="rs-condition-head">
        <span className="rs-kicker">Reported working condition</span>
        <b>{format(conditionTotal)} panchayats stated a condition</b>
      </div>
      <div className="rs-condition-bar" role="img"
        aria-label={`${format(data.fullyFunctioning)} fully functioning, ${format(data.partiallyFunctioning)} partially functioning, ${format(data.notFunctioning)} not functioning`}>
        <i className="rs-full" style={{ width: bar(data.fullyFunctioning) }}/>
        <i className="rs-partial" style={{ width: bar(data.partiallyFunctioning) }}/>
        <i className="rs-none" style={{ width: bar(data.notFunctioning) }}/>
      </div>
      <ul className="rs-condition-key">
        <li><i className="rs-full" aria-hidden="true"/>Fully functioning<b>{format(data.fullyFunctioning)}</b></li>
        <li><i className="rs-partial" aria-hidden="true"/>Partially functioning<b>{format(data.partiallyFunctioning)}</b></li>
        <li><i className="rs-none" aria-hidden="true"/>Not functioning<b>{format(data.notFunctioning)}</b></li>
      </ul>
      {data.presentWithoutCondition > 0 && <p className="rs-gap">
        <b>{format(data.presentWithoutCondition)}</b> panchayats report a processing centre but
        state no working condition. That is missing evidence about a centre that exists — not a
        centre that is broken, and not a centre that is fine.
      </p>}
    </div>

    <div className="rs-table-panel">
      <header className="rs-table-head">
        <div>
          <span className="rs-kicker">By district</span>
          <h3>Coverage and condition<span>{rows.length} districts · gram panchayat grain</span></h3>
        </div>
        <label>
          <span className="rs-sr-only">Sort districts</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort districts">
            <option value="panchayats">Most gram panchayats</option>
            <option value="coverage">Highest stated coverage</option>
            <option value="functioning">Most fully functioning</option>
          </select>
        </label>
      </header>
      <div className="rs-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">District</th><th scope="col">Panchayats</th><th scope="col">With centre</th>
              <th scope="col">Coverage</th><th scope="col">Fully functioning</th><th scope="col">Condition not stated</th>
              <th scope="col">Mandal operators</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((district) => {
              const stated = district.withSwpc + district.withoutSwpc;
              const coverage = stated > 0 ? district.withSwpc / stated : null;
              const operators = district.mandalOperators;
              const reported = district.reportedMandalOperators;
              return <tr key={district.districtId}>
                <th scope="row">{district.district}</th>
                <td>{format(district.panchayats)}</td>
                <td>{format(district.withSwpc)}</td>
                <td>{coverage === null ? <em>Not stated</em> : `${Math.round(coverage * 100)}%`}</td>
                <td>{format(district.fullyFunctioning)}</td>
                <td>{district.conditionNotStated ? format(district.conditionNotStated) : <em>None</em>}</td>
                <td className={operators !== null && reported !== null && operators !== reported ? 'rs-mismatch' : undefined}>
                  {operators === null ? <em>Not returned</em>
                    : reported === null || operators === reported ? format(operators)
                      : <>{format(reported)} <span>of {format(operators)}</span></>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="rs-note">
        Coverage divides panchayats with a centre by panchayats that stated a value, never by
        the full population. Where reported mandal operators differ from the operator count,
        both numbers are shown rather than one being chosen.
      </p>
    </div>

    <details className="rs-method">
      <summary>Source &amp; reading boundary</summary>
      <div>
        <p>{data.boundary}</p>
        <p>
          Rolled up from <code>sasa_pr_no_of_swachh_rathamsoperationalized_for_dry_waste_api_27_aug_2026</code>
          {' '}(26,702 rows, retained in data/large-snapshots — too large to bundle) and
          {' '}<code>sasa_pr_no_of_swpcs_operationalised_api_27_aug_2026</code> (56 rows).
          A gram panchayat on several rows is counted once and only where every row agrees;
          {data.heldOut === 0 ? ' no panchayat disagreed with itself in this vintage.' : ` ${data.heldOut} disagreed and are held out.`}
        </p>
        <p>
          This is rural infrastructure presence and self-reported condition. It is not
          throughput, not service quality, and not comparable to any ULB facility count.
        </p>
      </div>
    </details>
  </section>;
}
