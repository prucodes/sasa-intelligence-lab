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
import './review-clarity.css';
const groups=[
  {id:'ulbs',label:'Compare ULBs',views:['service','rankings','ulb'],description:'Choose a subject comparison, then a district or ULB.'},
  {id:'rural',label:'Rural trends',views:['movement','register'],description:'Follow collection over time or compare facility-register groups.'},
  {id:'programmes',label:'Programme delivery',views:['works'],description:'Inspect one programme, reporting month and district population.'},
];
export function GapExplorer(){
  const [ruralBasis,setRuralBasis]=useState<RateBasis>('all-days');
  const capabilities=getGapCapabilities(ruralBasis);
  const [selected,setSelected]=useState('service');
  useEffect(()=>{
    const restore=()=>{
      const p=new URLSearchParams(window.location.search),view=p.get('view');
      setRuralBasis(p.get('basis')==='working-days'?'working-days':'all-days');
      setSelected(groups.some(g=>g.views.includes(view??''))?view!:['sanitation','collection','processing'].includes(p.get('programme')??'')?'ulb':'service');
    };
    restore();window.addEventListener('popstate',restore);
    return()=>window.removeEventListener('popstate',restore);
  },[]);
  const active=capabilities.find(c=>c.id===selected)!;
  const group=groups.find(g=>g.views.includes(selected))!;
  const changeRuralBasis=(basis:RateBasis)=>{
    setRuralBasis(basis);
    const url=new URL(window.location.href);url.searchParams.set('basis',basis);
    window.history.replaceState({},'',url);
  };
  const choose=(view:string)=>{
    setSelected(view);
    const url=new URL(window.location.href);url.searchParams.set('view',view);
    // An explicit new comparison starts with its own selectors; do not inherit a different programme.
    for(const key of ['programme','subject','entity','ulb','district'])url.searchParams.delete(key);
    if(view==='movement')url.searchParams.set('basis',ruralBasis);else url.searchParams.delete('basis');
    window.history.pushState({},'',url);
  };
  return <div className="gap-explorer">
    <nav className="review-paths" aria-label="Gap Radar analysis groups">{groups.map(g=><button key={g.id} aria-pressed={group.id===g.id} onClick={()=>choose(g.views[0])}>{g.label}</button>)}</nav>
    <div className="review-choice"><p>{group.description}</p><label className="review-mobile-view">Comparison<select aria-label="Comparison view" value={selected} onChange={e=>choose(e.target.value)}>{capabilities.filter(c=>group.views.includes(c.id)).map(c=><option key={c.id} value={c.id} disabled={!c.available}>{c.label}</option>)}</select></label><div className="evidence-tabs" aria-label="Available gap analyses">{capabilities.filter(c=>group.views.includes(c.id)).map(c=><button key={c.id} aria-pressed={selected===c.id} disabled={!c.available} onClick={()=>choose(c.id)}>{c.label}</button>)}</div></div>
    {active.available ? selected==='rankings'?<SubjectRankings/>:selected==='service'?<UlbServiceRadar/>:selected==='ulb'?<UlbRadar/>:selected==='movement'?<RuralMovement basis={ruralBasis} onBasisChange={changeRuralBasis}/>:selected==='register'?<InfrastructureSeries/>:<DeliveryPlans/>:<p>This comparison has no eligible retained evidence.</p>}</div>;
}
