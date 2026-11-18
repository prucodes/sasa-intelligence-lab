'use client';

import type {CSSProperties, ReactNode} from 'react';
import type {HeroFigure, Pipeline, ScreenHeroData} from '@/lib/screen-heroes';
import type {AtlasModel} from '@/lib/ulb-atlas';
import {CountUp, useMotionClass} from './motion';
import './screen-hero.css';

/**
 * A screen's opening view: the page name, one accent line, up to four headline figures, and a
 * graphic drawn from the same data. It replaces a block of explanatory text, so a reader sees
 * the state of things before reading about it. A figure's meter, where it has one, is that
 * figure divided by the population its context names, never a different ratio.
 */
export function ScreenHero({data, visual, caption, actions, variant}: {data: ScreenHeroData; visual?: ReactNode; caption?: string; actions?: ReactNode; variant?: 'nature'}) {
  const root = useMotionClass<HTMLElement>();
  return (
    <section ref={root} className={`screen-hero${visual ? '' : ' is-plain'}${variant ? ` is-${variant}` : ''}`} aria-labelledby="screen-hero-title" data-still>
      <div className="sh-copy">
        <span className="eyebrow">{data.eyebrow}</span>
        <h1 id="screen-hero-title">{data.title}</h1>
        <p className="sh-accent">{data.accent}</p>
        <div className={`sh-figures count-${data.figures.length}`}>
          {data.figures.map((figure, index) => <Figure key={figure.label} figure={figure} index={index} />)}
        </div>
        {actions && <div className="sh-actions">{actions}</div>}
      </div>
      {visual && (
        <figure className="sh-visual">
          {visual}
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )}
    </section>
  );
}

function Figure({figure, index}: {figure: HeroFigure; index: number}) {
  return (
    <div className={`sh-figure tone-${figure.tone ?? 'plain'}`} style={{'--i': index} as CSSProperties}>
      <span className="sh-figure-label">{figure.label}</span>
      <strong><CountUp value={figure.value} decimals={figure.decimals ?? 0} prefix={figure.prefix ?? ''} suffix={figure.suffix ?? ''} /></strong>
      <small>{figure.context}</small>
      {typeof figure.meter === 'number' && <i aria-hidden="true"><b style={{width: `${Math.max(0, Math.min(100, figure.meter))}%`}} /></i>}
    </div>
  );
}

/* ----------------------------------------------------------------------------------------
   Graphics. Each draws real data at real positions; none is decoration.
   ---------------------------------------------------------------------------------------- */

/** Every placed ULB at its own collection and segregation rate, with the two 80% draft guides. */
export function MiniScatter({points}: {points: Array<{x: number; y: number; category: string}>}) {
  const W = 300, H = 220, L = 26, R = 292, T = 10, B = 196;
  const x = (v: number) => L + v / 100 * (R - L), y = (v: number) => B - v / 100 * (B - T);
  return (
    <svg className="sh-scatter" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${points.length} ULBs by collection reach and segregation, with draft guides at 80%`}>
      <rect className="sh-zone" x={x(80)} y={T} width={R - x(80)} height={y(80) - T} />
      {[0, 50, 100].map((t) => <g key={t}><line className="sh-grid" x1={L} x2={R} y1={y(t)} y2={y(t)} /><text className="sh-tick" x={L - 5} y={y(t) + 3} textAnchor="end">{t}%</text></g>)}
      <line className="sh-guide" x1={x(80)} x2={x(80)} y1={T} y2={B} /><line className="sh-guide" x1={L} x2={R} y1={y(80)} y2={y(80)} />
      <text className="sh-axis" x={(L + R) / 2} y={H - 4} textAnchor="middle">Collection reach →</text>
      {points.map((point, index) => (
        <circle key={index} className={`sh-dot cat-${point.category}`} cx={x(point.x)} cy={y(point.y)} r={3.2}
          style={{'--x': point.x / 100, '--rise': `${B - y(point.y)}px`} as CSSProperties} />
      ))}
    </svg>
  );
}

/** Every ULB as a column and every measure as a row, coloured by each value on its own scale. */
export function HeatStrip({model}: {model: AtlasModel}) {
  const ordered = [...model.ulbs].sort((a, b) => {
    const va = a.cells.reach?.state === 'value' ? a.cells.reach.value : -1, vb = b.cells.reach?.state === 'value' ? b.cells.reach.value : -1;
    return va - vb || a.name.localeCompare(b.name);
  });
  const cw = 2.6, ch = 13, gap = 3, left = 74;
  const width = left + ordered.length * cw, height = model.measures.length * (ch + gap);
  return (
    <svg className="sh-heat" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${model.ulbs.length} ULBs across ${model.measures.length} measures; darker is further along, hatched is held out, blank is not reported`}>
      <defs><pattern id="sh-hatch" width="3" height="3" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="3" stroke="var(--muted)" strokeWidth=".8" opacity=".55" /></pattern></defs>
      {model.measures.map((measure, row) => (
        <g key={measure.id} transform={`translate(0 ${row * (ch + gap)})`}>
          <text className="sh-heat-label" x={left - 6} y={ch - 3} textAnchor="end">{measure.short}</text>
          {ordered.map((ulb, column) => {
            const cell = ulb.cells[measure.id];
            const fill = cell?.state === 'value' ? cell.comparable ? `var(--sh-step-${cell.step})` : 'var(--muted)'  : cell?.state === 'held' ? 'url(#sh-hatch)' : 'transparent';
            return <rect key={ulb.code} className="sh-heat-cell" x={left + column * cw} y={0} width={cw - .5} height={ch} fill={fill} style={{'--x': column / ordered.length} as CSSProperties} />;
          })}
        </g>
      ))}
    </svg>
  );
}

/**
 * Each programme's reported stages as bars drawn to exact scale against the programme's own
 * first stage. A zero is marked, not drawn as a sliver; a split programme (parts of one total)
 * reads as parts of that total. No bar implies that one stage flows into the next.
 */
export function PipelineBars({pipelines, missing = [], missingPeriod}: {pipelines: Pipeline[]; missing?: string[]; missingPeriod?: string}) {
  return (
    <div className="sh-pipelines">
      {pipelines.map((pipeline, row) => {
        const base = pipeline.stages[0]?.value ?? 0;
        return (
          <div key={pipeline.label} className={`sh-pipeline is-${pipeline.kind}`} style={{'--row': row} as CSSProperties}>
            <div className="sh-pipeline-head"><b>{pipeline.label}</b><small>{pipeline.period}</small></div>
            {pipeline.stages.map((stage, index) => {
              const width = base > 0 ? Math.min(100, stage.value / base * 100) : 0;
              const short = index > 0 && base > 0 && stage.value / base < .5;
              return (
                <div key={stage.label} className={`sh-stage${short ? ' is-short' : ''}${index === 0 ? ' is-base' : ''}${stage.value === 0 ? ' is-zero' : ''}`} style={{'--i': row * 3 + index} as CSSProperties}>
                  <span>{stage.label}</span>
                  <i><b style={{width: `${width}%`}} /></i>
                  <em>{stage.value.toLocaleString('en-IN')}</em>
                </div>
              );
            })}
          </div>
        );
      })}
      {missing.map((label) => <div key={label} className="sh-pipeline is-missing"><div className="sh-pipeline-head"><b>{label}</b><small>No rows retained{missingPeriod ? ` for ${missingPeriod}` : ''}</small></div></div>)}
    </div>
  );
}

/** The readiness gates as segments of one ring: met, blocked, and those awaiting evidence that does not exist yet. */
export function GateRing({gates}: {gates: Array<{title: string; state: string}>}) {
  const r = 70, cx = 90, cy = 90, gapDeg = 5, seg = 360 / gates.length;
  const point = (deg: number) => [cx + r * Math.cos((deg - 90) * Math.PI / 180), cy + r * Math.sin((deg - 90) * Math.PI / 180)];
  const met = gates.filter((gate) => gate.state === 'met').length;
  return (
    <div className="sh-gates">
      <svg viewBox="0 0 180 180" role="img" aria-label={`${met} of ${gates.length} readiness gates met`}>
        {gates.map((gate, index) => {
          const [x1, y1] = point(index * seg + gapDeg / 2), [x2, y2] = point((index + 1) * seg - gapDeg / 2);
          return <path key={gate.title} className={`sh-gate is-${gate.state}`} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} style={{'--i': index} as CSSProperties}><title>{`${gate.title}: ${gate.state}`}</title></path>;
        })}
        <text className="sh-gates-figure" x={cx} y={cy + 4} textAnchor="middle">{met}/{gates.length}</text>
        <text className="sh-gates-label" x={cx} y={cy + 22} textAnchor="middle">gates met</text>
      </svg>
      <ul>
        {(['met', 'blocked', 'future'] as const).map((state) => (
          <li key={state} className={`is-${state}`}><i aria-hidden="true" />{state === 'future' ? 'Awaiting evidence' : state === 'met' ? 'Met' : 'Blocked'}<b>{gates.filter((gate) => gate.state === state).length}</b></li>
        ))}
      </ul>
    </div>
  );
}

/** Kept for callers: delivery is drawn as exact-scale stage bars, not a flow shape. */
export function DeliveryFunnels({pipelines}: {pipelines: Pipeline[]}) {
  return <PipelineBars pipelines={pipelines} />;
}
