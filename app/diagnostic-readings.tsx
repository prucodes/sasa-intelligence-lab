'use client';

import type { EvidenceRecord } from '@/lib/domain';
import { getDiagnosticReadings, type DiagnosticReading } from '@/lib/diagnostic-readings';
import './diagnostic-readings.css';

const number = (value:number | null) => value === null ? 'Not returned' : value.toLocaleString('en-IN', {maximumFractionDigits:2});

export function DiagnosticReadings({ records, selectedId, onInspect }: {records:EvidenceRecord[];selectedId?:string;onInspect:(id:string)=>void}) {
  const readings = getDiagnosticReadings(records);
  function card(reading:DiagnosticReading) {
    const accepted = reading.state === 'returned';
    const withheld = reading.state === 'disputed' || reading.state === 'invalid';
    const scale = Math.max(1,...reading.fields.map(field=>field.value ?? 0));
    const primary = reading.state === 'disputed' || reading.state === 'invalid' ? 'Withheld' : reading.value === null ? 'Not returned' : typeof reading.value === 'number' ? number(reading.value) : reading.value;
    return <button key={reading.id} type="button" className={`reading-card reading-${reading.family} reading-${reading.state}`} aria-label={`Inspect ${reading.title} source`} aria-pressed={Boolean(selectedId && reading.evidenceIds.includes(selectedId))} disabled={reading.evidenceIds.length === 0} onClick={()=>onInspect(reading.evidenceIds[0])}>
      <span className="reading-card-head"><b>{reading.title}</b><small>{reading.period}</small></span>
      <span className="reading-main"><strong>{primary}</strong>{accepted && <span>{reading.unit}</span>}</span>
      {reading.family === 'delivery' && <>
        <span className="reading-denominator">{reading.denominator === null ? `${reading.denominatorLabel}: ${withheld?'withheld':'not returned'}` : <>of <b>{number(reading.denominator)}</b> {reading.denominatorLabel}</>}</span>
        <span className="reading-stage-list">{reading.fields.map(field=><span key={field.label}><span><small>{field.label}</small><b>{withheld?'Withheld':number(field.value)}</b></span><i aria-hidden="true">{field.value !== null && <em style={{width:`${field.value / scale * 100}%`}}/>}</i></span>)}</span>
        <span className="reading-rate">{reading.ratio === null ? 'Rate unavailable' : `${(reading.ratio * 100).toLocaleString('en-IN',{maximumFractionDigits:1})}% ${reading.unit} / ${reading.denominatorLabel}`}</span>
      </>}
      {reading.id === 'rank' && reading.value === 0 && <span className="reading-warning">Source returned rank 0; no ordinal position is inferred.</span>}
      <span className={reading.warning ? 'reading-warning' : 'reading-note'}>{reading.note}</span>
      <span className="reading-source">{reading.source}</span>
      <span className="reading-action">{reading.evidenceIds.length ? 'Inspect this source' : 'No source record to inspect'}<i aria-hidden="true">↗</i></span>
    </button>;
  }
  return <section className="reported-readings" aria-label="What this ULB reported">
    <header><span className="eyebrow">What is reported</span><h3>What do these numbers mean?</h3><p>Latest retained period for each source. Every reading opens its own evidence; missing values stay missing.</p></header>
    <div className="reading-delivery-grid">{readings.filter(reading=>reading.family==='delivery').map(card)}</div>
    <div className="reading-section-label"><b>Facilities on record</b><span>Capacity is not utilization</span></div>
    <div className="reading-facility-grid">{readings.filter(reading=>reading.family==='facility').map(card)}</div>
    <div className="reading-section-label"><b>Historical outcome context</b><span>2024 · separate from operations</span></div>
    <div className="reading-outcome-grid">{readings.filter(reading=>reading.family==='outcome').map(card)}</div>
  </section>;
}
