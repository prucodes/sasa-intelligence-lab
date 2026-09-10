'use client';

import { useState } from 'react';
import type { EvidenceRecord } from '@/lib/domain';
import { getDiagnosticReadings, type DiagnosticReading } from '@/lib/diagnostic-readings';
import './diagnostic-readings.css';
import './evidence-expansion.css';

const number = (value:number | null) => value === null ? 'Not returned' : value.toLocaleString('en-IN', {maximumFractionDigits:2});

export function DiagnosticReadings({ records, selectedId, onInspect }: {records:EvidenceRecord[];selectedId?:string;onInspect:(id:string)=>void}) {
  const readings = getDiagnosticReadings(records);
  const [family,setFamily]=useState<DiagnosticReading['family']>('delivery');
  const groups=[{id:'delivery' as const,label:'Delivery'},{id:'facility' as const,label:'Facilities'},{id:'outcome' as const,label:'Historical outcomes'}];
  function card(reading:DiagnosticReading) {
    const accepted = reading.state === 'returned';
    const withheld = reading.state === 'disputed' || reading.state === 'invalid';
    const scale = Math.max(1,...reading.fields.map(field=>field.value ?? 0));
    const primary = reading.state === 'disputed' || reading.state === 'invalid' ? 'Withheld' : reading.value === null ? 'Not returned' : typeof reading.value === 'number' ? number(reading.value) : reading.value;
    return <button key={reading.id} type="button" className={`reading-card reading-${reading.family} reading-${reading.state}`} aria-label={`Inspect ${reading.title} source`} aria-pressed={Boolean(selectedId && reading.evidenceIds.includes(selectedId))} disabled={reading.evidenceIds.length === 0} onClick={()=>onInspect(reading.evidenceIds[0])}>
      <span className="reading-state">{reading.state === 'returned' ? 'Reported' : reading.state === 'missing' ? 'Missing measurement' : 'Held out'}</span>
      <span className="reading-card-head"><b>{reading.title}</b><small>{reading.period}</small></span>
      <span className="reading-main"><strong>{primary}</strong>{accepted && <span>{reading.unit}</span>}</span>
      {reading.family === 'delivery' && <>
        <span className="reading-denominator">{reading.denominator === null ? `${reading.denominatorLabel}: ${withheld?'withheld':'not returned'}` : <>of <b>{number(reading.denominator)}</b> {reading.denominatorLabel}</>}</span>
        <span className="reading-stage-list">{reading.fields.map(field=><span key={field.label}><span><small>{field.label}</small><b>{withheld?'Withheld':number(field.value)}</b></span><i aria-hidden="true">{!withheld && field.value !== null && <em style={{width:`${field.value / scale * 100}%`}}/>}</i></span>)}</span>
        <span className="reading-rate">{withheld?'Rate withheld':reading.ratio === null ? 'Rate unavailable' : `${(reading.ratio * 100).toLocaleString('en-IN',{maximumFractionDigits:1})}% ${reading.unit} / ${reading.denominatorLabel}`}</span>
      </>}
      {reading.id === 'rank' && reading.value === 0 && <span className="reading-warning">Source returned rank 0; no ordinal position is inferred.</span>}
      <span className={reading.warning ? 'reading-warning' : 'reading-note'}>{reading.note}</span>
      <span className="reading-source">{reading.source}</span>
      <span className="reading-action">{reading.evidenceIds.length ? 'Inspect this source' : 'No source record to inspect'}<i aria-hidden="true">↗</i></span>
    </button>;
  }
  return <section className="reported-readings" aria-label="What this ULB reported">
    <header><span className="eyebrow">Read the position. Inspect the source.</span><h3>Delivery, facilities and outcomes.</h3><p>Each reading uses its source’s latest retained period. Select a card to open the exact evidence behind it.</p></header>
    <div className="reading-summary"><span><b>{readings.filter(r=>r.state==='returned').length}</b> readings returned</span><span><b>{readings.filter(r=>r.state==='missing').length}</b> missing</span><span><b>{readings.filter(r=>r.state==='disputed'||r.state==='invalid').length}</b> held out</span></div>
    <div className="evidence-tabs" role="group" aria-label="Diagnostic subject">{groups.map(group=><button key={group.id} aria-pressed={family===group.id} onClick={()=>setFamily(group.id)}>{group.label} <small>{readings.filter(reading=>reading.family===group.id).length}</small></button>)}</div>
    <p className="reading-scope-note">{family==='delivery'?'Reported quantities against their own approvals or targets. Bars share a scale within each card.':family==='facility'?'Configured capacity on record. TPD and KLD remain separate; utilization requires throughput evidence.':'Historical source statuses and rank. Their period is separate from current operational reporting.'}</p>
    <div className={`reading-${family==='outcome'?'outcome':family==='facility'?'facility':'delivery'}-grid`}>{readings.filter(reading=>reading.family===family).map(card)}</div>
  </section>;
}
