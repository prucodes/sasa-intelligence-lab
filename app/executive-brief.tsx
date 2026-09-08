'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataMode } from '@/lib/domain';
import { briefNumber, executiveBriefText, getExecutiveBrief } from '@/lib/executive-brief';
import './executive-brief.css';

export function ExecutiveBrief({mode,onClose}:{mode:DataMode;onClose:()=>void}) {
  const brief = useMemo(()=>getExecutiveBrief(mode),[mode]);
  const [preparedAt] = useState(()=>new Date().toISOString());
  const [error,setError] = useState('');
  const dialog = useRef<HTMLElement>(null);
  useEffect(()=>{
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function keys(event:KeyboardEvent) {
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key!=='Tab')return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button, a[href], summary, [tabindex="0"]') ?? [])].filter(el=>el.getClientRects().length>0);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    document.addEventListener('keydown',keys);
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keys);previous?.focus();};
  },[onClose]);
  function download() {
    try {
      const url=URL.createObjectURL(new Blob([executiveBriefText(brief,preparedAt)],{type:'text/plain;charset=utf-8'}));
      const anchor=document.createElement('a');
      anchor.href=url;anchor.download=`sasa-${mode==='SAMPLE'?'governed':mode.toLowerCase()}-brief-${preparedAt.slice(0,10)}.txt`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),0);
      setError('');
    }catch{setError('The text download could not start. You can still use Print / Save PDF or select and copy the preview.');}
  }
  return <div className="brief-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section ref={dialog} className="executive-brief" role="dialog" aria-modal="true" aria-labelledby="executive-brief-title">
      <div className="brief-toolbar"><span>Preview before you share</span><div><button onClick={()=>window.print()}>Print / Save PDF</button><button onClick={download}>Download text</button><button aria-label="Close executive brief" onClick={onClose}>Close <span aria-hidden="true">×</span></button></div></div>
      {error&&<p role="alert" className="brief-error">{error}</p>}
      <article className="brief-document">
        <header className="brief-cover"><span>SASA / INTELLIGENCE LAB</span><div><h2 id="executive-brief-title">{brief.title}</h2><b>{brief.governed?'UNSCORED':mode==='DEMO'?'SYNTHETIC':'ROADMAP'}</b></div><p>{brief.governed?'Three operational readings. Clear boundaries. A source behind every number.':'A capability preview—not current operational evidence.'}</p><small>Prepared {preparedAt.slice(0,10)} · source dates recorded separately below</small></header>
        <div className="brief-scope"><b>Scope of this brief</b><p>{brief.scope}</p></div>
        {brief.footprint&&<div className="brief-footprint"><span><b>{brief.footprint.datasets}</b> complete retained datasets</span><span><b>{briefNumber(brief.footprint.rows)}</b> retained rows</span><span><b>{brief.footprint.observed}</b> observed-name reference candidates</span><small>Not an official statewide denominator.</small></div>}
        <div className="brief-readings">{brief.issues.map((issue,index)=><section className="brief-reading" key={issue.id}>
          <div className="brief-reading-head"><span>0{index+1} / {issue.title}</span><small>{issue.period} · ULB grain</small></div>
          <div className="brief-reading-body"><div><strong>{issue.rows.length?briefNumber(issue.total):'Not returned'}</strong><h3>{issue.quantity}</h3><p>{issue.rows.length ? briefNumber(issue.completed) : "Not returned"} {issue.completedLabel} / {issue.rows.length ? briefNumber(issue.basis) : "Not returned"} {issue.basisLabel}</p></div><div className="brief-names"><b>Largest reported quantities</b>{issue.rows.filter(row=>row.value>0).slice(0,3).map(row=><div key={row.key}><span>{row.ulb}<small>{row.district}</small></span><b>{briefNumber(row.value)}<small>{issue.unit}</small></b></div>)}</div></div>
          <p className="brief-coverage">{issue.rows.length} eligible / {brief.footprint!.observed} observed-name reference candidates · {issue.excluded} {issue.excluded===1?'row or candidate group':'rows or candidate groups'} excluded by checks. Both quantities use the same eligible cohort.</p><p className="brief-boundary">{issue.boundary}</p>
        </section>)}</div>
        {brief.governed&&<>
          <section className="brief-outcomes"><h3>Historical outcomes stay separate.</h3><p>{brief.sources.filter(source=>source.key.includes('swacch_survekshan')).map(source=>`${source.key.includes('odf')?'ODF':source.key.includes('gfc')?'GFC':'National rank'}: ${source.latestRows} source rows (${source.period})`).join(' · ')}</p><small>These are source-row counts, not verified certifications or current performance outcomes.</small></section>
          <section className="brief-actions"><h3>What to do next</h3><ol>{brief.nextActions.map(action=><li key={action}>{action}</li>)}</ol><p>{brief.boundary}</p></section>
          <section className="brief-provenance"><h3>Evidence references</h3><p>Reporting periods and response generation times are different. Counts below cover all retained periods; readings above use the latest source period only.</p>{brief.sources.map((source,index)=><div key={source.key}><b>{index+1}. {source.name}</b><code>{source.key}</code><span>Latest period: {source.period} · {source.rows} retained rows</span><span>Response: {source.responseId} · generated {source.generatedAt}</span></div>)}</section>
        </>}
        {!brief.governed&&<p className="brief-mode-note">Switch to Governed data to preview retained source evidence. No governed totals are included in this {mode==='DEMO'?'synthetic':'roadmap'} brief.</p>}
        <footer>SASA Intelligence Lab · Retained evidence for descriptive review · Static, client-side export</footer>
      </article>
    </section>
  </div>;
}
