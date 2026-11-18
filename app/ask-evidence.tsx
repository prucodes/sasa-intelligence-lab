'use client';

import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {askEvidence, checkFraming, evidenceScope, modelRecords, suggestedQuestions, type AnswerChart, type EvidenceAnswer, type EvidenceFact} from '@/lib/ask-evidence';
import {motionAllowed} from './motion';
import './ask-evidence.css';

/**
 * Ask the evidence. A side panel (a sheet on phones) where a reader asks about a place or a
 * measure and gets an answer assembled only from retained records, each with its source.
 *
 * When the build names a backend (NEXT_PUBLIC_ASK_EVIDENCE_URL), Claude may add one framing
 * sentence and choose the order of the records; the figures still come only from the records,
 * shown verbatim, and wording that carries a figure or a judgement is discarded.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_ASK_EVIDENCE_URL ?? '';

interface Written { framing: string; order: string[] }
interface Turn { id: number; question: string; answer: EvidenceAnswer; writing: boolean; written: Written | null; note: string | null }

export function AskEvidence({onClose, href}: {onClose: () => void; href: (path: string) => string}) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [closing, setClosing] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const counter = useRef(0);
  const scope = useMemo(() => evidenceScope(), []);
  const suggestions = useMemo(() => suggestedQuestions(), []);

  const close = useCallback(() => {
    if (!motionAllowed()) { onClose(); return; }
    setClosing(true);
    window.setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    input.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button, textarea, a[href], summary') ?? [])].filter((el) => el.getClientRects().length && !el.hasAttribute('disabled'));
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keys); previous?.focus(); };
  }, [close]);

  useEffect(() => {
    const node = thread.current?.lastElementChild;
    if (node && 'scrollIntoView' in node) (node as HTMLElement).scrollIntoView({block: 'start', behavior: motionAllowed() ? 'smooth' : 'auto'});
  }, [turns.length]);

  const ask = (text: string) => {
    const asked = text.trim();
    if (!asked) return;
    const answer = askEvidence(asked);
    const id = ++counter.current;
    const writing = Boolean(ENDPOINT) && answer.status === 'answered';
    setTurns((current) => [...current, {id, question: asked, answer, writing, written: null, note: null}]);
    setQuestion('');
    if (writing) void write(id, asked, answer);
  };

  const write = async (id: number, asked: string, answer: EvidenceAnswer) => {
    const records = modelRecords(answer);
    const finish = (patch: Partial<Turn>) => setTurns((current) => current.map((turn) => (turn.id === id ? {...turn, writing: false, ...patch} : turn)));
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20000);
      const response = await fetch(ENDPOINT, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({question: asked, records}), signal: controller.signal});
      window.clearTimeout(timer);
      if (!response.ok) { finish({note: 'Claude was unavailable, so the answer is assembled from the records directly.'}); return; }
      const body = await response.json() as {covered?: boolean; framing?: string; citations?: string[]};
      const known = new Set(records.map((record) => record.id));
      const order = (body.citations ?? []).filter((citation) => known.has(citation));
      const check = checkFraming(body.framing ?? '');
      if (!body.covered || !order.length) { finish({note: 'Claude found nothing in the records beyond the assembled answer.'}); return; }
      if (!check.ok) { finish({note: `Claude’s wording was not used: ${check.reason}.`}); return; }
      finish({written: {framing: body.framing!.trim(), order}});
    } catch {
      finish({note: 'Claude did not answer in time, so the answer is assembled from the records directly.'});
    }
  };

  const latest = turns.at(-1);
  const asked = new Set(turns.map((turn) => turn.question));
  const next = suggestions.filter((text) => !asked.has(text)).slice(0, 3);

  return (
    <div className={`ask-root${closing ? ' is-closing' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="ask-panel" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ask-title" aria-describedby="ask-scope">
        <i className="ask-grab" aria-hidden="true" />
        <header className="ask-head">
          <Orb />
          <div>
            <h2 id="ask-title">Ask the evidence</h2>
            <p>Answers only from retained records, each with its source</p>
          </div>
          <button type="button" className="ask-close" onClick={close} aria-label="Close evidence questions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>
        <ul className="ask-scope" id="ask-scope" aria-label="What the answers draw on">
          <li><b>{scope.ulbs}</b> ULBs</li>
          <li><b>{scope.districts}</b> districts</li>
          <li><b>{scope.measures}</b> Atlas measures</li>
          <li><b>{scope.facts.toLocaleString('en-IN')}</b> readings</li>
        </ul>

        <div className="ask-body">
          {!turns.length && (
            <div className="ask-welcome">
              <Orb large />
              <h3>What would you like to know?</h3>
              <p>Ask about a ULB, a district or a SASA target. Every figure comes from the same calculations as the screens, with its period attached.</p>
              <ul className="ask-suggestions">
                {suggestions.map((text, index) => (
                  <li key={text}><button type="button" onClick={() => ask(text)} style={{'--i': index} as CSSProperties}>
                    <span className="ask-topic" aria-hidden="true">{topicGlyph(text)}</span>
                    <span>{text}</span>
                    <svg className="ask-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button></li>
                ))}
              </ul>
            </div>
          )}
          <div className="ask-thread" ref={thread}>
            {turns.map((turn) => <TurnView key={turn.id} turn={turn} href={href} latest={turn === latest} />)}
          </div>
          {latest && !latest.writing && next.length > 0 && (
            <div className="ask-next">
              <span>Ask next</span>
              {next.map((text) => <button key={text} type="button" onClick={() => ask(text)}>{text}</button>)}
            </div>
          )}
        </div>

        <form className="ask-composer" onSubmit={(event) => { event.preventDefault(); ask(question); }}>
          <label htmlFor="evidence-question" className="sr-only">Your question</label>
          <div className="ask-field">
            <textarea id="evidence-question" ref={input} rows={1} value={question} maxLength={500} placeholder="Ask about a place or a target…"
              onChange={(event) => { setQuestion(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(120, event.target.scrollHeight)}px`; }}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(question); } }} />
            <button type="submit" className="ask-send" disabled={!question.trim()} aria-label="Ask"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg></button>
          </div>
          <p className="ask-foot">{ENDPOINT ? 'Claude may word the answer; every figure is a retained record, shown as recorded.' : 'Retained snapshots · no live lookup · no causes or forecasts'}</p>
        </form>
      </section>
    </div>
  );
}

function TurnView({turn, href, latest}: {turn: Turn; href: (path: string) => string; latest: boolean}) {
  const {answer, written} = turn;
  const found = answer.status !== 'not-found';
  const byId = new Map(answer.facts.map((fact) => [fact.id, fact]));
  const ordered: EvidenceFact[] = written ? written.order.map((id) => byId.get(id)).filter((fact): fact is EvidenceFact => Boolean(fact)) : [];
  const sources = [...new Map(answer.facts.map((fact) => [`${fact.dataset}|${fact.period}`, fact])).values()].slice(0, 4);
  const bars = answer.rows.filter((row) => row.value);
  // A short answer opens on its figures; the sentences beneath carry the counts and the scope.
  const tiles = !written && found && bars.length === 0 && answer.facts.length <= 4 ? answer.facts.filter((fact) => !fact.held && fact.display && fact.display.length <= 18) : [];
  const lines = answer.rows.filter((row) => !row.value);
  return (
    <article className={`ask-turn${latest ? ' is-latest' : ''}`}>
      <p className="ask-q">{turn.question}</p>
      <section className={`ask-a${found ? '' : ' is-clarify'}`} aria-live="polite" aria-label="Evidence answer">
        <div className="ask-a-head">
          <Orb small />
          <span>{turn.writing ? 'Reading the records…' : !found ? 'Needs a clearer question' : written ? 'Worded by Claude · figures as recorded' : 'From retained records'}</span>
        </div>
        {turn.writing && <div className="ask-shimmer" aria-hidden="true"><i /><i /><i /></div>}
        {!turn.writing && (
          <>
            {tiles.length > 0 && (
              <div className={`ask-tiles count-${tiles.length}`}>
                {tiles.map((fact, index) => (
                  <div key={fact.id} className="ask-tile" style={{'--i': index} as CSSProperties}>
                    <span>{fact.label}</span>
                    <strong>{fact.display}</strong>
                    <small>{fact.kind === 'state' ? fact.period : `${fact.subject} · ${fact.period}`}</small>
                  </div>
                ))}
              </div>
            )}
            {written ? <p className="ask-lead">{written.framing}</p> : <p className={`ask-lead${tiles.length ? ' is-detail' : ''}`}>{answer.lead}</p>}
            {written && ordered.length > 0 && <ul className="ask-lines">{ordered.map((fact) => <li key={fact.id}>{fact.sentence}</li>)}</ul>}
            {!written && lines.length > 0 && <ul className="ask-lines">{lines.map((row, index) => <li key={`${row.factId}-${index}`}>{row.label}</li>)}</ul>}
            {!written && bars.length > 0 && (
              <ol className="ask-rows">
                {bars.map((row, index) => (
                  <li key={`${row.factId}-${index}`} style={{'--i': index} as CSSProperties}>
                    <span className="ask-row-name">{row.label}{row.sub && <small>{row.sub}</small>}</span>
                    {typeof row.bar === 'number' ? <i className="ask-row-bar" aria-hidden="true"><b style={{width: `${row.bar}%`}} /></i> : <i className="ask-row-bar is-empty" aria-hidden="true" />}
                    <b className="ask-row-value">{row.value}</b>
                  </li>
                ))}
              </ol>
            )}
            {answer.charts?.map((chart, index) => <ChartView key={`${chart.kind}-${index}`} chart={chart} />)}
            {answer.notes.length > 0 && <div className="ask-notes">{answer.notes.map((note) => <p key={note}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>{note}</p>)}</div>}
            {turn.note && <p className="ask-model-note">{turn.note}</p>}
            {sources.length > 0 && (
              <div className="ask-sources">
                {sources.map((fact) => <span key={`${fact.dataset}|${fact.period}`} className="ask-chip" title={fact.dataset}><i aria-hidden="true" />{shortDataset(fact.dataset)}<small>{fact.period}</small></span>)}
              </div>
            )}
            {answer.facts.length > 0 && (
              <details className="ask-readings">
                <summary>Supporting readings <span>{answer.facts.length}</span></summary>
                <ol>
                  {answer.facts.map((fact) => (
                    <li key={fact.id}>
                      <b>{fact.label} · {fact.subject}</b>
                      <p>{fact.sentence}</p>
                      <small>{fact.period} · <code>{fact.dataset}</code></small>
                      <a href={href(fact.screen)}>Open evidence <span aria-hidden="true">↗</span></a>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </>
        )}
      </section>
    </article>
  );
}

/** The assistant's mark: a small lens of the SASA teal, drawn in CSS so it follows the theme. */
function Orb({large, small}: {large?: boolean; small?: boolean}) {
  return <span className={`ask-orb${large ? ' is-large' : ''}${small ? ' is-small' : ''}`} aria-hidden="true"><i /></span>;
}

function shortDataset(key: string) {
  const first = key.split(' + ')[0];
  const names: Record<string, string> = {
    msw_door_to_door_collection_api: 'Door-to-door collection', waste_egregation_api: 'Segregation', ihhl_new_identification_new1_api: 'Household toilets',
    fstps_stps_cotreatment_new1_api: 'FSTP progress', sewage_treated_qty_new1_api: 'Sewage plants', swacch_survekshan_info_new1_api: 'Swachh Survekshan 2024',
    sasa_100_percent_clearance_of_legacy_waste_api: 'Legacy waste clearance', sasa_cdma_ulbs_single_use_plastic_ban_api: 'Plastic ban',
    identification_of_bulk_waste_generators_api: 'Bulk waste generators', onsite_processing_of_wet_waste_bwg_api: 'Bulk generators on site',
    sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026: 'Rural door-to-door collection', waste_segregation_api: 'Segregation',
  };
  return names[first] ?? first.replace(/_api$/, '').replace(/_/g, ' ');
}

function topicGlyph(text: string): ReactNode {
  const t = text.toLowerCase();
  const path = t.includes('legacy') ? <><path d="M4 18h16" /><path d="M6 18l3-6 3 3 3-5 3 8" /></>
    : t.includes('toilet') ? <><path d="M4 11l8-6 8 6" /><path d="M6 10v9h12v-9" /></>
    : t.includes('bulk') ? <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>
    : t.includes('target') || t.includes('plastic') ? <><path d="M6 21V4" /><path d="M6 4h10l-2 4 2 4H6" /></>
    : <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>;
  return <svg viewBox="0 0 24 24">{path}</svg>;
}

/* ------------------------------------------------------------------------------------------
   Charts. Each draws only the facts named in its caption, at their real values; the readout
   under it gives the exact figure for whatever the reader points at.
   ------------------------------------------------------------------------------------------ */

const W = 320;
const pctText = (value: number) => `${value.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`;

function ChartView({chart}: {chart: AnswerChart}) {
  const [readout, setReadout] = useState<string | null>(null);
  const initial = chart.kind === 'line'
    ? chart.series.filter((entry) => entry.highlight).map((entry) => `${entry.label} ${pctText(entry.values.at(-1) ?? 0)} in ${chart.x.at(-1)}`).join(' · ')
    : (chart.kind === 'strip' ? chart.points : chart.bars).filter((point) => point.highlight).slice(0, 3).map((point) => `${titleCase(point.label)} ${pctText(point.value)}`).join(' · ');
  return (
    <figure className={`ask-chart is-${chart.kind}`}>
      <figcaption><b>{chart.title}</b><small>{chart.caption}</small></figcaption>
      {chart.kind === 'strip' && <Strip chart={chart} onPoint={setReadout} />}
      {chart.kind === 'columns' && <Columns chart={chart} onPoint={setReadout} />}
      {chart.kind === 'line' && <Line chart={chart} onPoint={setReadout} />}
      {chart.kind === 'line' && chart.series.length > 1 && (
        <ul className="ask-legend">
          {chart.series.map((entry, index) => <li key={entry.label} className={index === 0 && !entry.highlight ? 'is-ref' : `is-s${Math.min(3, chart.series.slice(0, index + 1).filter((item) => item.highlight).length)}`}><i aria-hidden="true" />{entry.label}</li>)}
        </ul>
      )}
      <p className="ask-readout" aria-live="polite">{readout ?? (initial || 'Point at a mark for its value')}</p>
    </figure>
  );
}

const titleCase = (text: string) => (text === text.toUpperCase() ? text.toLowerCase().replace(/(^|[\s(])(\w)/g, (_, gap: string, letter: string) => gap + letter.toUpperCase()) : text);

function useNearest<T>(items: T[], xOf: (item: T) => number, onPoint: (text: string | null) => void, text: (item: T) => string) {
  return {
    onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width * W;
      let best: T | null = null, distance = Infinity;
      for (const item of items) { const d = Math.abs(xOf(item) - x); if (d < distance) { distance = d; best = item; } }
      onPoint(best ? text(best) : null);
    },
    onPointerLeave: () => onPoint(null),
  };
}

function Strip({chart, onPoint}: {chart: Extract<AnswerChart, {kind: 'strip'}>; onPoint: (text: string | null) => void}) {
  const L = 14, R = W - 14, base = 66, x = (value: number) => L + value / 100 * (R - L);
  // Dots with the same whole percentage stack upward; a tall stack is compressed so it fits.
  const buckets = new Map<number, number>();
  const placed = chart.points.map((point) => {
    const key = Math.round(point.value);
    const k = buckets.get(key) ?? 0; buckets.set(key, k + 1);
    return {...point, k, key};
  });
  const step = (key: number) => Math.min(5.2, 44 / Math.max(1, buckets.get(key) ?? 1));
  const ordered = [...placed].sort((a, b) => Number(a.highlight) - Number(b.highlight));
  const marks = useNearest(placed, (point) => x(point.value), onPoint, (point) => `${titleCase(point.label)} · ${pctText(point.value)}`);
  return (
    <svg viewBox={`0 0 ${W} 92`} role="img" aria-label={`${chart.points.length} values from 0 to 100%; median ${chart.median === null ? 'not defined' : pctText(chart.median)}`} {...marks}>
      {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line className="ak-grid" x1={x(tick)} x2={x(tick)} y1={18} y2={base + 4} /><text className="ak-tick" x={x(tick)} y={86} textAnchor="middle">{tick}%</text></g>)}
      <line className="ak-axis" x1={L} x2={R} y1={base + 4} y2={base + 4} />
      {chart.median !== null && <g><line className="ak-median" x1={x(chart.median)} x2={x(chart.median)} y1={12} y2={base + 4} /><text className="ak-median-label" x={x(chart.median)} y={9} textAnchor="middle">median {pctText(chart.median)}</text></g>}
      {ordered.map((point, index) => (
        <circle key={`${point.label}-${index}`} className={point.highlight ? 'ak-dot is-hl' : 'ak-dot'} cx={x(point.value)} cy={base - point.k * step(point.key)} r={point.highlight ? 4.2 : 2.5} style={{'--d': point.value / 100} as CSSProperties}>
          <title>{`${titleCase(point.label)}: ${pctText(point.value)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Columns({chart, onPoint}: {chart: Extract<AnswerChart, {kind: 'columns'}>; onPoint: (text: string | null) => void}) {
  const L = 26, R = W - 6, T = 10, B = 104, n = chart.bars.length;
  const top = Math.max(5, Math.ceil(Math.max(...chart.bars.map((bar) => bar.value)) / 5) * 5);
  const y = (value: number) => B - value / top * (B - T);
  const slot = (R - L) / n, width = Math.max(2, slot - 2.5);
  const xOf = (index: number) => L + index * slot + slot / 2;
  const indexed = chart.bars.map((bar, index) => ({...bar, index}));
  const marks = useNearest(indexed, (bar) => xOf(bar.index), onPoint, (bar) => `${titleCase(bar.label)} · ${pctText(bar.value)}`);
  return (
    <svg viewBox={`0 0 ${W} 124`} role="img" aria-label={`${n} districts from ${pctText(chart.bars[0].value)} down to ${pctText(chart.bars.at(-1)!.value)}`} {...marks}>
      {[0, top / 2, top].map((tick) => <g key={tick}><line className="ak-grid" x1={L} x2={R} y1={y(tick)} y2={y(tick)} /><text className="ak-tick" x={L - 4} y={y(tick) + 3} textAnchor="end">{tick.toLocaleString('en-IN', {maximumFractionDigits: 1})}%</text></g>)}
      {chart.median !== null && <line className="ak-median" x1={L} x2={R} y1={y(chart.median)} y2={y(chart.median)} />}
      {indexed.map((bar) => (
        <rect key={bar.label} className={bar.highlight ? 'ak-col is-hl' : 'ak-col'} x={xOf(bar.index) - width / 2} y={y(bar.value)} width={width} height={Math.max(0, B - y(bar.value))} rx={Math.min(2, width / 2)} style={{'--d': bar.index / n} as CSSProperties}>
          <title>{`${titleCase(bar.label)}: ${pctText(bar.value)}`}</title>
        </rect>
      ))}
      {indexed.filter((bar) => bar.value === 0).map((bar) => <line key={`z-${bar.label}`} className="ak-zero" x1={xOf(bar.index) - width / 2} x2={xOf(bar.index) + width / 2} y1={B} y2={B} />)}
      <line className="ak-axis" x1={L} x2={R} y1={B} y2={B} />
      {spaced(indexed.filter((bar) => bar.highlight).map((bar) => ({bar, x: Math.min(R - 30, Math.max(L + 30, xOf(bar.index)))})), 64).map(({bar, x: at}) => <text key={`l-${bar.label}`} className="ak-col-label" x={at} y={118} textAnchor="middle">{titleCase(bar.label)}</text>)}
    </svg>
  );
}

/** Keeps labels at least `gap` apart, first come first kept, so neighbouring names never overprint. */
function spaced<T extends {x: number}>(labels: T[], gap: number): T[] {
  const kept: T[] = [];
  for (const label of labels) if (kept.every((other) => Math.abs(other.x - label.x) >= gap)) kept.push(label);
  return kept.slice(0, 3);
}

function Line({chart, onPoint}: {chart: Extract<AnswerChart, {kind: 'line'}>; onPoint: (text: string | null) => void}) {
  const L = 34, R = W - 46, T = 12, B = 108;
  const values = chart.series.flatMap((entry) => entry.values.filter((value): value is number => value !== null));
  const lo = Math.floor(Math.min(...values) - 2), hi = Math.ceil(Math.max(...values) + 2);
  const x = (index: number) => L + (chart.x.length === 1 ? 0 : index / (chart.x.length - 1)) * (R - L);
  const y = (value: number) => B - (value - lo) / (hi - lo) * (B - T);
  const path = (series: Array<number | null>) => series.reduce((d, value, index) => value === null ? d : `${d}${d && series[index - 1] !== null ? ' L' : ' M'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`, '').trim();
  const tone = (index: number) => (index === 0 && !chart.series[0].highlight ? 'is-ref' : `is-s${Math.min(3, chart.series.slice(0, index + 1).filter((entry) => entry.highlight).length)}`);
  const months = chart.x.map((label, index) => ({label, index}));
  const marks = useNearest(months, (month) => x(month.index), onPoint, (month) => `${month.label}: ${chart.series.map((entry) => `${entry.label} ${entry.values[month.index] === null ? 'not retained' : pctText(entry.values[month.index]!)}`).join(' · ')}`);
  const ticks = [lo, (lo + hi) / 2, hi];
  // End values sit beside the last point; close ones are nudged apart so they never overprint.
  const endLabels = chart.series.flatMap((entry) => { const last = entry.values.at(-1); return last === null || last === undefined ? [] : [{key: entry.label, value: last, y: y(last)}]; }).sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) if (endLabels[i].y - endLabels[i - 1].y < 10) endLabels[i].y = endLabels[i - 1].y + 10;
  return (
    <svg viewBox={`0 0 ${W} 128`} role="img" aria-label={chart.series.map((entry) => `${entry.label}: ${entry.values.map((value, index) => `${chart.x[index]} ${value === null ? 'not retained' : pctText(value)}`).join(', ')}`).join('; ')} {...marks}>
      {ticks.map((tick) => <g key={tick}><line className="ak-grid" x1={L} x2={R} y1={y(tick)} y2={y(tick)} /><text className="ak-tick" x={L - 5} y={y(tick) + 3} textAnchor="end">{tick.toLocaleString('en-IN', {maximumFractionDigits: 1})}%</text></g>)}
      {chart.x.map((label, index) => <text key={label} className="ak-tick" x={x(index)} y={122} textAnchor="middle">{label}</text>)}
      {chart.series.map((entry, index) => (
        <g key={entry.label} className={`ak-series ${tone(index)}`}>
          <path className="ak-line" d={path(entry.values)} pathLength={1} />
          {entry.values.map((value, point) => value === null ? null : <circle key={point} className="ak-point" cx={x(point)} cy={y(value)} r={entry.highlight ? 3.2 : 2.4}><title>{`${entry.label}, ${chart.x[point]}: ${pctText(value)}`}</title></circle>)}
        </g>
      ))}
      {endLabels.map((label) => <text key={label.key} className="ak-end" x={R + 6} y={label.y + 3}>{pctText(label.value)}</text>)}
    </svg>
  );
}
