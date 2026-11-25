'use client';

import {useMemo, type ReactNode} from 'react';
import {LAST_SOURCE_CHECK, getSasaGoals, goalShort, goalSummary, statusLabel, type GoalStatus, type SasaGoal} from '@/lib/sasa-goals';
import './sasa-goals.css';
import './overview-targets.css';

const ORDER: GoalStatus[] = ['short-after-deadline', 'before-deadline', 'met', 'tracked', 'different-measure', 'not-measured'];
const pct = (value: number) => `${value.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`;

/** One line pictogram per target, drawn in the app's icon style. */
const PICTOGRAMS: Record<string, ReactNode> = {
  collection: <><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></>,
  segregation: <><path d="M3.5 8h7.5M4.5 8l.8 11h4.4L10.5 8M13 8h7.5M14 8l.8 11h4.4L20 8M6 5.5h2.5M15.5 5.5h2.5"/></>,
  plastic: <><path d="M7 8h10l-1 12H8z"/><path d="M9.5 8a2.5 2.5 0 0 1 5 0"/><path d="M4 4l16 16"/></>,
  legacy: <><path d="M3 19h18"/><path d="M5 19c1-4 3-6 5-6s2-3 4-3 4 4 5 9"/><path d="m9 10 1-2M15 7l1-2"/></>,
  'bulk-generators': <><path d="M4 20V6l7-3v17M11 9h9v11M3 20h18M7 9h1M7 13h1M7 17h1M14 13h3M14 17h3"/></>,
  'odf-plus': <><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11Z"/><path d="m9 14 2 2 4-4"/></>,
  'green-cover': <><path d="M12 21v-6M9 21h6"/><path d="M12 15a5 5 0 0 1-5-5 5 5 0 0 1 5-7 5 5 0 0 1 5 7 5 5 0 0 1-5 5Z"/></>,
  compost: <><path d="M12 20v-7M6 20h12"/><path d="M12 13c0-3 2-5 6-5 0 3-2 5-6 5Z"/><path d="M12 15c0-2.5-1.7-4-5-4 0 2.5 1.7 4 5 4Z"/></>,
  roads: <><path d="M8 3 4 21M16 3l4 18M12 5v2M12 11v2M12 17v2"/></>,
  gvp: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z"/><path d="m10 8 4 4M14 8l-4 4"/></>,
  landfill: <><path d="m3 9 9-5 9 5-9 5z"/><path d="m3 14 9 5 9-5"/></>,
};

function Pictogram({id}: {id: string}) {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{PICTOGRAMS[id] ?? <circle cx="12" cy="12" r="7"/>}</svg>;
}

/** A bar only where the reading measures the target itself, so a nearer measure or a tracked count never reads as progress. */
const barShare = (goal: SasaGoal) => goal.reading?.share !== null && goal.reading?.share !== undefined && ['short-after-deadline', 'before-deadline', 'met'].includes(goal.status) ? goal.reading.share : null;
const noBar: Partial<Record<GoalStatus, string>> = {
  tracked: 'Tracked; no target set',
  'different-measure': 'Not the target’s own measure',
};

function TargetTile({goal, href}: {goal: SasaGoal; href: (path: string) => string}) {
  const reading = goal.reading;
  // The model's own wording, split for emphasis: "63.7%" over "of urban households".
  const [lead, ...rest] = reading ? reading.display.split(' ') : [];
  const share = barShare(goal);
  const showShare = share !== null && lead !== pct(share);
  return (
    <li className={`ovt-tile is-${goal.status}`}>
      <a href={`${href('/goals')}#goal-${goal.id}`}>
        <span className="ovt-tile-head"><span className="ovt-pict"><Pictogram id={goal.id}/></span><b>{goalShort[goal.id]}</b></span>
        <span className={`gr-chip is-${goal.status}`}><i aria-hidden="true"/>{statusLabel[goal.status]}</span>
        <span className="ovt-figure">{reading ? <><strong>{lead}</strong> <small>{rest.join(' ')}</small></> : <strong className="is-none">No data</strong>}</span>
        {share !== null
          ? <span className="ovt-bar"><i aria-hidden="true"><b style={{width: `${Math.max(1, Math.min(100, share))}%`}}/></i>{showShare && <small>{pct(share)} of the target reached</small>}</span>
          : <span className="ovt-bar is-empty"><i aria-hidden="true"/>{noBar[goal.status] && <small>{noBar[goal.status]}</small>}</span>}
        {/* A dated target says "Due"; a rule or an undated target shows its own label as stated. */}
        <span className="ovt-when">{goal.deadline && goal.status !== 'tracked' ? `Due ${goal.deadlineLabel}` : goal.deadlineLabel}{reading && <> · latest {reading.asOfLabel}</>}</span>
      </a>
    </li>
  );
}

/**
 * The overview's answer to "where do the targets stand?": the same goals model and statuses as
 * the SASA Goals screen, one tile per target. Nothing is re-derived here.
 */
export function OverviewTargets({href}: {href: (path: string) => string}) {
  const model = useMemo(() => getSasaGoals(), []);
  const summary = goalSummary(model.goals);
  const counts: Record<GoalStatus, number> = {
    'short-after-deadline': summary.shortAfterDeadline, 'before-deadline': summary.beforeDeadline, met: summary.met,
    tracked: summary.tracked, 'different-measure': summary.differentMeasure, 'not-measured': summary.notMeasured,
  };
  // The same order as the Goals list: the targets that need attention first, then by date.
  const sorted = useMemo(() => [...model.goals].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')), [model]);

  return (
    <section className="ov-targets sasa-goals" aria-labelledby="ov-targets-title">
      <div className="ovt-copy">
        <span className="ovt-kicker">Against the state&rsquo;s targets</span>
        <h2 id="ov-targets-title">{summary.total} stated targets, <em>each status read from dates and values.</em></h2>
        <ul className="ovt-tally" aria-label="Targets by status">
          {ORDER.filter((state) => counts[state] > 0).map((state) => (
            <li key={state}><b>{counts[state]}</b><span className={`gr-chip is-${state}`}><i aria-hidden="true"/>{statusLabel[state]}</span></li>
          ))}
        </ul>
        <p className="ovt-note">A reading taken before a target&rsquo;s date cannot show it was missed. Bars show how much of a target is reached, and only where the reading measures that target.</p>
        <div className="ovt-foot">
          <p className="ovt-fresh"><i aria-hidden="true"/>Data Lake checked {LAST_SOURCE_CHECK.date}: no newer month for these measures.</p>
          <a className="ovt-open" href={href('/goals')}>Open SASA Goals <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <ol className="ovt-tiles" aria-label="Every stated target">
        {sorted.map((goal) => <TargetTile key={goal.id} goal={goal} href={href}/>)}
      </ol>
    </section>
  );
}
