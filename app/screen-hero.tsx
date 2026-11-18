'use client';

import type {CSSProperties, ReactNode} from 'react';
import type {HeroFigure, Pipeline, ScreenHeroData} from '@/lib/screen-heroes';
import type {AtlasModel} from '@/lib/ulb-atlas';
import {CountUp, useMotionClass} from './motion';
import './screen-hero.css';

/**
 * A screen's opening view: the page name, one accent line, up to four headline figures that
 * count up, and a graphic drawn from the same data. It replaces a block of explanatory text,
 * so a reader sees the state of things before reading about it.
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
      {typeof figure.meter === 'number' && <i aria-hidden="true"><b style={{width: `${Math.max(2, Math.min(100, figure.meter))}%`}} /></i>}
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
            const fill = cell?.state === 'value' ? `var(--sh-step-${cell.step})` : cell?.state === 'held' ? 'url(#sh-hatch)' : 'transparent';
            return <rect key={ulb.code} className="sh-heat-cell" x={left + column * cw} y={0} width={cw - .5} height={ch} fill={fill} style={{'--x': column / ordered.length} as CSSProperties} />;
          })}
        </g>
      ))}
    </svg>
  );
}

/** Each programme's reported stages as bars against its own first stage, so the drop-off is visible. */
export function PipelineBars({pipelines}: {pipelines: Pipeline[]}) {
  return (
    <div className="sh-pipelines">
      {pipelines.map((pipeline) => {
        const base = Math.max(1, pipeline.stages[0]?.value ?? 1);
        return (
          <div key={pipeline.label} className="sh-pipeline">
            <div className="sh-pipeline-head"><b>{pipeline.label}</b><small>{pipeline.period}</small></div>
            {pipeline.stages.map((stage, index) => (
              <div key={stage.label} className={`sh-stage${index > 0 && stage.value / base < .5 ? ' is-short' : ''}`} style={{'--i': index} as CSSProperties}>
                <span>{stage.label}</span>
                <i><b style={{width: `${Math.max(1.5, stage.value / base * 100)}%`}} /></i>
                <em>{stage.value.toLocaleString('en-IN')}</em>
              </div>
            ))}
          </div>
        );
      })}
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

/**
 * Delivery as shape: each programme's stages drawn as a band whose thickness is the count at
 * that stage, against the programme's own first stage. A split programme (parts of one total)
 * is drawn as one bar divided, never as a flow from one part into the other.
 */
export function DeliveryFunnels({pipelines}: {pipelines: Pipeline[]}) {
  const W = 360, H = 74, pad = 4;
  return (
    <div className="sh-funnels">
      {pipelines.map((pipeline, index) => {
        const base = Math.max(1, pipeline.stages[0]?.value ?? 1);
        if (pipeline.kind === 'split') {
          const [whole, ...parts] = pipeline.stages;
          return (
            <div key={pipeline.label} className="sh-split" style={{'--i': index} as CSSProperties}>
              <div className="sh-funnel-head"><b>{pipeline.label}</b><small>{whole.value.toLocaleString('en-IN')} {whole.label} · {pipeline.period}</small></div>
              <div className="sh-split-bar" role="img" aria-label={parts.map((part) => `${part.value.toLocaleString('en-IN')} ${part.label}`).join(', ')}>
                {parts.map((part, partIndex) => <i key={part.label} className={partIndex ? 'is-warm' : ''} style={{flexBasis: `${Math.max(1, part.value / base * 100)}%`}} />)}
              </div>
              <div className="sh-split-labels">{parts.map((part) => <span key={part.label}><b>{part.value.toLocaleString('en-IN')}</b> {part.label}</span>)}</div>
            </div>
          );
        }
        const n = pipeline.stages.length;
        const xs = pipeline.stages.map((_, i) => pad + i * (W - pad * 2) / (n - 1));
        const half = pipeline.stages.map((stage) => Math.max(1.2, stage.value / base * (H / 2 - 2)));
        const cy = H / 2;
        let top = `M ${xs[0]} ${cy - half[0]}`, bottom = `L ${xs[n - 1]} ${cy + half[n - 1]}`;
        for (let i = 1; i < n; i++) {
          const mx = (xs[i - 1] + xs[i]) / 2;
          top += ` C ${mx} ${cy - half[i - 1]}, ${mx} ${cy - half[i]}, ${xs[i]} ${cy - half[i]}`;
        }
        for (let i = n - 1; i > 0; i--) {
          const mx = (xs[i - 1] + xs[i]) / 2;
          bottom += ` C ${mx} ${cy + half[i]}, ${mx} ${cy + half[i - 1]}, ${xs[i - 1]} ${cy + half[i - 1]}`;
        }
        const id = `sh-flow-${index}`;
        const endShort = (pipeline.stages[n - 1].value / base) < .5;
        return (
          <div key={pipeline.label} className="sh-funnel" style={{'--i': index} as CSSProperties}>
            <div className="sh-funnel-head"><b>{pipeline.label}</b><small>{pipeline.period}</small></div>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={pipeline.stages.map((stage) => `${stage.value.toLocaleString('en-IN')} ${stage.label}`).join(', then ')}>
              <defs><linearGradient id={id} x1="0" x2="1"><stop offset="0" stopColor="var(--vi-increase)" /><stop offset="1" stopColor={endShort ? 'var(--vi-decrease)' : 'var(--vi-increase)'} /></linearGradient></defs>
              <path className="sh-funnel-shape" d={`${top} ${bottom} Z`} fill={`url(#${id})`} />
              {xs.map((x, i) => <line key={i} className="sh-funnel-tick" x1={x} x2={x} y1={2} y2={H - 2} />)}
            </svg>
            <div className="sh-funnel-labels" style={{gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`}}>
              {pipeline.stages.map((stage, i) => <span key={stage.label} className={i > 0 && stage.value / base < .5 ? 'is-short' : ''}><b>{stage.value.toLocaleString('en-IN')}</b>{stage.label}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
