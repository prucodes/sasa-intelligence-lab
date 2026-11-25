'use client';

import {useMemo} from 'react';
import {householdLine} from '@/lib/sasa-goals';
import './household-line.css';

const whole = (value: number) => value.toLocaleString('en-IN');
const pct = (value: number) => `${value.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`;

/**
 * Of every 100 urban households on the reported day: collected from and segregating, collected
 * from only, and not collected from. One base, so the three parts always add to 100 houses.
 */
export function HouseholdLine({href}: {href: (path: string) => string}) {
  const line = useMemo(() => householdLine(), []);
  const collectedShare = line.collected / line.households * 100;
  const segregatedShare = line.segregated / line.households * 100;
  // Whole houses: segregating can never exceed collected, since a household not collected from is not segregating into the system.
  const segregating = Math.round(segregatedShare);
  const collectedOnly = Math.round(collectedShare) - segregating;
  const parts = [
    {id: 'segregating', count: segregating, share: segregatedShare, label: 'collected from and segregating', households: line.segregated},
    {id: 'collected', count: collectedOnly, share: collectedShare - segregatedShare, label: 'collected from, not segregating', households: line.collected - line.segregated},
    {id: 'missed', count: 100 - segregating - collectedOnly, share: 100 - collectedShare, label: 'not collected from', households: line.households - line.collected},
  ];
  const houses = parts.flatMap((part) => Array.from({length: part.count}, () => part.id));
  const columns = 10, pitch = 22;

  return (
    <section className="ov-households" aria-labelledby="ov-households-title">
      <div className="ovh-copy">
        <span className="ovh-kicker">Every 100 urban households · {line.day}</span>
        <h2 id="ov-households-title">Of every 100 households, <em>{Math.round(collectedShare)} were collected from and {segregating} were segregating.</em></h2>
        <ul className="ovh-legend">
          {parts.map((part) => (
            <li key={part.id} className={`is-${part.id}`}>
              <i aria-hidden="true"/>
              <b>{part.count}</b>
              <span>{part.label}<small>{pct(part.share)} · {whole(part.households)} households</small></span>
            </li>
          ))}
        </ul>
        <p className="ovh-note">One reported day in the {line.ulbs} ULBs the Atlas places, out of {whole(line.households)} households; {line.held} ULBs held out for code review are not counted. Each house is one in a hundred, rounded; the shares beside them are exact.</p>
        <a className="ovh-open" href={`${href('/goals')}#goal-collection`}>Collection and segregation targets <span aria-hidden="true">→</span></a>
      </div>
      <svg className="ovh-houses" viewBox={`0 0 ${columns * pitch} ${Math.ceil(houses.length / columns) * pitch}`} role="img"
        aria-label={`Of every 100 urban households: ${parts.map((part) => `${part.count} ${part.label}`).join(', ')}.`}>
        <defs>
          <symbol id="ovh-house" viewBox="0 0 24 24"><path d="M3.5 11.2 12 4l8.5 7.2V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path className="ovh-door" d="M10 21v-5.5h4V21"/></symbol>
        </defs>
        {houses.map((id, index) => (
          <use key={index} href="#ovh-house" className={`ovh-house is-${id}`} x={(index % columns) * pitch + 2} y={Math.floor(index / columns) * pitch + 2} width={pitch - 4} height={pitch - 4}/>
        ))}
      </svg>
    </section>
  );
}
