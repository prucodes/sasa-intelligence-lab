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

type View = 'ledger' | 'estimates' | 'gaps' | 'actions';

const VIEWS: { id: View; label: string; note: string }[] = [
  { id: 'ledger', label: 'Physical ledger', note: 'Quantities a source reported' },
  { id: 'estimates', label: 'Carbon scenarios', note: 'Screening arithmetic, not reductions' },
  { id: 'gaps', label: 'Inventory gaps', note: 'Measurements still needed' },
  { id: 'actions', label: 'Action pathway', note: 'Priorities the evidence supports' },
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
        Every quantity on this screen is read from a retained governed snapshot, and the carbon scenarios are arithmetic on
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
  const routeCount = useMemo(
    () => new Set(sections.flatMap((section) => section.lines.map((line) => line.tableKey))).size + 2,
    [sections],
  );
  const routeStreams = useMemo(
    () => sections.map((section) => ({
      id: section.id,
      label: section.id === 'diversion' ? 'Waste + collection' : section.id === 'treatment' ? 'Wastewater' : 'Green assets',
      count: new Set(section.lines.map((line) => line.tableKey)).size + (section.id === 'diversion' ? 2 : 0),
    })),
    [sections],
  );

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

      <section className="el-thesis" aria-label="How to read the environment ledger">
        <div className="el-thesis-copy">
          <span className="el-kicker">The reason this screen is separate</span>
          <h2>
            Start with what is reported. <em>Stop where measurement ends.</em>
          </h2>
          <p>
            {routeCount} retained routes describe the waste, wastewater and green-asset side of a municipal carbon position. They
            were catalogued as sanitation programmes; this screen reads them together as environment evidence. Nothing new
            was ingested for it.
          </p>
          <p>
            Reported quantities, screening arithmetic and missing measurements remain visibly separate. That makes the page
            useful for review without turning a construction status or a model assumption into an environmental result.
          </p>
          <ul className="el-status-key" aria-label="Evidence status key">
            <li className="is-reported"><i />Reported quantity</li>
            <li className="is-scenario"><i />Screening scenario</li>
            <li className="is-missing"><i />Measurement gap</li>
          </ul>
        </div>
        <div className="el-system-map">
          <div className="el-signal-field" aria-label="Retained environmental evidence streams">
            <div className="el-orbit" aria-hidden="true">
              <span className="el-orbit-ring is-outer" />
              <span className="el-orbit-ring is-inner" />
              <span className="el-orbit-core"><b>CO₂e</b><small>screening</small></span>
            </div>
            <ul className="el-streams">
              {routeStreams.map((stream) => (
                <li key={stream.id} data-stream={stream.id}>
                  <i aria-hidden="true" />
                  <span>{stream.label}</span>
                  <b>{stream.count}</b>
                  <small>retained routes</small>
                </li>
              ))}
            </ul>
          </div>
          <dl className="el-thesis-figures">
            <div>
              <dt>Retained source routes</dt>
              <dd>{routeCount}<span>14 snapshots + 2 household feeds</span></dd>
            </div>
            <div>
              <dt>Screening scenarios</dt>
              <dd>{carbon.estimates.length}<span>assumptions shown beside results</span></dd>
            </div>
            <div>
              <dt>Conversions withheld</dt>
              <dd>{carbon.unconverted.length}<span>turned into a measurement request</span></dd>
            </div>
          </dl>
        </div>
      </section>

      {view === 'ledger' && <LedgerView sections={sections} day={day} />}
      {view === 'estimates' && <EstimatesView carbon={carbon} day={day} />}
      {view === 'gaps' && <GapsView carbon={carbon} />}
      {view === 'actions' && <ActionsView carbon={carbon} sections={sections} day={day} />}
    </div>
  );
}

function LedgerView({ sections, day }: { sections: ReturnType<typeof getEnvironmentSections>; day: ReturnType<typeof segregationAtSource> }) {
  return (
    <>
      <section className="el-household" aria-labelledby="el-household-title">
        <header>
          <span className="el-kicker">Household grain · one complete day</span>
          <h3 id="el-household-title">Doorstep segregation is reported at ward-secretariat grain for one retained day</h3>
        </header>
        <div className="el-household-flow">
          <div>
            <b>{whole(day.households)}</b>
            <span>households in the retained denominator</span>
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

      {sections.map((section, index) => (
        <section className="el-section" data-section={section.id} key={section.id} aria-labelledby={`el-${section.id}`}>
          <header>
            <span className="el-section-index">0{index + 1}</span>
            <div>
              <h3 id={`el-${section.id}`}>{section.title}</h3>
              <p>{section.lede}</p>
            </div>
          </header>
          <div className="el-lines">
            {section.lines.map((line) => (
              <LineCard line={line} section={section.id} key={line.id} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function LineCard({ line, section }: { line: LedgerLine; section: 'diversion' | 'treatment' | 'sinks' }) {
  const filled = line.ratio === null ? null : Math.min(line.ratio, 1) * 100;
  const grainWord = line.grain === 'Facility' ? 'facilities' : line.grain === 'District' ? 'districts' : 'ULBs';
  const shortfall = line.polarity === 'shortfall';
  return (
    <article className={`el-line tone-${section}${shortfall ? ' is-shortfall' : ''}`}>
      <header>
        <div className="el-line-name">
          <span className="el-line-type">Reported · {line.grain}</span>
          <h4>{line.label}</h4>
          <p>
            {line.period ?? 'no reporting date in this response'} · retained {line.retainedAt}
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
        <b>Screening scenarios, not measured reductions.</b> {carbon.boundary}
      </p>

      <section className="el-bound" aria-labelledby="el-bound-title">
        <header>
          <span className="el-kicker">The physical constraint</span>
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
            <small>Nominal completed-status capacity / modelled wet waste</small>
            <b>{share(bound.coveredShare)}</b>
            <span>
              {bound.largestCompletedSite ? `${bound.largestCompletedSite} holds most of that capacity` : 'one period, one registry'}
            </span>
          </div>
        </div>
        <p className="el-boundary">
          Configured wet capacity across the whole registry is {qty(bound.configuredWetTpd)} TPD, numerically larger than the
          modelled tonnage. The source reports construction status and configured capacity, but no operation or throughput.
          The comparison therefore reveals a capacity constraint; it does not establish current diversion or avoided emissions.
        </p>
      </section>

      <section className="el-factor" aria-labelledby="el-factor-title">
        <h3 id="el-factor-title">The factor, written out</h3>
        <ol className="el-factor-steps">
          <li>
            <span>Methane potential for one tonne of wet compostable material at a deep unmanaged site</span>
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
            <span>Difference between the landfill-potential and compost-process defaults</span>
            <b>{carbon.factors.avoidedCentral.toFixed(2)} tCO2e per tonne</b>
          </li>
        </ol>
        <p className="el-boundary">
          The endpoints below are site-class scenarios, not a statistical confidence interval: {carbon.factors.landfillLow.toFixed(2)}{' '}
          tCO2e per tonne for a shallow unmanaged site and {carbon.factors.landfillHigh.toFixed(2)} for a managed anaerobic site.
          The centre uses the deep unmanaged-site default; every other parameter stays fixed.
        </p>
      </section>

      <div className="el-estimates">
        {carbon.estimates.map((estimate) => (
          <article className="el-estimate" key={estimate.id}>
            <header>
              <span className="el-scenario-label">Screening scenario</span>
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
              aria-label={`Site-class scenarios from ${whole(estimate.low)} to ${whole(estimate.high)} ${estimate.unit}, deep unmanaged-site scenario ${whole(estimate.central)}`}
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
                <dt>Scenario arithmetic</dt>
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
              None of these parameters was measured in the reporting ULBs. They are listed so a reviewer can replace a
              screening default with a local value and see exactly which result changes.
            </p>
          </div>
          <button type="button" className="el-toggle" aria-expanded={openAssumptions} onClick={() => setOpenAssumptions((open) => !open)}>
            {openAssumptions ? 'Hide the notes' : 'Show the notes'}
          </button>
        </header>
        <div className="el-assumption-grid" role="list" aria-label="Scenario assumptions and sources">
          {estimateAssumptions.map((assumption, index) => (
            <article
              role="listitem"
              key={assumption.id}
              data-undeclared={assumption.source.startsWith('Not declared') ? 'true' : undefined}
            >
              <header>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h4>{assumption.label}</h4>
              </header>
              <strong>{assumption.value}</strong>
              <p className="el-assumption-source"><span>Source</span>{assumption.source}</p>
              {openAssumptions && <p className="el-assumption-note">{assumption.note}</p>}
            </article>
          ))}
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
          Each line below starts with a retained reported quantity and names the measurement needed for a defensible conversion.
          The result is a practical data request rather than an invented carbon number.
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
        Weighbridge tonnage, facility uptime and wastewater organic load may already exist in operational systems, but they are
        absent from the retained routes reviewed here. The other conversions require local composition, survival or duty-cycle
        measurements. The physical ledger remains usable while those requests are resolved.
      </p>
    </>
  );
}

function ActionsView({
  carbon,
  sections,
  day,
}: {
  carbon: ReturnType<typeof getCarbonEstimates>;
  sections: ReturnType<typeof getEnvironmentSections>;
  day: ReturnType<typeof segregationAtSource>;
}) {
  const lines = sections.flatMap((section) => section.lines);
  const legacy = lines.find((line) => line.id === 'legacy-balance');
  const sewage = lines.find((line) => line.id === 'sewage');
  const green = lines.find((line) => line.id === 'green-cover');
  const bound = carbon.capacityBound;
  const legacyTopShare = legacy?.concentration?.share ?? null;

  const actions = [
    {
      id: 'measure',
      level: 'Foundation',
      title: 'Make tonnes and destinations auditable',
      evidence: `${qty(bound.completedWetTpd)} TPD is attached to facilities marked completed, but the routes return no operating status, uptime, throughput or destination balance.`,
      action: 'Connect daily weighbridge intake and output, operating hours, process route and reject destination to the facility registry. Reconcile collected tonnes to treated, recovered and disposed tonnes.',
      proof: 'A daily mass balance by facility with no unexplained tonnes.',
    },
    {
      id: 'methane',
      level: 'Highest climate leverage',
      title: 'Keep segregated organics out of unmanaged disposal',
      evidence: `${whole(day.segregated)} households reported segregation on the retained day. The screening model implies ${whole(bound.impliedWetTonnesPerDay)} TPD of wet waste against ${qty(bound.completedWetTpd)} TPD of completed-status wet capacity.`,
      action: 'Verify collection continuity, then commission and operate suitable composting or anaerobic-digestion capacity against measured local tonnage. Track contamination and rejected wet waste.',
      proof: 'Measured organic tonnes processed, contamination rate and verified residual destination.',
    },
    {
      id: 'legacy',
      level: 'Standing liability',
      title: 'Resolve the legacy-waste balance before claiming remediation benefit',
      evidence: `${qty(legacy?.reported ?? null)} source units remain across ${legacy?.reporting ?? 0} ULBs${legacyTopShare === null ? '' : `; the five largest balances hold ${share(legacyTopShare)}`}. The source does not declare the unit.`,
      action: 'Confirm tonnes versus volume, map dump age and depth, record excavated fractions and destinations, and measure methane, fire and leachate conditions at priority sites.',
      proof: 'Surveyed mass, site class and destination evidence for every remediated fraction.',
    },
    {
      id: 'water',
      level: 'Water and methane',
      title: 'Turn treatment capacity into treatment performance',
      evidence: `${qty(sewage?.reported ?? null)} MLD appears in the sewage programme, but no retained record reports an operating plant or treated volume.`,
      action: 'Add plant operation, inflow and outflow, BOD/COD, energy use, bypass events and sludge destination. Use load removed, not planned flow capacity, for climate accounting.',
      proof: 'Monthly organic load removed and electricity per unit treated.',
    },
    {
      id: 'green',
      level: 'Removal evidence',
      title: 'Measure survival and canopy, not planting length alone',
      evidence: `${qty(green?.reported ?? null)} km of planting is reported. Length does not establish tree count, survival, canopy or stored carbon.`,
      action: 'Geotag planting segments and record species, count, age, survival and canopy at repeat intervals. Keep water-body area and quality as separate environmental outcomes.',
      proof: 'Surviving trees and canopy change at a declared date, with a documented biomass method.',
    },
  ];

  return (
    <>
      <section className="el-action-intro" aria-labelledby="el-action-title">
        <div>
          <span className="el-kicker">Evidence to action</span>
          <h3 id="el-action-title">A credible route to lower emissions starts with measured operations</h3>
          <p>
            This pathway ranks what the retained sanitation evidence supports now. It is not a carbon-neutrality claim:
            municipality-wide neutrality also needs electricity, buildings, transport, procurement, refrigerants and other
            material emission sources inside a declared boundary.
          </p>
        </div>
        <div className="el-neutrality-mark" aria-label="Carbon neutrality can only be assessed after measured reductions and a complete residual inventory">
          <span>Measure</span><i />
          <span>Avoid</span><i />
          <span>Reduce</span><i />
          <span>Remove</span><i />
          <strong>Neutralise verified residuals last</strong>
        </div>
      </section>

      <section
        className="el-action-basis"
        aria-label="Current evidence constraint"
        style={{ '--el-capacity-share': `${Math.min(bound.coveredShare * 100, 100)}%` } as CSSProperties}
      >
        <div className="el-action-flow-copy">
          <span className="el-kicker">The first decision signal</span>
          <h3>The retained evidence points to an organics capacity and verification gap</h3>
          <p>
            Household reporting is converted into a wet-waste screening quantity, then compared with capacity attached to
            facilities marked completed. Neither side reports actual tonnes diverted.
          </p>
        </div>
        <div className="el-action-flow" role="img" aria-label={`${whole(bound.impliedWetTonnesPerDay)} tonnes per day modelled wet waste; ${qty(bound.completedWetTpd)} tonnes per day completed-status wet capacity; ${share(bound.coveredShare)} nominal capacity share`}>
          <div className="el-flow-origin">
            <small>Modelled wet-waste screening</small>
            <b>{whole(bound.impliedWetTonnesPerDay)}</b>
            <span>TPD</span>
          </div>
          <div className="el-flow-track" aria-hidden="true"><i /><em /></div>
          <div className="el-capacity-dial">
            <div><b>{share(bound.coveredShare)}</b><small>nominal share</small></div>
          </div>
          <div className="el-flow-capacity">
            <small>Completed-status wet capacity</small>
            <b>{qty(bound.completedWetTpd)} TPD</b>
          </div>
        </div>
        <div className="el-action-unknown">
          <span>Actual diversion</span>
          <b>Not measured</b>
          <p>Operating status, throughput, contamination and reject destinations are absent from the retained routes.</p>
        </div>
      </section>

      <ol className="el-actions">
        {actions.map((action, index) => (
          <li key={action.id} data-action={action.id}>
            <div className="el-action-number"><span>{String(index + 1).padStart(2, '0')}</span><small>{action.level}</small></div>
            <div className="el-action-copy">
              <h4>{action.title}</h4>
              <span>What the evidence says</span>
              <p>{action.evidence}</p>
            </div>
            <div className="el-action-do">
              <span>Recommended next move</span>
              <p>{action.action}</p>
            </div>
            <div className="el-action-proof">
              <span>Evidence of progress</span>
              <p>{action.proof}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="el-neutrality-boundary" aria-labelledby="el-neutrality-boundary-title">
        <div>
          <span className="el-kicker">What this product can support</span>
          <h3 id="el-neutrality-boundary-title">Sanitation-sector decisions with a visible evidence trail</h3>
          <p>Waste diversion, treatment, wastewater and green-asset measurements can become a verified sector account once the named gaps are filled.</p>
        </div>
        <div>
          <span className="el-kicker">What “carbon neutral” still requires</span>
          <p>A declared geography and base year; complete Scope 1 and 2 sources; material Scope 3 sources; reduction targets and delivery; independent verification; and transparent treatment of only the residual emissions that remain.</p>
        </div>
      </section>
    </>
  );
}
