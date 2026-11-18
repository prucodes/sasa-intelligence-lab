'use client';

import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {askEvidence, checkFraming, evidenceScope, modelRecords, suggestedQuestions, type EvidenceAnswer, type EvidenceFact} from '@/lib/ask-evidence';
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
