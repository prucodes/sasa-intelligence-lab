'use client';

import type {CSSProperties} from 'react';
import type {NatureAsset} from '@/lib/screen-heroes';

/** A closed ring with a slight, fixed irregularity, like a growth ring in a cross-section of wood. */
function ringPath(cx: number, cy: number, r: number, seed: number, wobble = 2.4) {
  const points = 96;
  let d = '';
  for (let i = 0; i <= points; i++) {
    const a = i / points * Math.PI * 2 - Math.PI / 2;
    const rr = r + Math.sin(a * 3 + seed) * wobble + Math.sin(a * 7 + seed * 2.1) * wobble * .45 + Math.cos(a * 5 - seed) * wobble * .3;
    d += `${i ? 'L' : 'M'} ${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

const TONES: Record<NatureAsset['id'], string> = {'green-cover': 'var(--ns-crown)', 'water-bodies': 'var(--ns-water)', 'green-spaces': 'var(--ns-shrub)'};

/**
 * The green-asset programmes as growth rings. Each programme is one ring, and the arc drawn
 * along it is the share of its target reported done: avenue planting in kilometres, water
 * bodies rejuvenated, green spaces created. Fine rings between them are texture only and carry
 * no value. These are reported programme counts, not canopy, biomass, area or water quality.
 */
export function NatureScene({assets}: {assets: NatureAsset[]}) {
  const S = 300, c = S / 2;
  const rings = assets.map((asset, index) => ({asset, r: 128 - index * 30, share: asset.target ? Math.min(1, asset.reported / asset.target) : 0, seed: 1.7 + index * 2.3}));
  const grain = Array.from({length: 11}, (_, index) => 22 + index * 10.5).filter((r) => !rings.some((ring) => Math.abs(ring.r - r) < 6));
  return (
    <div className="nature-rings">
      <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={rings.map(({asset, share}) => `${asset.label}: ${Math.round(share * 1000) / 10}% of target reported`).join('; ')}>
        <defs>
          <radialGradient id="nr-core"><stop offset="0" stopColor="var(--nr-core-1)" /><stop offset="1" stopColor="var(--nr-core-2)" /></radialGradient>
        </defs>
        <circle cx={c} cy={c} r={142} fill="url(#nr-core)" />
        {grain.map((r, index) => <path key={r} className="nr-grain" d={ringPath(c, c, r, index * 1.9, 1.4)} />)}
        {rings.map(({asset, r, share, seed}, index) => {
          const d = ringPath(c, c, r, seed);
          return (
            <g key={asset.id} style={{'--tone': TONES[asset.id], '--share': share * 100, '--i': index} as CSSProperties}>
              <path className="nr-track" d={d} pathLength={100} />
              <path className="nr-arc" d={d} pathLength={100} strokeDasharray={`${share * 100} ${100 - share * 100}`} />
            </g>
          );
        })}
        <circle className="nr-pith" cx={c} cy={c} r={7} />
      </svg>
      <ul className="nature-legend">
        {rings.map(({asset, share}) => (
          <li key={asset.id} style={{'--tone': TONES[asset.id]} as CSSProperties}>
            <i aria-hidden="true" />
            <span>{asset.id === 'green-cover' ? 'Green cover' : asset.id === 'water-bodies' ? 'Water bodies' : 'Green spaces'}</span>
            <b>{(share * 100).toLocaleString('en-IN', {maximumFractionDigits: 1})}%</b>
            <small>{asset.reported.toLocaleString('en-IN', {maximumFractionDigits: 0})} of {asset.target.toLocaleString('en-IN')} {asset.id === 'water-bodies' ? 'rejuvenated' : asset.unit} · {asset.period}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
