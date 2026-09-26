'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import {
  estimateAssumptions,
  getCarbonEstimates,
  getEnvironmentSections,
  segregationAtSource,
  type LedgerLine,
} from '@/lib/environment-ledger';
import { rateText } from '@/lib/format-rate';
import './environment-ledger.css';

type View = 'ledger' | 'estimates' | 'gaps';

const VIEWS: { id: View; label: string; note: string }[] = [
  { id: 'ledger', label: 'Physical ledger', note: 'Quantities a source reported' },
  { id: 'estimates', label: 'Carbon estimates', note: 'Published factors, shown as estimates' },
  { id: 'gaps', label: 'What is missing', note: 'Conversions we will not make yet' },
];

/** A quantity keeps one decimal only where the source carried one. */
const qty = (value: number | null) =>
  value === null ? 'Not returned' : value.toLocaleString('en-IN', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });
const whole = (value: number) => Math.round(value).toLocaleString('en-IN');
const share = (value: number | null) => (value === null ? 'Not available' : `${rateText(value * 100)}%`);

export function EnvironmentLedger({ mode }: { mode: 'DEMO' | 'SAMPLE' | 'LIVE' }) {
  if (mode === 'SAMPLE') return <EnvironmentWorkspace />;
  return (
    <div className="env-ledger el-unavailable">
      <span className="el-kicker">SASA Intelligence Lab / Environment and carbon</span>
      <h1>This ledger only exists in governed evidence.</h1>
      <p>
        Every quantity on this screen is read from a retained governed snapshot, and the carbon estimates are arithmetic on
        those quantities. {mode === 'DEMO' ? 'The Demo fixture is a synthetic capability story with no waste, sewage or green cover measurements in it, so there is nothing here to convert.' : 'The Live connector is on the roadmap; until a response is retained there is no quantity to convert.'}{' '}
        A fabricated carbon figure would be worse than none, so the screen stays empty rather than filling with a stand-in.
      </p>
      <p className="el-unavailable-action">Switch the data mode to Governed data to read the ledger.</p>
    </div>
  );
}

function EnvironmentWorkspace() {
  const sections = useMemo(() => getEnvironmentSections(), []);
  const carbon = useMemo(() => getCarbonEstimates(), []);
  const day = useMemo(() => segregationAtSource(), []);
  const [view, setView] = useState<View>('ledger');

  return (
    <div className="env-ledger">
      <div className="analytics-tabs el-tabs" role="tablist" aria-label="Environment and carbon views">
        {VIEWS.map((item, index) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={view === item.id}
            className={view === item.id ? 'active' : ''}
            onClick={() => setView(item.id)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <b>{item.label}</b>
            <small>{item.note}</small>
          </button>
        ))}
      </div>

      <section className="el-thesis" aria-label="Why this screen exists">
        <div>
          <span className="el-kicker">The reason this screen is separate</span>
          <h2>
            A carbon claim gets <em>audited</em>. A dashboard number does not.
          </h2>
          <p>
            Seventeen retained routes already describe the three levers that decide an urban carbon position: waste kept out
            of the landfill pathway, sewage treated instead of discharged, and green cover held as a sink. They were
            catalogued as sanitation programmes, which is why nobody read them as an environment account. Nothing new was
            ingested for this screen.
          </p>
          <p>
            The physical ledger and the estimate layer are kept apart on purpose. One is what a source reported. The other is
            arithmetic on it, with every factor named so a reviewer can argue with a parameter instead of the result.
          </p>
        </div>
        <dl className="el-thesis-figures">
          <div>
            <dt>Retained routes read as environment evidence</dt>
            <dd>17</dd>
          </div>
          <div>
            <dt>Quantities converted to tonnes CO2 equivalent</dt>
            <dd>
              {carbon.estimates.length}
              <span>each with its assumptions listed</span>
            </dd>
          </div>
          <div>
            <dt>Conversions withheld for want of a measurement</dt>
            <dd>
              {carbon.unconverted.length}
              <span>named in What is missing</span>
            </dd>
          </div>
        </dl>
      </section>

      {view === 'ledger' && <LedgerView sections={sections} day={day} />}
      {view === 'estimates' && <EstimatesView carbon={carbon} day={day} />}
      {view === 'gaps' && <GapsView carbon={carbon} />}
    </div>
  );
}

function LedgerView({ sections, day }: { sections: ReturnType<typeof getEnvironmentSections>; day: ReturnType<typeof segregationAtSource> }) {
  return (
    <>
      <section className="el-household" aria-labelledby="el-household-title">
        <header>
          <span className="el-kicker">Household grain · one complete day</span>
          <h3 id="el-household-title">Separating waste at the door is the lever, and it is already measured house by house</h3>
        </header>
        <div className="el-household-flow">
          <div>
            <b>{whole(day.households)}</b>
            <span>households on the register</span>
            <small>
              {whole(day.secretariats)} ward secretariats across {day.ulbs} ULBs
            </small>
          </div>
          <div>
            <b>{whole(day.collected)}</b>
            <span>reported collected</span>
            <small>{share(day.reach)} of the register</small>
          </div>
          <div className="is-lever">
            <b>{whole(day.segregated)}</b>
            <span>reported segregated</span>
            <small>{share(day.segregationOfCollected)} of what was collected</small>
          </div>
        </div>
        <p className="el-boundary">
          One source-reported day, {day.day}, which is the only complete day in retention. {whole(day.silentSecretariats)} of
          the {whole(day.secretariats)} secretariats reported nothing collected that day, and a reported day is not a rate.
          The daily feed cannot yet be paged to completion, so this grain exists but the series does not.
        </p>
      </section>

      {sections.map((section) => (
        <section className="el-section" key={section.id} aria-labelledby={`el-${section.id}`}>
          <header>
            <h3 id={`el-${section.id}`}>{section.title}</h3>
            <p>{section.lede}</p>
          </header>
          <div className="el-lines">
            {section.lines.map((line) => (
              <LineCard line={line} key={line.id} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function LineCard({ line }: { line: LedgerLine }) {
  const filled = line.ratio === null ? null : Math.min(line.ratio, 1) * 100;
  const grainWord = line.grain === 'Facility' ? 'facilities' : line.grain === 'District' ? 'districts' : 'ULBs';
  const shortfall = line.polarity === 'shortfall';
  return (
    <article className={`el-line${shortfall ? ' is-shortfall' : ''}`}>
      <header>
        <div className="el-line-name">
          <h4>{line.label}</h4>
          <p>
            {line.grain} grain · {line.period ?? 'no reporting date in this response'} · retained {line.retainedAt}
          </p>
        </div>
        <p className="el-line-figure">
          <strong>{qty(line.reported)}</strong>
          <span>{line.unit}</span>
          {line.target !== null && <small>{shortfall ? `of ${qty(line.target)} in the programme` : `of ${qty(line.target)} targeted`}</small>}
        </p>
      </header>

      {filled !== null && (
        <div
          className="el-bar"
          style={{ '--el-filled': `${filled}%` } as CSSProperties}
          role="img"
          aria-label={
            shortfall
              ? `${qty(line.reported)} ${line.unit} still outstanding, ${share(line.ratio)} of the ${qty(line.target)} in the programme`
              : `${qty(line.reported)} of ${qty(line.target)} ${line.unit} reported, ${share(line.ratio)}`
          }
        >
          <i />
          <b>{share(line.ratio)}</b>
        </div>
      )}
      {shortfall && <p className="el-polarity-note">{share(line.ratio)} of the programme total is still outstanding. A bigger bar is a bigger problem on this line.</p>}

      <ul className="el-chips">
        <li>
          <b>{line.entities}</b> {grainWord} {line.target === null ? 'in the registry' : 'carrying a target'}
        </li>
        <li>
          <b>{line.reporting}</b> {line.id === 'legacy-balance' ? 'carrying a balance' : 'reporting a figure'}
        </li>
        {line.silent > 0 && (
          <li className="is-silent">
            <b>{line.silent}</b> reporting nothing against a target
          </li>
        )}
      </ul>

      {line.concentration && (
        <div className="el-concentration">
          <p>
            <b>{share(line.concentration.share)}</b> of the {shortfall ? 'balance' : 'reported figure'} sits with{' '}
            {line.concentration.top.length} of the {line.reporting}:
          </p>
          <ol>
            {line.concentration.top.map((entity) => (
              <li key={`${entity.district}-${entity.name}`}>
                <span>{entity.name.replace(/"/g, '')}</span>
                <b>{qty(entity.value)}</b>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="el-boundary">{line.boundary}</p>
      {line.caution && (
        <p className="el-caution">
          <b>Source condition.</b> {line.caution}
        </p>
      )}

      <details className="el-source">
        <summary>Source and repeat handling</summary>
        <p>
          <code>{line.tableKey}</code> · {qty(line.quality.rawRows)} rows for the selected period collapse to{' '}
          {qty(line.quality.uniqueRows)} entities
          {line.quality.duplicateRows > 0 ? `, ${qty(line.quality.duplicateRows)} exact repeats removed` : ', no repeats'}
          {line.quality.conflictingKeys > 0
            ? `, ${qty(line.quality.conflictingKeys)} keys held out because their measures disagree`
            : ', nothing held out'}
          . Months are never added together; one declared period is selected and shown.
        </p>
      </details>
    </article>
  );
}

function EstimatesView({ carbon, day }: { carbon: ReturnType<typeof getCarbonEstimates>; day: ReturnType<typeof segregationAtSource> }) {
  const [openAssumptions, setOpenAssumptions] = useState(false);
  const bound = carbon.capacityBound;
  return (
    <>
      <p className="el-estimate-banner" role="note">
        <b>Estimates, not measurements.</b> {carbon.boundary}
      </p>

      <section className="el-bound" aria-labelledby="el-bound-title">
        <header>
          <span className="el-kicker">The check that caps every figure below</span>
          <h3 id="el-bound-title">Reported segregation implies more wet waste than any completed plant can take</h3>
        </header>
        <div className="el-bound-steps">
          <div>
            <small>Implied by the segregation reports</small>
            <b>{whole(bound.impliedWetTonnesPerDay)}</b>
            <span>tonnes of wet waste a day</span>
          </div>
          <div className="el-bound-vs" aria-hidden="true">
            against
          </div>
          <div className="is-limit">
            <small>Wet capacity at completed facilities</small>
            <b>{qty(bound.completedWetTpd)}</b>
            <span>TPD</span>
          </div>
          <div className="el-bound-result">
            <small>Share with a completed plant to receive it</small>
            <b>{share(bound.coveredShare)}</b>
            <span>
              {bound.largestCompletedSite ? `${bound.largestCompletedSite} holds most of that capacity` : 'one period, one registry'}
            </span>
          </div>
        </div>
        <p className="el-boundary">
          Configured wet capacity across the whole registry is {qty(bound.configuredWetTpd)} TPD, which would cover the implied
          tonnage. Only the completed share can carry an avoided-emissions claim today, so the ceiling is set by the plants
          that exist and not by the collection reports. This is why the third estimate below, and not the second, is the one to
          quote.
        </p>
      </section>

      <section className="el-factor" aria-labelledby="el-factor-title">
        <h3 id="el-factor-title">The factor, written out</h3>
        <ol className="el-factor-steps">
          <li>
            <span>Methane a tonne of mixed waste can generate on an unmanaged site</span>
            <b>0.15 × 0.5 × 0.8 × 0.5 × 16/12 = 0.04 t CH4</b>
          </li>
          <li>
            <span>At a 100 year methane warming potential of 28</span>
            <b>{carbon.factors.landfillCentral.toFixed(2)} tCO2e per tonne</b>
          </li>
          <li>
            <span>Less what composting itself releases, as methane and nitrous oxide</span>
            <b>−{carbon.factors.compostProcess.toFixed(2)} tCO2e per tonne</b>
          </li>
          <li className="is-total">
            <span>Avoided by composting a tonne instead of landfilling it</span>
            <b>{carbon.factors.avoidedCentral.toFixed(2)} tCO2e per tonne</b>
          </li>
        </ol>
        <p className="el-boundary">
          The low and high columns below come from the site type alone, {carbon.factors.landfillLow.toFixed(2)} to{' '}
          {carbon.factors.landfillHigh.toFixed(2)} tCO2e per tonne for a shallow versus a managed anaerobic site. Every other
          parameter is held at its published default.
        </p>
      </section>

      <div className="el-estimates">
        {carbon.estimates.map((estimate) => (
          <article className="el-estimate" key={estimate.id}>
            <header>
              <h4>{estimate.label}</h4>
              <p className="el-estimate-value">
                <strong>{whole(estimate.central)}</strong>
                <span>{estimate.unit}</span>
              </p>
            </header>
            <div
              className="el-range"
              style={{ '--el-central': `${((estimate.central - estimate.low) / (estimate.high - estimate.low)) * 100}%` } as CSSProperties}
              role="img"
              aria-label={`Between ${whole(estimate.low)} and ${whole(estimate.high)} ${estimate.unit}, central estimate ${whole(estimate.central)}`}
            >
              <span>{whole(estimate.low)}</span>
              <i>
                <em />
              </i>
              <span>{whole(estimate.high)}</span>
            </div>
            <dl className="el-estimate-basis">
              <div>
                <dt>Rests on</dt>
                <dd>{estimate.physical}</dd>
              </div>
              <div>
                <dt>Arithmetic</dt>
                <dd>
                  <code>{estimate.derivation}</code>
                </dd>
              </div>
            </dl>
            <p className="el-boundary">{estimate.boundary}</p>
            <ul className="el-assumption-chips">
              {estimate.assumptions.map((id) => {
                const assumption = estimateAssumptions.find((item) => item.id === id);
                return (
                  <li key={id} title={assumption ? `${assumption.value} · ${assumption.source}` : undefined}>
                    {assumption?.label ?? id}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>

      <section className="el-assumptions" aria-labelledby="el-assumptions-title">
        <header>
          <div>
            <h3 id="el-assumptions-title">Every assumption, with its source</h3>
            <p>
              None of these was measured in Andhra Pradesh. They are listed so a reviewer can substitute a local value and
              watch the number move, which is the difference between an estimate and a claim.
            </p>
          </div>
          <button type="button" className="el-toggle" aria-expanded={openAssumptions} onClick={() => setOpenAssumptions((open) => !open)}>
            {openAssumptions ? 'Hide the notes' : 'Show the notes'}
          </button>
        </header>
        <div className="el-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value used</th>
                <th>Source</th>
                {openAssumptions && <th>Why it matters</th>}
              </tr>
            </thead>
            <tbody>
              {estimateAssumptions.map((assumption) => (
                <tr key={assumption.id} data-undeclared={assumption.source.startsWith('Not declared') ? 'true' : undefined}>
                  <th scope="row">{assumption.label}</th>
                  <td>{assumption.value}</td>
                  <td>{assumption.source}</td>
                  {openAssumptions && <td className="el-assumption-note">{assumption.note}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="el-boundary">
          The household conversion exists only because the segregation sources count households rather than weight. On{' '}
          {day.day} that turned {whole(day.segregated)} reporting households into the implied tonnage above, and it is the
          weakest link in the chain.
        </p>
      </section>
    </>
  );
}

function GapsView({ carbon }: { carbon: ReturnType<typeof getCarbonEstimates>; }) {
  return (
    <>
      <section className="el-gaps-intro" aria-labelledby="el-gaps-title">
        <span className="el-kicker">Conversions withheld</span>
        <h3 id="el-gaps-title">What a certified inventory would need that we do not hold</h3>
        <p>
          Each line below is a quantity the state already reports and a conversion we are refusing to make, with the exact
          measurement that would make it possible. A carbon figure published without these would not survive a third party
          auditor, and this list is therefore the data request rather than a disclaimer.
        </p>
      </section>
      <ol className="el-gaps">
        {carbon.unconverted.map((item) => (
          <li key={item.id}>
            <div className="el-gap-have">
              <span>What is reported</span>
              <b>{item.label}</b>
              <small>{item.physical}</small>
            </div>
            <div className="el-gap-need">
              <span>What is needed to convert it</span>
              <p>{item.missing}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="el-boundary el-gaps-close">
        Two of these are measurements someone already takes and does not publish: weighbridge tonnage at the processing
        facilities, and the organic load behind the sewage volumes. The rest need a field measurement that nobody has been
        asked for. Neither gap is a reason to delay the physical ledger, which stands on its own.
      </p>
    </>
  );
}
