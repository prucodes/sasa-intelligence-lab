'use client';

import {useMemo} from 'react';
import {LAST_SOURCE_CHECK, getSasaGoals, goalShort, goalSummary, statusLabel, type GoalStatus} from '@/lib/sasa-goals';
import {GoalTimeline} from './sasa-goals';
import './overview-targets.css';

const ORDER: GoalStatus[] = ['short-after-deadline', 'before-deadline', 'met', 'tracked', 'different-measure', 'not-measured'];

/**
 * The overview's answer to "where do the targets stand?": the same goals model, statuses and
 * calendar as the SASA Goals screen, so the two can never disagree. Nothing is re-derived here.
 */
export function OverviewTargets({href}: {href: (path: string) => string}) {
  const model = useMemo(() => getSasaGoals(), []);
  const summary = goalSummary(model.goals);
  const counts: Record<GoalStatus, number> = {
    'short-after-deadline': summary.shortAfterDeadline, 'before-deadline': summary.beforeDeadline, met: summary.met,
    tracked: summary.tracked, 'different-measure': summary.differentMeasure, 'not-measured': summary.notMeasured,
  };
  const below = model.goals.filter((goal) => goal.status === 'short-after-deadline' && goal.reading);

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
        {below.length > 0 && <ul className="ovt-below" aria-label="Below target after its date">
          {below.map((goal) => (
            <li key={goal.id} className="is-short-after-deadline">
              <a href={`${href('/goals')}#goal-${goal.id}`}>
                <b>{goalShort[goal.id]}</b>
                <span>{goal.reading!.display}, {goal.reading!.asOfLabel}</span>
                <small>Due {goal.deadlineLabel}</small>
              </a>
            </li>
          ))}
        </ul>}
        <div className="ovt-foot">
          <p className="ovt-fresh"><i aria-hidden="true"/>Data Lake checked {LAST_SOURCE_CHECK.date}: no newer month for these measures.</p>
          <a className="ovt-open" href={href('/goals')}>Open SASA Goals <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <figure className="ovt-calendar">
        <GoalTimeline goals={model.goals}/>
        <figcaption>Diamond: the target&rsquo;s date. Dot: its latest reading.</figcaption>
      </figure>
    </section>
  );
}
