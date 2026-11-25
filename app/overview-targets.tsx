'use client';

import {useMemo} from 'react';
import {LAST_SOURCE_CHECK, getSasaGoals, goalShort, goalSummary, statusLabel, type GoalStatus} from '@/lib/sasa-goals';
import './sasa-goals.css';
import './overview-targets.css';

const ORDER: GoalStatus[] = ['short-after-deadline', 'before-deadline', 'met', 'tracked', 'different-measure', 'not-measured'];

/**
 * The overview's answer to "where do the targets stand?": the same goals model and statuses as
 * the SASA Goals screen, as one plain line per target. Nothing is re-derived here.
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
        <p className="ovt-note">A reading taken before a target&rsquo;s date cannot show it was missed, and a reading of a different measure is labelled as one.</p>
        <div className="ovt-foot">
          <p className="ovt-fresh"><i aria-hidden="true"/>Data Lake checked {LAST_SOURCE_CHECK.date}: no newer month for these measures.</p>
          <a className="ovt-open" href={href('/goals')}>Open SASA Goals <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <ol className="ovt-list" aria-label="Every stated target">
        {sorted.map((goal) => (
          <li key={goal.id} className={`is-${goal.status}`}>
            <a href={`${href('/goals')}#goal-${goal.id}`}>
              <span className="ovt-row-head"><b>{goalShort[goal.id]}</b><span className={`gr-chip is-${goal.status}`}><i aria-hidden="true"/>{statusLabel[goal.status]}</span></span>
              <span className="ovt-row-facts">
                <span><small>{goal.status === 'tracked' ? 'Rule' : 'Due'}</small> {goal.deadlineLabel}</span>
                <span><small>Latest</small> {goal.reading ? `${goal.reading.display}, ${goal.reading.asOfLabel}` : 'None'}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
