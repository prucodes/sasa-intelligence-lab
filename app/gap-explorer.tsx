'use client';
import {useState,useEffect} from 'react';
import {getGapCapabilities} from '@/lib/gap-capabilities';
import type {RateBasis} from '@/lib/rural-movement';
import {RuralMovement} from './rural-movement';
import {InfrastructureSeries} from './infrastructure-series';
import {DeliveryPlans} from './delivery-plans';
import {UlbRadar} from './ulb-radar';
import {UlbServiceRadar} from './ulb-service-radar';
import {SubjectRankings} from './subject-rankings';
import './evidence-expansion.css';
export function GapExplorer(){
  const [ruralBasis,setRuralBasis]=useState<RateBasis>('all-days');
  const capabilities=getGapCapabilities(ruralBasis);
  const [selected,setSelected]=useState('service');
  useEffect(()=>{
    if(['rankings','movement'].includes(new URLSearchParams(window.location.search).get('view')??'')){
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(new URLSearchParams(window.location.search).get('view')!);return;
    }
    if(['sanitation','collection','processing'].includes(new URLSearchParams(window.location.search).get('programme')??'')) {
      // Preserve existing programme-specific Diagnostics deep links.
      setSelected('ulb');
    }
  },[]);
  const active=capabilities.find(c=>c.id===selected)!;
  return <div className="gap-explorer">
    <div className="evidence-tabs" aria-label="Available gap analyses">{capabilities.map(c=><button key={c.id} aria-pressed={selected===c.id} disabled={!c.available} onClick={()=>setSelected(c.id)}>{c.label}</button>)}</div>
    {selected!=='service'&&<header className="gr-lede" aria-label="Selected comparison">
      <div className="gr-lede-head">
        <span className="gr-lede-kicker">{active.scope}</span>
        <span className="gr-lede-count">{capabilities.filter(c=>c.available).length} comparisons available · assessed one at a time</span>
      </div>
      <div className="gr-lede-body" aria-live="polite">
        <div className="gr-lede-text">
          <h2>{active.finding}</h2>
          <p>{active.boundary}</p>
          {selected==='movement'&&<p>Statewide · {ruralBasis==='all-days'?'all seven days counted':'working days only'}</p>}
        </div>
        <div className="gr-lede-figure">
          <strong>{active.figure.value}</strong>
          <small>{active.figure.unit}</small>
        </div>
      </div>
    </header>}{active.available ? selected==='rankings'?<SubjectRankings/>:selected==='service'?<UlbServiceRadar/>:selected==='ulb'?<UlbRadar/>:selected==='movement'?<RuralMovement findingStated basis={ruralBasis} onBasisChange={setRuralBasis}/>:selected==='register'?<InfrastructureSeries/>:<DeliveryPlans/>:<p>This comparison has no eligible retained evidence.</p>}</div>;
}
