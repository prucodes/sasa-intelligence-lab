'use client';

import {useMemo, useState} from 'react';
import {Gauge, TargetWheel, barShare} from './target-graphics';
import {LAST_SOURCE_CHECK, getSasaGoals, goalShort, goalSummary, statusLabel, type GoalStatus, type SasaGoal} from '@/lib/sasa-goals';
import './sasa-goals.css';
import './overview-targets.css';

const ORDER: GoalStatus[] = ['short-after-deadline', 'before-deadline', 'met', 'tracked', 'different-measure', 'not-measured'];
const pct = (value: number) => `${value.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`;

const noBar: Partial<Record<GoalStatus, string>> = {
  tracked: 'Tracked; no target set',
  'different-measure': 'Not the target’s own measure',
};

function TargetTile({goal, href, active, onPoint}: {goal: SasaGoal; href: (path: string) => string; active: boolean; onPoint: (id: string | null) => void}) {
  const reading = goal.reading;
  // The model's own wording, split for emphasis: "63.7%" over "of urban households".
  const [lead, ...rest] = reading ? reading.display.split(' ') : [];
  const share = barShare(goal);
  const caption = share !== null ? (lead !== pct(share) ? `${pct(share)} of the target reached` : null) : noBar[goal.status] ?? null;
  return (
    <li className={`ovt-tile is-${goal.status}${active ? ' is-active' : ''}`}>
      <a href={`${href('/goals')}#goal-${goal.id}`} onMouseEnter={() => onPoint(goal.id)} onMouseLeave={() => onPoint(null)} onFocus={() => onPoint(goal.id)} onBlur={() => onPoint(null)}>
        <span className="ovt-tile-head">
          <Gauge id={goal.id} share={share}/>
          <span className="ovt-tile-name"><b>{goalShort[goal.id]}</b><span className={`gr-chip is-${goal.status}`}><i aria-hidden="true"/>{statusLabel[goal.status]}</span></span>
        </span>
        <span className="ovt-figure">{reading ? <><strong>{lead}</strong> <small>{rest.join(' ')}</small></> : <strong className="is-none">No data</strong>}</span>
        {caption && <small className="ovt-caption">{caption}</small>}
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
  // Pointing at a wheel segment or a tile marks both, and the wheel's centre names the target.
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="ov-targets sasa-goals" aria-labelledby="ov-targets-title">
      <TargetWheel goals={sorted} active={active} onPoint={setActive} summary={summary}/>
      <div className="ovt-copy">
        <span className="ovt-kicker">Against the state&rsquo;s targets</span>
        <h2 id="ov-targets-title">{summary.total} stated targets, <em>each status read from dates and values.</em></h2>
        <ul className="ovt-tally" aria-label="Targets by status">
          {ORDER.filter((state) => counts[state] > 0).map((state) => (
            <li key={state}><b>{counts[state]}</b><span className={`gr-chip is-${state}`}><i aria-hidden="true"/>{statusLabel[state]}</span></li>
          ))}
        </ul>
        <p className="ovt-note">A reading taken before a target&rsquo;s date cannot show it was missed. Each wheel segment is one target, coloured by its status. A ring fills to the share of a target reached, and only where the reading measures that target.</p>
        <div className="ovt-foot">
          <p className="ovt-fresh"><i aria-hidden="true"/>Data Lake checked {LAST_SOURCE_CHECK.date}: no newer month for these measures.</p>
          <a className="ovt-open" href={href('/goals')}>Open SASA Goals <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <ol className="ovt-tiles" aria-label="Every stated target">
        {sorted.map((goal) => <TargetTile key={goal.id} goal={goal} href={href} active={active === goal.id} onPoint={setActive}/>)}
      </ol>
    </section>
  );
}
