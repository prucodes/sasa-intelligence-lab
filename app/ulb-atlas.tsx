'use client';

import {useMemo, useState} from 'react';
import {
  atlasCsv, districtMapRows, districtPlacements, getUlbAtlas, largestGaps, lookFirst, measureHeadline,
  type AtlasMeasure, type AtlasMeasureId, type AtlasModel, type AtlasUlb, type AtlasValue,
} from '@/lib/ulb-atlas';
import {DistrictMap} from './district-map';
import {CountUp, Reveal, useMotionClass} from './motion';
import './ulb-atlas.css';

type SortKey = AtlasMeasureId | 'name';

const FAMILY_ORDER = ['Service day', 'Delivery', 'Treatment works', 'Survey outcomes, 2024'] as const;
const whole = (n: number) => Math.round(n).toLocaleString('en-IN');

export function UlbAtlas({mode}: {mode: 'DEMO' | 'SAMPLE' | 'LIVE'}) {
  if (mode === 'SAMPLE') return <AtlasWorkspace />;
  return (
    <section className="atlas-unavailable" aria-labelledby="atlas-unavailable-title">
      <h2 id="atlas-unavailable-title">The atlas reads retained evidence only</h2>
      <p>{mode === 'DEMO' ? 'The Demo fixture is a synthetic story with no urban body codes in it, so there is nothing to line up.' : 'The Live connector is on the roadmap; until a response is retained there is no ULB to place.'}</p>
      <p>Switch the data mode to Governed data to open the atlas.</p>
    </section>
  );
}

/** Opens on the most completely reported ULB, the largest by households among those, so the dossier starts full. */
function defaultUlb(model: AtlasModel) {
  return [...model.ulbs].sort((a, b) => b.placed - a.placed || b.households - a.households)[0].code;
}

function AtlasWorkspace() {
  const model = useMemo(() => getUlbAtlas(), []);
  const [measureId, setMeasureId] = useState<AtlasMeasureId>('reach');
  const [selected, setSelected] = useState(() => defaultUlb(model));
  const [district, setDistrict] = useState('');
  const measure = model.measures.find((entry) => entry.id === measureId)!;
  const ulb = model.ulbs.find((entry) => entry.code === selected)!;
  const root = useMotionClass<HTMLDivElement>();
  return (
    <div className="atlas" ref={root}>
      <AtlasLead model={model} measure={measure} onMeasure={setMeasureId} selected={selected} onSelect={setSelected} district={district} onDistrict={setDistrict} />
      <AtlasMatrix model={model} measure={measure} onMeasure={setMeasureId} selected={ulb} onSelect={setSelected} district={district} onDistrict={setDistrict} />
      <AtlasDistricts model={model} district={district} onDistrict={setDistrict} />
      <AtlasJoin model={model} />
    </div>
  );
}

/* ----------------------------------------------------------------------------------------
   Lead: one measure, its statewide reading, and where it lands
   ---------------------------------------------------------------------------------------- */

function AtlasLead({model, measure, onMeasure, selected, onSelect, district, onDistrict}: {
  model: AtlasModel; measure: AtlasMeasure; onMeasure: (id: AtlasMeasureId) => void;
  selected: string; onSelect: (code: string) => void; district: string; onDistrict: (district: string) => void;
}) {
  const headline = measureHeadline(model, measure.id);
  const gaps = measure.gapLabel ? largestGaps(model, measure.id, 5) : [];
  const map = districtMapRows(model, measure.id);
  const placements = useMemo(() => districtPlacements(model), [model]);
  return (
    <section className="atlas-lead" aria-labelledby="atlas-lead-title">
      <header className="atlas-lead-head">
        <div>
          <span className="vi-kicker">One measure at a time · {model.stats.ulbs} ULBs</span>
          <h2 id="atlas-lead-title">{measure.label}</h2>
          <p>{measure.reads}. {measure.period}.</p>
        </div>
        <MeasurePicker model={model} value={measure.id} onChange={onMeasure} />
      </header>
      <div className="atlas-lead-grid">
        <div className="atlas-lead-map">
          {map ? (
            <DistrictMap rows={map.rows} selected={district} onSelect={onDistrict} title={map.title} unit="%" maximum={100} placements={placements} />
          ) : (
            <div className="atlas-unmapped">
              <span className="vi-kicker">Not mapped</span>
              <p>National ranks are not drawn by district. The response does not say which population category each rank is within, so a district median would mix ranks from different lists.</p>
              <Spread model={model} measure={measure} />
            </div>
          )}
        </div>
        <div className="atlas-lead-side atlas-swap" key={measure.id} aria-live="polite">
          <p className="atlas-statement">
            <b><CountUp value={headline.figure} decimals={headline.decimals} suffix={headline.suffix} /></b>
            <span>{headline.sentence}</span>
          </p>
          <div className="atlas-tiles">
            {headline.tiles.map((tile) => <div key={tile.label}><span>{tile.label}</span><strong>{tile.value}</strong><small>{tile.sub}</small></div>)}
          </div>
          <SelectedReadout model={model} measure={measure} code={selected} />
          {gaps.length > 0 ? (
            <div className="atlas-gaps">
              <h3>Largest shortfall, in {measure.gapLabel}</h3>
              <ol>
                {gaps.map(({ulb, cell}, index) => (
                  <li key={ulb.code} style={{'--i': index} as React.CSSProperties}>
                    <button type="button" onClick={() => onSelect(ulb.code)} aria-pressed={ulb.code === selected} aria-label={`${ulb.name}, ${ulb.district}: ${whole(cell.gap)} ${measure.gapLabel}. Open in the dossier.`}>
                      <span><b>{ulb.name}</b><small>{ulb.district}</small></span>
                      <em>{whole(cell.gap)}</em>
                      <i>{cell.display}</i>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="atlas-footnote">Counted in units, not ranked by rate: a large ULB at a high rate can still leave the most behind.</p>
            </div>
          ) : map && <Spread model={model} measure={measure} />}
          <p className="atlas-boundary">{measure.boundary}</p>
        </div>
      </div>
    </section>
  );
}

function SelectedReadout({model, measure, code}: {model: AtlasModel; measure: AtlasMeasure; code: string}) {
  const ulb = model.ulbs.find((entry) => entry.code === code);
  if (!ulb) return null;
  const cell = ulb.cells[measure.id];
  return (
    <a className="atlas-selected" href="#atlas-dossier">
      <span>Selected ULB</span>
      <b>{ulb.name}<small>{ulb.district}</small></b>
      <em>{cell?.state === 'value' ? cell.display : cell?.state === 'held' ? 'Held out' : 'Not reported'}</em>
      <i>Dossier ↓</i>
    </a>
  );
}

function MeasurePicker({model, value, onChange}: {model: AtlasModel; value: AtlasMeasureId; onChange: (id: AtlasMeasureId) => void}) {
  return (
    <div className="atlas-picker" role="radiogroup" aria-label="Measure">
      {FAMILY_ORDER.map((family) => (
        <div key={family} className="atlas-picker-family">
          <span>{family}</span>
          <div>
            {model.measures.filter((entry) => entry.family === family).map((entry) => (
              <button key={entry.id} type="button" role="radio" aria-checked={value === entry.id} onClick={() => onChange(entry.id)} title={entry.label}>{entry.short}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface Bin { label: string; count: number }
function valueBins(measure: AtlasMeasure, values: number[]): Bin[] {
  if (measure.kind === 'level') return measure.levels!.map((label, index) => ({label, count: values.filter((value) => Math.round(value) === index).length}));
  if (measure.kind === 'rank') {
    const max = Math.max(1, ...values), width = Math.ceil(max / 6);
    return Array.from({length: 6}, (_, index) => ({label: `#${(index * width + 1).toLocaleString('en-IN')}–${((index + 1) * width).toLocaleString('en-IN')}`, count: values.filter((value) => value > index * width && value <= (index + 1) * width).length}));
  }
  return Array.from({length: 5}, (_, index) => ({label: `${index * 20}–${index * 20 + 20}%`, count: values.filter((value) => Math.min(4, Math.floor(value / 20)) === index).length}));
}

function Spread({model, measure}: {model: AtlasModel; measure: AtlasMeasure}) {
  const values = model.ulbs.map((ulb) => ulb.cells[measure.id]).filter((cell): cell is AtlasValue => cell?.state === 'value').map((cell) => cell.value);
  const bins = valueBins(measure, values);
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <div className="atlas-spread">
      <h3>How the {measure.reporting} reporting ULBs spread</h3>
      <ul>
        {bins.map((bin, index) => (
          <li key={bin.label}>
            <span>{bin.label}</span>
            <i><Reveal as="b" className="meter" delay={index * 60} style={{width: `${bin.count / max * 100}%`}} /></i>
            <em>{bin.count}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------
   The table and the dossier
   ---------------------------------------------------------------------------------------- */

function sortValue(ulb: AtlasUlb, key: SortKey): number | null {
  if (key === 'name') return null;
  const cell = ulb.cells[key];
  if (cell?.state !== 'value') return null;
  return key === 'rank' ? -cell.value : cell.value;
}

function AtlasMatrix({model, measure, onMeasure, selected, onSelect, district, onDistrict}: {
  model: AtlasModel; measure: AtlasMeasure; onMeasure: (id: AtlasMeasureId) => void; selected: AtlasUlb; onSelect: (code: string) => void; district: string; onDistrict: (district: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<'behind' | 'ahead'>('behind');
  const [byName, setByName] = useState(false);
  // The table follows the measure chosen anywhere on the page; only an explicit name sort overrides it.
  const sortKey: SortKey = byName ? 'name' : measure.id;
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = model.ulbs.filter((ulb) => (!district || ulb.district === district) && (!needle || ulb.spellings.some((name) => name.toLowerCase().includes(needle)) || ulb.code.includes(needle)));
    return filtered.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      const va = sortValue(a, sortKey), vb = sortValue(b, sortKey);
      if (va === null && vb === null) return a.name.localeCompare(b.name);
      if (va === null) return 1;
      if (vb === null) return -1;
      return (direction === 'behind' ? va - vb : vb - va) || a.name.localeCompare(b.name);
    });
  }, [model, district, query, sortKey, direction]);
  const sortBy = (key: SortKey) => {
    if (key === 'name') { setByName(true); return; }
    setByName(false);
    if (key === measure.id && !byName) setDirection(direction === 'behind' ? 'ahead' : 'behind');
    else { setDirection('behind'); onMeasure(key); }
  };
  const exportCsv = () => {
    const blob = new Blob([atlasCsv(model, rows)], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), {href: url, download: `sasa-ulb-atlas${district ? `-${district.toLowerCase().replace(/[^a-z]+/g, '-')}` : ''}.csv`});
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const families = FAMILY_ORDER.map((family) => ({family, measures: model.measures.filter((entry) => entry.family === family)}));
  return (
    <section className="atlas-section" aria-labelledby="atlas-matrix-title">
      <header className="atlas-section-head">
        <div>
          <span className="vi-kicker">Every ULB, every measure</span>
          <h2 id="atlas-matrix-title">The atlas table</h2>
          <p>Each column is placed only against the ULBs that report it, from its own source and period. Nothing is added across columns, and there is no overall score.</p>
        </div>
        <div className="atlas-controls">
          <label><span>District</span><select value={district} onChange={(event) => onDistrict(event.target.value)} aria-label="Filter by district"><option value="">All {model.districts.length} districts</option>{model.districts.map((entry) => <option key={entry.district} value={entry.district}>{entry.district} · {entry.ulbs}</option>)}</select></label>
          <label><span>Find a ULB</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, any spelling, or code" aria-label="Find a ULB by name, spelling or code" /></label>
          <button type="button" className="atlas-export" onClick={exportCsv}>Download CSV · {rows.length} rows</button>
        </div>
      </header>
      <div className="atlas-matrix-layout">
        <div className="atlas-table-wrap" tabIndex={0} aria-label="Atlas table, scrolls sideways on small screens">
          <table className="atlas-table">
            <caption className="sr-only">ULBs by measure. Sorted by {sortKey === 'name' ? 'name' : model.measures.find((entry) => entry.id === sortKey)!.label}, {direction === 'behind' ? 'furthest behind first' : 'furthest along first'}.</caption>
            <thead>
              <tr className="atlas-family-row">
                <th rowSpan={2} scope="col"><button type="button" onClick={() => sortBy('name')} aria-sort={sortKey === 'name' ? 'ascending' : undefined}>ULB · {rows.length}</button></th>
                {families.map(({family, measures}) => <th key={family} colSpan={measures.length} scope="colgroup">{family}</th>)}
              </tr>
              <tr>
                {families.flatMap(({measures}) => measures).map((entry) => (
                  <th key={entry.id} scope="col" className={entry.id === sortKey ? 'is-sorted' : ''} aria-sort={entry.id === sortKey ? (direction === 'behind' ? 'ascending' : 'descending') : undefined}>
                    <button type="button" onClick={() => sortBy(entry.id)} title={`${entry.label}: ${entry.reads}`}>
                      {entry.short}<small>{entry.period}</small>{entry.id === sortKey && <i aria-hidden="true">{direction === 'behind' ? '↑' : '↓'}</i>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((ulb) => (
                <tr key={ulb.code} className={ulb.code === selected.code ? 'is-selected' : ''}>
                  <th scope="row"><button type="button" onClick={() => onSelect(ulb.code)} aria-pressed={ulb.code === selected.code}><b>{ulb.name}</b><small>{ulb.district} · {ulb.code}</small></button></th>
                  {families.flatMap(({measures}) => measures).map((entry) => <td key={entry.id}><MatrixCell ulb={ulb} measure={entry} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="atlas-empty">No ULB matches “{query}”{district ? ` in ${district}` : ''}.</p>}
        </div>
        <AtlasDossier model={model} ulb={selected} />
      </div>
      <ScaleKey />
    </section>
  );
}

function ScaleKey() {
  return (
    <div className="atlas-key" aria-label="Cell colour key">
      <span>Colour follows the value on its own scale</span>
      <span className="atlas-key-ramp">{[0, 1, 2, 3, 4].map((step) => <i key={step} className={`step-${step}`} aria-hidden="true" />)}<em>0% to 100%, or earliest stage to furthest</em></span>
      <span><i className="held" aria-hidden="true" />Held out, reason on hover</span>
      <span><i className="blank" aria-hidden="true" />Not reported</span>
    </div>
  );
}

function MatrixCell({ulb, measure}: {ulb: AtlasUlb; measure: AtlasMeasure}) {
  const cell = ulb.cells[measure.id];
  if (!cell) return <span className="atlas-cell none" title={`${ulb.name}: no ${measure.label.toLowerCase()} row carries this code`}><span aria-hidden="true">—</span><span className="sr-only">Not reported</span></span>;
  if (cell.state === 'held') return <span className="atlas-cell held" title={cell.reason}>Held</span>;
  return <span className={`atlas-cell step-${cell.step}`} title={`${measure.label}: ${cell.display}${cell.detail ? ` (${cell.detail})` : ''}. Ahead of ${cell.ahead} of ${cell.of - 1} others${cell.tied ? `; ${cell.tied} report the same` : ''}.`}>{cell.display}</span>;
}

function positionText(cell: AtlasValue): string {
  const others = cell.of - 1;
  const tie = cell.tied ? `; ${cell.tied} report the same` : '';
  return `Ahead of ${cell.ahead} of ${others} other${others === 1 ? '' : 's'}${tie}`;
}

function AtlasDossier({model, ulb}: {model: AtlasModel; ulb: AtlasUlb}) {
  const first = lookFirst(ulb, model);
  const others = ulb.spellings.slice(1);
  return (
    <aside id="atlas-dossier" className="atlas-dossier" aria-labelledby="atlas-dossier-title">
      <Reveal key={ulb.code} className="atlas-dossier-inner">
        <span className="vi-kicker">ULB dossier · code {ulb.code}</span>
        <h3 id="atlas-dossier-title">{ulb.name}</h3>
        <p className="atlas-dossier-meta">{ulb.district} · {whole(ulb.households)} households on the service day · {ulb.placed} of {model.stats.measures} measures placed</p>
        {others.length > 0 && <p className="atlas-spellings">Spelled <b>{others.join(', ')}</b> in another source. The code joins them; the name never had to.</p>}
        {first && (
          <div className="atlas-look-first">
            <span>Look first at</span>
            <b>{first.measure.label}</b>
            <small>{first.cell.display} · {positionText(first.cell)}</small>
          </div>
        )}
        <ol className="atlas-tracks">
          {model.measures.map((entry) => <TrackRow key={entry.id} model={model} measure={entry} ulb={ulb} />)}
        </ol>
        <p className="atlas-footnote">Each strip shows every ULB reporting that measure, further along to the right. The ringed dot is {ulb.name}; the tick is the median. Strips are not comparable with each other.</p>
      </Reveal>
    </aside>
  );
}

function TrackRow({model, measure, ulb}: {model: AtlasModel; measure: AtlasMeasure; ulb: AtlasUlb}) {
  const cell = ulb.cells[measure.id];
  const values = model.ulbs.map((entry) => entry.cells[measure.id]).filter((entry): entry is AtlasValue => entry?.state === 'value').map((entry) => entry.value);
  const max = measure.kind === 'rank' ? Math.max(1, ...values) : measure.kind === 'level' ? measure.levels!.length - 1 : 100;
  const min = measure.kind === 'rank' ? 1 : 0;
  // A rank is drawn reversed so that, on every strip, further along is to the right.
  const x = (value: number) => {
    const t = (value - min) / Math.max(1, max - min);
    return 6 + (measure.kind === 'rank' ? 1 - t : t) * 228;
  };
  const stacked = new Map<number, number>();
  return (
    <li className={cell?.state === 'value' ? '' : 'is-empty'}>
      <div className="atlas-track-head"><b>{measure.label}</b><span>{cell?.state === 'value' ? cell.display : cell?.state === 'held' ? 'Held out' : 'Not reported'}</span></div>
      <svg viewBox="0 0 240 26" aria-hidden="true" className="atlas-track">
        <line x1={6} x2={234} y1={13} y2={13} />
        {values.map((value, index) => {
          const key = Math.round(x(value));
          const stack = stacked.get(key) ?? 0;
          stacked.set(key, stack + 1);
          return <circle key={index} cx={x(value)} cy={13 + (stack % 2 ? 1 : -1) * Math.min(9, Math.ceil(stack / 2) * 2.2)} r={1.5} />;
        })}
        {measure.median !== null && <line className="median" x1={x(measure.median)} x2={x(measure.median)} y1={3} y2={23} />}
        {cell?.state === 'value' && <circle className={`me step-${cell.step}`} cx={x(cell.value)} cy={13} r={5} />}
      </svg>
      <small>{cell?.state === 'value' ? positionText(cell) : cell?.state === 'held' ? cell.reason : `No ${measure.label.toLowerCase()} row carries code ${ulb.code}`}{' · '}{measure.period}</small>
    </li>
  );
}

/* ----------------------------------------------------------------------------------------
   Districts and the join itself
   ---------------------------------------------------------------------------------------- */

function AtlasDistricts({model, district, onDistrict}: {model: AtlasModel; district: string; onDistrict: (district: string) => void}) {
  return (
    <section className="atlas-section" aria-labelledby="atlas-districts-title">
      <header className="atlas-section-head">
        <div>
          <span className="vi-kicker">Districts</span>
          <h2 id="atlas-districts-title">Each district’s median ULB, measure by measure</h2>
          <p>A median of the district’s reporting ULBs, so a district with one large ULB is not read as that ULB. Choose a district to filter the map and the table.</p>
        </div>
      </header>
      <div className="atlas-table-wrap" tabIndex={0} aria-label="District medians, scrolls sideways on small screens">
        <table className="atlas-table atlas-district-table">
          <thead>
            <tr>
              <th scope="col">District</th>
              {model.measures.map((entry) => <th key={entry.id} scope="col" title={entry.label}>{entry.short}<small>{entry.period}</small></th>)}
            </tr>
          </thead>
          <tbody>
            {model.districts.map((entry) => (
              <tr key={entry.district} className={entry.district === district ? 'is-selected' : ''}>
                <th scope="row"><button type="button" onClick={() => onDistrict(district === entry.district ? '' : entry.district)} aria-pressed={district === entry.district}><b>{entry.district}</b><small>{entry.ulbs} ULB{entry.ulbs === 1 ? '' : 's'}</small></button></th>
                {model.measures.map((measure) => {
                  const median = entry.medians[measure.id];
                  return <td key={measure.id}>{median ? <span className={`atlas-cell step-${median.step}`} title={`Median of ${median.reporting} reporting ULB${median.reporting === 1 ? '' : 's'}`}>{median.display}<sub>{median.reporting}</sub></span> : <span className="atlas-cell none"><span aria-hidden="true">—</span><span className="sr-only">No reporting ULB</span></span>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="atlas-footnote">The small number is how many of the district’s ULBs report that measure.</p>
    </section>
  );
}

function AtlasJoin({model}: {model: AtlasModel}) {
  const respelled = model.ulbs.filter((ulb) => ulb.spellings.length > 1);
  return (
    <section className="atlas-section atlas-join" aria-labelledby="atlas-join-title">
      <header className="atlas-section-head">
        <div>
          <span className="vi-kicker">How the atlas is joined</span>
          <h2 id="atlas-join-title">{whole(model.stats.placed)} of {whole(model.stats.cells)} cells carry a value</h2>
          <p>{model.stats.ulbs} ULBs × {model.stats.measures} measures. A cell is empty when no row carries that ULB’s code, and held out when a row does but the value cannot be read; every held cell states why. {model.stats.complete} ULBs carry a value on all {model.stats.measures}.</p>
        </div>
      </header>
      <div className="atlas-join-grid">
        <div className="atlas-coverage">
          <h3>Coverage by measure</h3>
          <ul>
            {model.measures.map((measure, index) => {
              const none = model.stats.ulbs - measure.reporting - measure.held;
              return (
                <li key={measure.id}>
                  <span>{measure.label}<small>{measure.period}</small></span>
                  <i role="img" aria-label={`${measure.reporting} placed, ${measure.held} held out, ${none} not reported`}>
                    <Reveal as="b" className="meter placed" delay={index * 70} style={{width: `${measure.reporting / model.stats.ulbs * 100}%`}} />
                    <Reveal as="b" className="meter held" delay={index * 70 + 120} style={{width: `${measure.held / model.stats.ulbs * 100}%`}} />
                  </i>
                  <em>{measure.reporting}<small>{measure.held ? ` +${measure.held} held` : ''}</small></em>
                  {measure.uncoded > 0 && <small className="atlas-uncoded">{measure.uncoded} source name{measure.uncoded === 1 ? '' : 's'} without the code{measure.uncodedRepeats ? `; ${measure.uncodedRepeats} repeat a coded row’s district, name and figures exactly` : ''}</small>}
                </li>
              );
            })}
          </ul>
          <div className="atlas-key"><span><i className="step-3" aria-hidden="true" />Placed</span><span><i className="held" aria-hidden="true" />Held out</span><span><i className="blank" aria-hidden="true" />Not reported</span></div>
        </div>
        <div className="atlas-respelled">
          <h3>{respelled.length} ULBs go by more than one name across the sources</h3>
          <p>A name join would have split each of these in two, or dropped one side. The code holds them together.</p>
          <ul>
            {respelled.map((ulb) => <li key={ulb.code}><b>{ulb.spellings[0]}</b><span aria-hidden="true">·</span><span className="sr-only">also spelled</span><i>{ulb.spellings.slice(1).join(' · ')}</i></li>)}
          </ul>
        </div>
        <div className="atlas-limits">
          <h3>What this atlas does not claim</h3>
          <ul>
            <li>No overall score. Measures come from different sources and periods, and none is added to another.</li>
            <li>The 2024 survey results are context. They predate the 2026 service day by two years and cannot show what 2026 delivery achieved.</li>
            <li>Toilet completion is delivery against the approved number, not sanitation coverage. A ULB with nothing approved has no rate.</li>
            <li>Plant progress is a construction stage. No sewage plant is reported operating, and the faecal sludge month cannot be established.</li>
            <li>Segregation is read as households, pending the department’s definition of the field.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
