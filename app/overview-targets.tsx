'use client';

import {useMemo, useState, type ReactNode} from 'react';
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

function PictogramPaths({id}: {id: string}) {
  return <>{PICTOGRAMS[id] ?? <circle cx="12" cy="12" r="7"/>}</>;
}

const ICON = {fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};

/** The pictogram inside a ring: filled to the share of the target reached, dashed where no reading measures the target. */
function Gauge({id, share}: {id: string; share: number | null}) {
  const r = 22, circumference = 2 * Math.PI * r;
  return (
    <svg className="ovt-gauge" width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      <circle className={`ovt-gauge-track${share === null ? ' is-empty' : ''}`} cx="26" cy="26" r={r} />
      {share !== null && <circle className="ovt-gauge-value" data-share={share} cx="26" cy="26" r={r} transform="rotate(-90 26 26)"
        strokeDasharray={`${(Math.max(1, Math.min(100, share)) / 100 * circumference).toFixed(2)} ${circumference.toFixed(2)}`} />}
      <svg x="14" y="14" width="24" height="24" viewBox="0 0 24 24" {...ICON}><PictogramPaths id={id}/></svg>
    </svg>
  );
}

/** A bar only where the reading measures the target itself, so a nearer measure or a tracked count never reads as progress. */
const barShare = (goal: SasaGoal) => goal.reading?.share !== null && goal.reading?.share !== undefined && ['short-after-deadline', 'before-deadline', 'met'].includes(goal.status) ? goal.reading.share : null;
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
 * The target wheel: one equal segment per target, coloured by status only, with its pictogram.
 * Segment size never encodes a value, so the wheel is a picture of the tally, not a chart of progress.
 */
function TargetWheel({goals, active, onPoint, summary}: {goals: SasaGoal[]; active: string | null; onPoint: (id: string | null) => void; summary: ReturnType<typeof goalSummary>}) {
  const cx = 150, cy = 150, outer = 142, inner = 96, step = (Math.PI * 2) / goals.length;
  const at = (r: number, angle: number) => [cx + r * Math.sin(angle), cy - r * Math.cos(angle)].map((value) => value.toFixed(2)).join(' ');
  const focus = goals.find((goal) => goal.id === active);
  const [lead, ...rest] = focus?.reading ? focus.reading.display.split(' ') : [];
  return (
    <figure className="ovt-wheel">
      <svg viewBox="0 0 300 300" role="img" aria-label={`${summary.total} stated targets: ${goals.map((goal) => `${goalShort[goal.id]}, ${statusLabel[goal.status].toLowerCase()}`).join('; ')}.`}>
        <defs>
          <pattern id="ovt-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="6" height="6" className="ovt-hatch-ground"/><line x1="0" y1="0" x2="0" y2="6" className="ovt-hatch-line"/></pattern>
        </defs>
        <circle className="ovt-wheel-halo" cx={cx} cy={cy} r={inner - 12}/>
        {goals.map((goal, index) => {
          const a0 = index * step, a1 = (index + 1) * step, mid = (a0 + a1) / 2;
          const d = `M${at(outer, a0)}A${outer} ${outer} 0 0 1 ${at(outer, a1)}L${at(inner, a1)}A${inner} ${inner} 0 0 0 ${at(inner, a0)}Z`;
          const [ix, iy] = at((outer + inner) / 2, mid).split(' ').map(Number);
          const shift = active === goal.id ? at(6, mid).split(' ').map((value, axis) => Number(value) - (axis ? cy : cx)) : [0, 0];
          return (
            <g key={goal.id} className={`ovt-seg is-${goal.status}${active === goal.id ? ' is-active' : ''}${active && active !== goal.id ? ' is-quiet' : ''}`}
              data-status={goal.status} style={{transform: `translate(${shift[0].toFixed(2)}px, ${shift[1].toFixed(2)}px)`}}
              onMouseEnter={() => onPoint(goal.id)} onMouseLeave={() => onPoint(null)}>
              <path d={d} className="ovt-seg-shape"/>
              {goal.status === 'not-measured' && <circle className="ovt-seg-plate" cx={ix} cy={iy} r="12"/>}
              <svg className="ovt-seg-icon" x={ix - 10} y={iy - 10} width="20" height="20" viewBox="0 0 24 24" {...ICON}><PictogramPaths id={goal.id}/></svg>
            </g>
          );
        })}
        <g className="ovt-wheel-centre" aria-hidden="true">
          {focus ? <>
            <text x={cx} y={cy - 28} className="ovt-c-name">{goalShort[focus.id]}</text>
            <text x={cx} y={cy + 4} className={`ovt-c-lead${focus.reading ? '' : ' is-none'}`}>{focus.reading ? lead : 'No data'}</text>
            {focus.reading && <text x={cx} y={cy + 23} className="ovt-c-rest">{rest.join(' ')}</text>}
            <text x={cx} y={cy + 45} className={`ovt-c-status is-${focus.status}`}>{statusLabel[focus.status]}</text>
          </> : <>
            <text x={cx} y={cy} className="ovt-c-total">{summary.total}</text>
            <text x={cx} y={cy + 21} className="ovt-c-rest">stated targets</text>
            <text x={cx} y={cy + 43} className="ovt-c-status is-short-after-deadline">{summary.shortAfterDeadline} below target</text>
            <text x={cx} y={cy + 58} className="ovt-c-status is-short-after-deadline">after their date</text>
          </>}
        </g>
      </svg>
    </figure>
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
