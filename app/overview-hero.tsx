'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {getNamedFindings} from '@/lib/findings';
import {districtPlacements, getUlbAtlas, measureHeadline} from '@/lib/ulb-atlas';
import {getSasaGoals, pooledDistrictMap, statusLabel} from '@/lib/sasa-goals';
import {CountUp, motionAllowed} from './motion';
import './overview-hero.css';

const normal = (name: string) => name.toUpperCase().replace(/[^A-Z]/g, '');

// The welcome map's three bands, so a district keeps its colour from one screen to the next.
const BANDS = ['<50%', '50–<75%', '≥75%'] as const;
const band = (value: number) => value < 50 ? 0 : value < 75 ? 1 : 2;
const MEASURES = {
  collection: {label: 'Collection', title: 'Households collected from', verb: 'collected from'},
  segregation: {label: 'Segregation', title: 'Households segregating', verb: 'segregating'},
} as const;
type MapMeasure = keyof typeof MEASURES;

interface HeroProps {
  shapes: Array<{d: string; path: string}> | null;
  failed: boolean;
  rural: {open: number; close: number; shift: number};
  href: (path: string) => string;
  onSubject: (id: string) => void;
}

/**
 * The landing view: four headline readings, each from its own source and period, beside a map
 * of the one measure every ULB reports on the same day. Nothing here is combined into a score.
 */
export function OverviewHero({shapes, failed, rural, href, onSubject}: HeroProps) {
  const atlas = useMemo(() => getUlbAtlas(), []);
  const reach = useMemo(() => measureHeadline(atlas, 'reach'), [atlas]);
  const reachMeasure = atlas.measures.find((measure) => measure.id === 'reach')!;
  const findings = useMemo(() => getNamedFindings(), []);
  const toilets = findings.find((finding) => finding.id === 'stalled-approvals');
  const vehicles = findings.find((finding) => finding.id === 'undelivered-orders');
  const [measure, setMeasure] = useState<MapMeasure>('collection');
  const [pointed, setPointed] = useState<string | null>(null);
  // Pooled like the Goals district table, so the map and the table give a district one figure.
  const map = useMemo(() => pooledDistrictMap(measure), [measure]);
  const collectionGoal = useMemo(() => getSasaGoals().goals.find((goal) => goal.id === 'collection'), []);
  const placements = useMemo(() => districtPlacements(atlas), [atlas]);
  const svg = useRef<SVGSVGElement>(null);

  // Each district is drawn only where its LGD code (or, without one, its exact name) names a single boundary.
  const fills = useMemo(() => {
    if (!shapes) return [];
    return shapes.map((shape) => {
      const row = map.find((entry) => normal(placements.get(entry.district) ?? entry.district) === normal(shape.d));
      return {shape, row};
    });
  }, [shapes, map, placements]);
  // A district with a reading but no drawn boundary (a newer district) is named under the map.
  const offMap = useMemo(() => shapes ? map.filter((row) => row.value !== null && !shapes.some((shape) => normal(placements.get(row.district) ?? row.district) === normal(shape.d))) : [], [shapes, map, placements]);

  // On first load the state fills in from west to east.
  useEffect(() => {
    const node = svg.current;
    if (!node || !shapes || !motionAllowed()) return;
    const width = node.viewBox.baseVal.width || 560;
    node.querySelectorAll<SVGGraphicsElement>('path').forEach((path) => {
      const box = path.getBBox();
      path.animate([{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 750, delay: 120 + box.x / width * 750, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards'});
    });
  }, [shapes]);

  const figures = [
    {id: 'atlas', label: 'Households collected from', value: reach.figure, decimals: 1, suffix: '%', context: `${reachMeasure.reporting} reporting ULBs · ${reachMeasure.period}`, meter: reach.figure, tone: 'good', action: () => { window.location.href = href('/atlas'); },
      target: collectionGoal ? {status: collectionGoal.status, text: `Target due ${collectionGoal.deadlineLabel} · ${statusLabel[collectionGoal.status].toLowerCase()}`} : undefined},
    toilets && {id: 'sanitation', label: 'Approved toilets not yet built', value: toilets.total, decimals: 0, suffix: '', context: `${toilets.stalled} of ${toilets.reporting} ULBs holding approvals report none started · ${toilets.period}`, meter: undefined, tone: 'warm', action: () => onSubject('sanitation')},
    vehicles && {id: 'collection', label: 'Vehicles ordered, not delivered', value: vehicles.total, decimals: 0, suffix: '', context: `${vehicles.stalled} of ${vehicles.reporting} ULBs with work orders report none supplied · ${vehicles.period}`, meter: undefined, tone: 'warm', action: () => onSubject('collection')},
    {id: 'rural-change', label: 'Rural collection, May to August', value: rural.shift, decimals: 2, suffix: ' pp', context: `${rural.open.toFixed(2)}% to ${rural.close.toFixed(2)}% in the common panchayat-day cohort`, meter: undefined, tone: rural.shift < 0 ? 'warm' : 'good', action: () => onSubject('rural-change')},
  ].filter((figure): figure is NonNullable<typeof figure> => Boolean(figure));

  return (
    <section className="ov-hero" aria-labelledby="ov-hero-title">
      <div className="ov-hero-copy">
        <span className="eyebrow">SASA Intelligence Lab · Andhra Pradesh</span>
        <h1 id="ov-hero-title">Sanitation across the state, <em>as the sources report it.</em></h1>
        <p className="ov-hero-lede">{atlas.stats.ulbs} urban local bodies and the rural panchayats, read from retained government returns. Every figure keeps its own population and period.</p>
        <div className="ov-hero-figures">
          {figures.map((figure) => (
            <button key={figure.id} type="button" className={`ov-figure-card tone-${figure.tone}`} onClick={figure.action}>
              <span className="ov-figure-label">{figure.label}</span>
              <strong><CountUp value={figure.value} decimals={figure.decimals} suffix={figure.suffix} prefix={figure.value > 0 && figure.suffix === ' pp' ? '+' : ''} /></strong>
              <small>{figure.context}</small>
              {typeof figure.meter === 'number' && <i aria-hidden="true"><b style={{width: `${Math.max(0, Math.min(100, figure.meter))}%`}} /></i>}
              {'target' in figure && figure.target && <em className={`ov-figure-target is-${figure.target.status}`}>{figure.target.text}</em>}
            </button>
          ))}
        </div>
        <div className="ov-hero-actions">
          <a className="ov-action-primary" href={href('/atlas')}>Open the ULB Atlas<span aria-hidden="true">→</span></a>
          <a className="ov-action-secondary" href={href('/gap-radar')}>Compare places in Gap Radar</a>
        </div>
      </div>
      <figure className="ov-hero-map">
        <div className="ov-map-switch" role="group" aria-label="District map measure">
          {(Object.keys(MEASURES) as MapMeasure[]).map((id) => <button key={id} type="button" aria-pressed={measure === id} onClick={() => setMeasure(id)}>{MEASURES[id].label}</button>)}
        </div>
        {shapes ? (
          <svg ref={svg} viewBox="0 0 560 476" role="group" aria-label={`${MEASURES[measure].title}, by district, ${reachMeasure.period}, summed over each district's ULBs. ${fills.filter(({row}) => row?.value !== null && row?.value !== undefined).length} districts drawn with a reading. Each opens in the Goals district table.`}>
            <defs><pattern id="ov-hatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="var(--ov-band-none)" /><line x1="0" y1="0" x2="0" y2="5" stroke="var(--muted)" strokeWidth=".8" opacity=".55" /></pattern></defs>
            {fills.map(({shape, row}) => {
              const valued = row && row.value !== null;
              const label = row ? `${row.district}: ${row.value === null ? 'no reading' : `${row.value.toFixed(1)}% of households ${MEASURES[measure].verb}`}. ${row.detail}` : `${shape.d}: no ULB in the register is filed under this boundary`;
              const path = <path d={shape.path} className={valued ? `band-${band(row.value!)}` : 'is-hatched'} fill={valued ? undefined : 'url(#ov-hatch)'}><title>{label}</title></path>;
              // A district with a reading opens its row in the Goals table; the readout below names it on hover or focus.
              return valued
                ? <a key={shape.d} href={`${href('/goals')}&district=${encodeURIComponent(row.district)}#goal-districts`} aria-label={label}
                    onMouseEnter={() => setPointed(row.district)} onMouseLeave={() => setPointed(null)} onFocus={() => setPointed(row.district)} onBlur={() => setPointed(null)}>{path}</a>
                : <g key={shape.d}>{path}</g>;
            })}
          </svg>
        ) : <p className="ov-hero-map-status">{failed ? 'District boundaries did not load. The readings beside the map are unaffected.' : 'Loading district boundaries…'}</p>}
        <figcaption>
          <span className="ov-map-title">{MEASURES[measure].title}, by district · {reachMeasure.period}</span>
          <span className="ov-map-readout" aria-live="polite">{(() => {
            const row = pointed ? map.find((entry) => entry.district === pointed) : null;
            return row && row.value !== null ? <><b>{row.district} {row.value.toFixed(1)}%</b> · {row.detail.split(' · ')[0]}</> : 'Each district adds up its towns’ households, as on the Goals screen. Select one to open its row.';
          })()}</span>
          <span className="ov-bands">{BANDS.map((label, index) => <span key={label}><i className={`band-${index}`} aria-hidden="true" />{label}</span>)}<span><i className="is-hatched" aria-hidden="true" />No reading</span></span>
          {offMap.map((row) => <small key={row.district} className="ov-off-map">{row.district} ({row.value!.toFixed(1)}%) has no drawn boundary</small>)}
        </figcaption>
      </figure>
    </section>
  );
}
