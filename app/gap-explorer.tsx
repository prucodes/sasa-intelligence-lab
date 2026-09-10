'use client';
import {useState,useEffect} from 'react';
import {getGapCapabilities} from '@/lib/gap-capabilities';
import {RuralMovement} from './rural-movement';
import {InfrastructureSeries} from './infrastructure-series';
import {DeliveryPlans} from './delivery-plans';
import {UlbRadar} from './ulb-radar';
import {UlbServiceRadar} from './ulb-service-radar';
import {SubjectRankings} from './subject-rankings';
import './evidence-expansion.css';
export function GapExplorer(){
  const capabilities=getGapCapabilities();
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
  return <div className="gap-explorer"><div className="gap-capability-note"><span><b>{capabilities.filter(c=>c.available).length} evidence reviews available</b> · eligibility assessed per comparison</span><span>Analytical comparisons · official ratings unassigned</span></div><div className="evidence-tabs" aria-label="Available gap analyses">{capabilities.map(c=><button key={c.id} aria-pressed={selected===c.id} disabled={!c.available} onClick={()=>setSelected(c.id)}>{c.label}</button>)}</div>{!['movement','ulb','service','rankings'].includes(selected)&&<p className="ew-caption">{active.scope} · {active.boundary}</p>}{active.available ? selected==='rankings'?<SubjectRankings/>:selected==='service'?<UlbServiceRadar/>:selected==='ulb'?<UlbRadar/>:selected==='movement'?<RuralMovement/>:selected==='register'?<InfrastructureSeries/>:<DeliveryPlans/>:<p>This comparison has no eligible retained evidence.</p>}</div>;
}
