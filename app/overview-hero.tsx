'use client';

import {useEffect, useMemo, useRef} from 'react';
import {getNamedFindings} from '@/lib/findings';
import {districtPlacements, getUlbAtlas, measureHeadline} from '@/lib/ulb-atlas';
import {pooledDistrictMap} from '@/lib/sasa-goals';
import {CountUp, motionAllowed} from './motion';
import './overview-hero.css';

const normal = (name: string) => name.toUpperCase().replace(/[^A-Z]/g, '');

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
  // Pooled like the Goals district table, so the map and the table give a district one figure.
  const map = useMemo(() => pooledDistrictMap('collection'), []);
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
    {id: 'atlas', label: 'Households collected from', value: reach.figure, decimals: 1, suffix: '%', context: `${reachMeasure.reporting} reporting ULBs · ${reachMeasure.period}`, meter: reach.figure, tone: 'good', action: () => { window.location.href = href('/atlas'); }},
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
            </button>
          ))}
        </div>
        <div className="ov-hero-actions">
          <a className="ov-action-primary" href={href('/atlas')}>Open the ULB Atlas<span aria-hidden="true">→</span></a>
          <a className="ov-action-secondary" href={href('/gap-radar')}>Compare places in Gap Radar</a>
        </div>
      </div>
      <figure className="ov-hero-map">
        {shapes ? (
          <svg ref={svg} viewBox="0 0 560 476" role="img" aria-label={`Households collected from, by district, ${reachMeasure.period}, summed over each district's ULBs. ${fills.filter(({row}) => row?.value !== null && row?.value !== undefined).length} districts drawn with a reading.`}>
            <defs><pattern id="ov-hatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--muted)" strokeWidth=".7" opacity=".45" /></pattern></defs>
            {fills.map(({shape, row}) => (
              <path key={shape.d} d={shape.path} fill={row?.value === null || row?.value === undefined ? 'url(#ov-hatch)' : `color-mix(in srgb, var(--vi-increase) ${14 + row.value * .86}%, var(--vi-soft))`}>
                <title>{row ? `${row.district}: ${row.value === null ? 'no reading' : `${row.value.toFixed(1)}% of households collected from`}. ${row.detail}` : `${shape.d}: no ULB in the register is filed under this boundary`}</title>
              </path>
            ))}
          </svg>
        ) : <p className="ov-hero-map-status">{failed ? 'District boundaries did not load. The readings beside the map are unaffected.' : 'Loading district boundaries…'}</p>}
        <figcaption>
          <span>Households collected from, by district · {reachMeasure.period}</span>
          <span className="ov-ramp" aria-hidden="true"><i /></span>
          <span className="ov-ramp-labels"><small>0%</small><small>100%</small></span>
          {offMap.map((row) => <small key={row.district} className="ov-off-map">{row.district} ({row.value!.toFixed(1)}%) has no drawn boundary</small>)}
        </figcaption>
      </figure>
    </section>
  );
}
