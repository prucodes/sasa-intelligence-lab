'use client';

import { useMemo, useState } from 'react';
import { getRuralSanitation } from '@/lib/rural-sanitation';
import {DistrictMap} from './district-map';
import './rural-sanitation.css';

const format = (value: number) => value.toLocaleString('en-IN');

type SortKey = 'panchayats' | 'coverage' | 'functioning';

export function RuralSanitation() {
  const data = useMemo(() => getRuralSanitation(), []);
  const [sort, setSort] = useState<SortKey>('panchayats');
  const [district,setDistrict]=useState('');
  const [measure,setMeasure]=useState('presence');

  const rows = [...data.districts].filter(d=>!district||d.district===district).sort((a, b) => {
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
        <h2 id="rs-title">Where centres exist.<br/><em>How they are reported to work.</em></h2>
        <p>
          This register describes gram panchayats: centre presence and reported condition. Rural and urban populations remain separate, even where district names are shared.
        </p>
      </div>

    </header>

    <div className="vi-geography-section"><div className="ew-controls"><label>Map measure<select aria-label="Centre map measure" value={measure} onChange={e=>setMeasure(e.target.value)}><option value="presence">Processing centre present</option><option value="functioning">Fully functioning among stated conditions</option></select></label></div><div className="vi-map-review"><div className="rs-map-story"><span className="rs-kicker">The register picture</span>      <dl className="rs-summary">
        <div><dt>Gram panchayats</dt><dd>{format(data.panchayats)}<span> across {format(data.blocks)} blocks</span></dd></div>
        <div><dt>With a processing centre</dt><dd>{data.coverageRatio === null ? 'Not stated' : `${Math.round(data.coverageRatio * 100)}%`}<span> {format(data.withSwpc)} of {format(data.withSwpc + data.withoutSwpc)} stated</span></dd></div>
        <div><dt>Held out for disagreement</dt><dd>{data.heldOut}<span> of {format(data.sourceRows)} source rows</span></dd></div>
      </dl><p>Presence and working condition describe the undated register. They do not establish service outcomes.</p></div><DistrictMap rows={data.districts.map(d=>{
      const denominator=measure==='presence'?d.withSwpc+d.withoutSwpc:d.fullyFunctioning+d.partiallyFunctioning+d.notFunctioning;
      const numerator=measure==='presence'?d.withSwpc:d.fullyFunctioning;
      return {district:d.district,value:denominator>0?numerator/denominator*100:null,detail:`${format(numerator)} / ${format(denominator)} GPs ${measure==='presence'?'with stated centre presence':'with a present centre and stated condition'} · ${format(d.conditionNotStated)} present centres lack a condition`};
    })} selected={district} onSelect={setDistrict} title={measure==='presence'?'Centre presence by district':'Reported functioning by district'} unit="%" maximum={100}/></div></div>
    <details className="vi-disclosure"><summary>Statewide centre condition and register checks</summary><div className="rs-condition">
      <div className="rs-condition-head">
        <span className="rs-kicker">Working condition · centres reported present</span>
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

    <p className="rs-note"><b>{format(data.districts.reduce((sum,d)=>sum+d.conditionConflicts,0))} register inconsistencies:</b> a condition is stated where a centre is not reported present. Of these, {format(data.districts.reduce((sum,d)=>sum+d.functionalWithoutCentre,0))} state fully or partially functioning. These condition claims are excluded from the centre-condition totals.</p>
    </details><div className="rs-table-panel">
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
