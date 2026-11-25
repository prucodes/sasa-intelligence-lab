'use client';

import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {LAST_SOURCE_CHECK, getSasaGoals, goalShort, goalSummary, statusLabel, type Citation, type DistrictColumn, type DistrictGoalRow, type GoalStatus, type SasaGoal} from '@/lib/sasa-goals';
import type {ScreenHeroData} from '@/lib/screen-heroes';
import {ScreenHero} from './screen-hero';
import './sasa-goals.css';

const ORDER: GoalStatus[] = ['short-after-deadline', 'before-deadline', 'met', 'tracked', 'different-measure', 'not-measured'];
const list = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const lower = (id: string) => goalShort[id].replace(/^(\w)/, (letter) => letter.toLowerCase()).replace(/^oDF/, 'ODF');

/**
 * Swachha Andhra Swarna Andhra's stated targets against the retained evidence. The hero shows
 * when each target fell due beside when its latest reading was taken, because that order is what
 * decides whether a reading can say anything about the target at all.
 */
export function SasaGoalsScreen({href}: {href: (path: string) => string}) {
  const model = useMemo(() => getSasaGoals(), []);
  const summary = goalSummary(model.goals);
  const named = (state: GoalStatus) => model.goals.filter((goal) => goal.status === state).map((goal) => lower(goal.id));
  const latest = model.goals.map((goal) => goal.reading?.asOf ?? '').filter(Boolean).sort().at(-1) ?? '';
  const hero: ScreenHeroData = {
    eyebrow: 'Swachha Andhra Swarna Andhra',
    title: 'SASA Goals',
    accent: 'each stated target, read against the evidence retained.',
    figures: [
      {label: 'Stated targets', value: summary.total, context: 'from dated public reports; each links to its source'},
      {label: 'Below target after its date', value: summary.shortAfterDeadline, context: list(named('short-after-deadline')) || 'none', tone: 'warm'},
      {label: 'Read before its date', value: summary.beforeDeadline, context: `${list(named('before-deadline'))}; too early to call`},
      {label: 'No retained measure', value: summary.notMeasured, context: list(named('not-measured'))},
    ],
  };
  const sorted = [...model.goals].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));

  return (
    <div className="sasa-goals">
      <ScreenHero data={hero} visual={<GoalTimeline goals={model.goals} />} caption="◆ the date stated · ● the latest retained reading · shaded: when the readings were taken"
        actions={<><a href="#goals-brief">Read the brief ↓</a><a href="#goal-districts">District standing ↓</a></>} />

      <section className="goal-brief" id="goals-brief" aria-labelledby="goal-brief-title">
        <div className="gb-head">
          <span className="eyebrow">Brief</span>
          <h2 id="goal-brief-title">What the retained data says</h2>
          <small>Each sentence is computed from the readings below; latest reading {latest ? formatIso(latest) : 'not available'}</small>
          <p className="gb-fresh"><i aria-hidden="true" />Data Lake checked {LAST_SOURCE_CHECK.date}: {LAST_SOURCE_CHECK.found}. The readings stop where the source stops.</p>
        </div>
        <ul>
          {model.insights.map((insight) => (
            <li key={insight.id} className={`is-${model.goals.find((goal) => goal.id === insight.goalId)?.status}`}>
              <i aria-hidden="true" />
              <p>{insight.text}</p>
              <a href={`#goal-${insight.goalId}`} onClick={() => openGoal(insight.goalId)}>See the target</a>
              <Sources citations={insight.citations} />
            </li>
          ))}
        </ul>
      </section>

      <section className="goal-list" aria-labelledby="goal-list-title">
        <div className="gl-head">
          <h2 id="goal-list-title">Every target, one row each</h2>
          <p>A status comes from dates and values, never chosen. A reading taken before a target fell due cannot show it was missed, and a reading of a different measure is labelled as one.</p>
        </div>
        <div className="gl-rows">
          {sorted.map((goal) => <GoalRow key={goal.id} goal={goal} href={href} />)}
        </div>
      </section>

      <SwmView model={model} />

      <DistrictStanding model={model} />

      <section className="goal-themes" aria-labelledby="goal-themes-title">
        <div className="gl-head">
          <h2 id="goal-themes-title">Swachha Andhra Day themes</h2>
          <p>Each month&rsquo;s theme from a dated circular, beside the retained measure that speaks to it. The measure describes the programme around the theme, not the effect of the day.</p>
        </div>
        <ol className="gth-list">
          {model.themes.map((theme) => (
            <li key={theme.date}>
              <time dateTime={theme.date}>{theme.month}</time>
              <h3>{theme.theme}</h3>
              <p>{theme.meaning}</p>
              <small>{formatIso(theme.date)} · state event at {theme.venue}</small>
              <a className="gth-lens" href={theme.lens.href.startsWith('#') ? theme.lens.href : href(theme.lens.href)} onClick={() => theme.lens.goalId && openGoal(theme.lens.goalId)}>
                <span>{theme.lens.label}</span>
                <b>{theme.lens.display}</b>
                <small>{theme.lens.period}</small>
              </a>
              <a className="gth-source" href={theme.source.url} target="_blank" rel="noreferrer">{theme.source.publisher}</a>
            </li>
          ))}
        </ol>
        <p className="gth-gap">No dated circular was found for May to November 2026, so those months are left out rather than guessed.</p>
      </section>
    </div>
  );
}

function openGoal(id: string) {
  const node = document.getElementById(`goal-${id}`);
  if (node instanceof HTMLDetailsElement) node.open = true;
}

function formatIso(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

/* ------------------------------------------------------------------------------------------ */

const YEAR_START = Date.UTC(2026, 0, 1), YEAR_END = Date.UTC(2027, 0, 1);
const at = (iso: string) => {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Math.max(0, Math.min(100, (t - YEAR_START) / (YEAR_END - YEAR_START) * 100));
};

/**
 * Each 2026 target as a row on one calendar: the diamond is the date stated, the dot the latest
 * retained reading, and the line between them how far apart the two are. The shaded band is the
 * span in which every reading was taken. Targets for 2030, or with no date, are named below it.
 */
export function GoalTimeline({goals}: {goals: SasaGoal[]}) {
  const dated = goals.filter((goal) => goal.deadline && goal.deadline < '2027-01-01').sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  const later = goals.filter((goal) => !goal.deadline || goal.deadline >= '2027-01-01');
  const readings = dated.map((goal) => goal.reading?.asOf).filter((value): value is string => Boolean(value)).sort();
  const band = readings.length ? {left: at(readings[0]), width: Math.max(.8, at(readings.at(-1)!) - at(readings[0]))} : null;
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const describe = (goal: SasaGoal) => `${goalShort[goal.id]}: due ${goal.deadlineLabel}; ${goal.reading ? `latest reading ${goal.reading.asOfLabel}` : 'no retained measure'}; ${statusLabel[goal.status]}`;
  return (
    <div className="gt" role="img" aria-label={dated.map(describe).join('. ')}>
      <div className="gt-axis" aria-hidden="true"><span />{months.map((month, index) => <span key={index}>{month}</span>)}</div>
      <div className="gt-rows">
        {band && <div className="gt-plot" aria-hidden="true"><i className="gt-band" style={{left: `${band.left}%`, width: `${band.width}%`}} /></div>}
        {dated.map((goal, index) => {
          const due = at(goal.deadline!), read = goal.reading ? at(goal.reading.asOf) : null;
          return (
            <div key={goal.id} className={`gt-row is-${goal.status}`} style={{'--i': index} as CSSProperties} title={describe(goal)}>
              <span className="gt-label">{goalShort[goal.id]}</span>
              <div className="gt-track">
                {read !== null && <i className={`gt-gap${read < due ? ' is-early' : ''}`} style={{left: `${Math.min(due, read)}%`, width: `${Math.abs(read - due)}%`}} />}
                <b className="gt-due" style={{left: `${due}%`}} />
                {read !== null ? <b className="gt-read" style={{left: `${read}%`}} /> : <em style={{left: `${due}%`}}>no measure</em>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="gt-later">Later or undated: {later.map((goal) => `${lower(goal.id)} (${goal.deadline ? goal.deadlineLabel : 'no date'})`).join(', ')}</p>
      <ul className="gt-legend" aria-hidden="true">
        {(['short-after-deadline', 'before-deadline', 'tracked', 'different-measure'] as const).filter((state) => dated.some((goal) => goal.status === state)).map((state) => <li key={state} className={`is-${state}`}><i />{statusLabel[state]}</li>)}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

/** A reading that measures the target itself (or a step toward it) carries a bar; a different measure does not, so it cannot read as progress. */
const showsMeter = (goal: SasaGoal) => goal.reading?.share !== null && goal.reading?.share !== undefined && goal.status !== 'different-measure';

function GoalRow({goal, href}: {goal: SasaGoal; href: (path: string) => string}) {
  return (
    <details className={`goal-row is-${goal.status}`} id={`goal-${goal.id}`}>
      <summary>
        <span className="gr-what">
          <span className="gr-theme">{goal.theme}</span>
          <span className="gr-target">{goal.target}</span>
          <span className="gr-due">{goal.deadline ? `Due ${goal.deadlineLabel}` : goal.deadlineLabel}</span>
        </span>
        <span className="gr-reading">
          {goal.reading ? <><b>{goal.reading.display}</b><small>{goal.reading.asOfLabel}</small></> : <em>Nothing retained measures this</em>}
          {showsMeter(goal) && <i className="gr-meter"><b style={{width: `${Math.max(1, Math.min(100, goal.reading!.share!))}%`}} /></i>}
          {goal.reading && (goal.status === 'different-measure' ? <small className="gr-gap">No gap computed: a different measure</small> : goal.reading.gap && <small className="gr-gap">Gap: {goal.reading.gap}</small>)}
        </span>
        <span className={`gr-chip is-${goal.status}`}><i aria-hidden="true" />{statusLabel[goal.status]}</span>
      </summary>
      <div className="gr-body">
        {goal.reading && <p className="gr-detail">{goal.reading.detail}.</p>}
        <dl>
          <div><dt>What the reading shows</dt><dd>{goal.note}</dd></div>
          <div><dt>What would settle it</dt><dd>{goal.needs}</dd></div>
          <div><dt>Where the target was stated</dt><dd><a href={goal.source.url} target="_blank" rel="noreferrer">{goal.source.publisher}, {goal.source.date}</a><small>{goal.source.title}</small></dd></div>
          {goal.reading && <div><dt>Retained dataset</dt><dd><code>{goal.reading.dataset}</code></dd></div>}
        </dl>
        {goal.evidence && <a className="gr-evidence" href={goal.evidence.href.startsWith('#') ? goal.evidence.href : href(goal.evidence.href)}>Open {goal.evidence.label} {goal.evidence.href.startsWith('#') ? '↓' : '→'}</a>}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------------------------------ */

type Sort = {by: 'district' | DistrictColumn; dir: 1 | -1};
const step = (value: number) => Math.min(4, Math.floor(value / 20));

function DistrictStanding({model}: {model: ReturnType<typeof getSasaGoals>}) {
  const {rows, columns, respelled, unmatched} = model.districts;
  const [sort, setSort] = useState<Sort>({by: 'district', dir: 1});
  const ordered = useMemo(() => [...rows].sort((a, b) => {
    if (sort.by === 'district') return a.district.localeCompare(b.district) * sort.dir;
    const va = a[sort.by].value, vb = b[sort.by].value;
    if (va === null || vb === null) return va === vb ? a.district.localeCompare(b.district) : va === null ? 1 : -1;
    return (va - vb) * sort.dir || a.district.localeCompare(b.district);
  }), [rows, sort]);
  const choose = (by: Sort['by']) => setSort((current) => current.by === by ? {by, dir: current.dir === 1 ? -1 : 1} : {by, dir: by === 'district' ? 1 : -1});
  const ariaSort = (by: Sort['by']) => sort.by === by ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none';
  const heldDistricts = rows.filter((row) => row.collection.value === null).map((row) => row.district);
  // A district chosen on the overview map arrives as ?district=; its row is marked and brought into view.
  const [picked, setPicked] = useState<string | null>(null);
  const pickedRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the static page's URL after hydration */
    try {
      const name = new URLSearchParams(window.location.search).get('district');
      if (name && rows.some((row) => row.district === name)) setPicked(name);
    } catch { /* No district chosen. */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [rows]);
  useEffect(() => {
    if (picked) pickedRow.current?.scrollIntoView?.({block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }, [picked]);

  return (
    <section className="goal-districts" id="goal-districts" aria-labelledby="goal-districts-title">
      <div className="gl-head">
        <h2 id="goal-districts-title">District standing</h2>
        <p>Every district on each measurable target. Each column keeps its own source and period, so read down a column, not across a row. Shading is the value on that column&rsquo;s own 0&ndash;100% scale; legacy waste shades warmer where more is left.</p>
      </div>
      <div className="gd-scroll" tabIndex={0} aria-label="District standing table, scrolls sideways">
        <table>
          <caption className="sr-only">District standing on each measurable target</caption>
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort('district')}><button type="button" onClick={() => choose('district')}><span>District{sort.by === 'district' && <span aria-hidden="true"> {sort.dir === 1 ? '↑' : '↓'}</span>}</span><small>{rows.length} in the register</small></button></th>
              {columns.map((column) => (
                <th key={column.id} scope="col" aria-sort={ariaSort(column.id)}>
                  <button type="button" onClick={() => choose(column.id)} title={column.label}>
                    <span>{column.short}{sort.by === column.id && <span aria-hidden="true"> {sort.dir === 1 ? '↑' : '↓'}</span>}</span><small>{column.period}</small>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr key={row.district} ref={row.district === picked ? pickedRow : undefined} className={row.district === picked ? 'is-picked' : undefined} aria-current={row.district === picked ? 'true' : undefined}>
                <th scope="row">{row.district}{row.district === picked && <small className="gd-picked">from the map</small>}</th>
                {columns.map((column) => <Cell key={column.id} row={row} column={column.id} lowerIsBetter={column.better === 'lower'} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="gd-notes">
        {heldDistricts.length > 0 && <li><b>Blank collection and segregation</b> for {list(heldDistricts)}: {list(heldDistricts.map((district) => model.heldUlbs.filter((ulb) => ulb.district === district).map((ulb) => ulb.name).join(', ')))} {heldDistricts.length === 1 ? 'is' : 'are'} held out because the codes need review, the same rule the Atlas uses.</li>}
        {respelled.length > 0 && <li><b>Joined across spellings</b>: {list(respelled.map((entry) => `${entry.source} → ${entry.register}`))}, each the only register district its label resembles.</li>}
        {unmatched.length > 0 && <li><b>Not joined</b>: {list(unmatched.map((entry) => `${entry.source} (${entry.column.toLowerCase()})`))} resembles no register district by spelling, so its cell is blank rather than guessed.</li>}
        <li><b>Bulk generators</b> are a partial reading: only the secretariats retrieval returned for the day are counted, and missing ones are not zero.</li>
      </ul>
      <details className="gd-method">
        <summary>How each column is computed</summary>
        <dl>
          {columns.map((column) => (
            <div key={column.id}>
              <dt>{column.label}<small>{column.period} · {column.better === 'lower' ? 'lower is further along' : 'higher is further along'}</small></dt>
              <dd>{column.method}<code>{column.source}</code></dd>
            </div>
          ))}
        </dl>
        <p>There is no combined score. The department has not approved a weighting, so the columns are never added, averaged or ranked together.</p>
      </details>
    </section>
  );
}

function Cell({row, column, lowerIsBetter}: {row: DistrictGoalRow; column: DistrictColumn; lowerIsBetter: boolean}) {
  const cell = row[column];
  if (cell.value === null) return <td className="gd-empty" title={cell.detail}><span aria-hidden="true">—</span><span className="sr-only">{cell.detail}</span></td>;
  return (
    <td className={`gd-v ${lowerIsBetter ? 'is-lower' : ''} s-${step(cell.value)}`} title={cell.detail}>
      {cell.value.toLocaleString('en-IN', {minimumFractionDigits: column === 'plasticBan' ? 0 : 1, maximumFractionDigits: column === 'plasticBan' ? 0 : 1})}%
    </td>
  );
}

/* ------------------------------------------------------------------------------------------ */

/** The rows behind each figure in a brief sentence, folded away until asked for. */
function Sources({citations}: {citations: Citation[]}) {
  if (!citations.length) return null;
  return (
    <details className="gb-sources">
      <summary>Source records</summary>
      <ol>
        {citations.map((citation, index) => (
          <li key={`${citation.figure}-${index}`}>
            <p><b>{citation.figure}</b> {citation.basis}</p>
            <small>
              {citation.name !== citation.dataset ? `${citation.name} · ` : ''}{citation.period}{citation.retrieved ? ` · retrieved ${citation.retrieved}` : ''} · <code>{citation.dataset}</code> · <a href={citation.href} target="_blank" rel="noreferrer">Data Lake catalogue ↗</a>
            </small>
            {citation.rows && citation.rows.values.length > 0 && (
              <div className="gb-rows">
                <table>
                  <thead><tr>{citation.rows.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
                  <tbody>{citation.rows.values.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th key={cellIndex} scope="row">{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * Bulk waste generators under the SWM Rules 2026. Each district bar is drawn to one shared
 * scale of generators identified; the filled part is those processing wet waste on site.
 */
function SwmView({model}: {model: ReturnType<typeof getSasaGoals>}) {
  const swm = model.swm;
  const max = Math.max(1, ...swm.districts.map((district) => district.identified));
  const share = (part: number, whole: number) => (whole ? part / whole * 100 : 0);
  const fmt = (n: number) => n.toLocaleString('en-IN');
  const pctText = (n: number) => `${n.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`;
  const none = swm.districts.filter((district) => district.secretariats === 0);
  return (
    <section className="goal-swm" id="swm-rules" aria-labelledby="swm-title">
      <div className="gl-head">
        <h2 id="swm-title">Bulk waste generators under the SWM Rules 2026</h2>
        <p>The rules have applied since 1 April 2026. The data lake holds two daily secretariat feeds: generators identified, and generators processing wet waste on site. On-site processing is one way a generator can meet the rules and the feeds record no other, so a generator not processing on site is not shown as non-compliant.</p>
      </div>
      <div className="swm-grid">
        <div className="swm-stats">
          <div><span>Identified</span><strong>{fmt(swm.identified)}</strong><small>in the secretariats retained for {swm.day}</small></div>
          <div className="is-on"><span>Processing wet waste on site</span><strong>{fmt(swm.onSite)}</strong><small>{pctText(share(swm.onSite, swm.identified))} of those identified</small></div>
          <div><span>Secretariats retained</span><strong>{fmt(swm.secretariats)}</strong><small>of {fmt(swm.registerSecretariats)} in the register ({pctText(share(swm.secretariats, swm.registerSecretariats))}); the rest are missing, not zero</small><i aria-hidden="true"><b style={{width: `${share(swm.secretariats, swm.registerSecretariats)}%`}} /></i></div>
        </div>
        <div className="swm-districts">
          <div className="swm-key" aria-hidden="true"><span><i className="is-on" />processing on site</span><span><i />identified, not on site</span></div>
          <ul>
            {swm.districts.filter((district) => district.secretariats > 0).map((district) => (
              <li key={district.district} title={`${district.secretariats} of ${district.registerSecretariats} secretariats retained`}>
                <span className="swm-name" title={district.district}>{district.district}</span>
                <span className="swm-bar" role="img" aria-label={`${district.onSite} of ${district.identified} identified processing on site`}>
                  {district.identified > 0 && <i style={{width: `${district.identified / max * 100}%`}}><b style={{width: `${share(district.onSite, district.identified)}%`}} /></i>}
                </span>
                <span className="swm-value">{district.identified ? <><b>{fmt(district.onSite)}</b> of {fmt(district.identified)}</> : 'none identified'}</span>
              </li>
            ))}
          </ul>
          {none.length > 0 && <p className="swm-note">No secretariat retrieved for {swm.day} in {none.map((district) => district.district).join(', ')}.</p>}
        </div>
      </div>
      {swm.firstLook.length > 0 && (
        <div className="swm-first">
          <h3>Where to look first</h3>
          <p>{swm.noneOnSite} of the {swm.withIdentified} ULBs with generators identified report none processing on site. The five with the most identified:</p>
          <ul>
            {swm.firstLook.map((ulb) => <li key={ulb.code}><b>{ulb.name}</b><small>{ulb.district}</small><span>{fmt(ulb.identified)} identified, none on site</span></li>)}
          </ul>
        </div>
      )}
      <p className="swm-sources">Sources: {swm.sources.map((source, index) => <span key={source.key}>{index ? ' and ' : ''}<a href={source.href} target="_blank" rel="noreferrer">{source.name}</a></span>)}, retrieved {swm.retrieved}; {swm.ulbsRetained} of {swm.ulbsInRegister} ULBs have a retained secretariat that day.</p>
    </section>
  );
}
