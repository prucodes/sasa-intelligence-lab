'use client';
import {useState} from 'react';
import {eligibleMovementPoints,observedMedian,type MovementPoint} from '@/lib/visual-evidence';
import './visual-intelligence.css';

export function RuralRadar({rows,selected,onSelect,overall}:{rows:MovementPoint[];selected:string;onSelect:(district:string)=>void;overall?:MovementPoint}){
  const [view,setView]=useState<'rates'|'change'>('rates');
  const points=eligibleMovementPoints(rows);
  const median=observedMedian(points.map(point=>point.julyRate))??.5;
  const maxChange=Math.max(5,Math.ceil(Math.max(...points.map(point=>Math.abs(point.changePercentagePoints)),0)/5)*5);
  const left=64,top=40,width=510,height=340;
  const x=(value:number)=>left+value*width;
  const y=(point:typeof points[number])=>top+height*(view==='rates'?1-point.augustRate:.5-point.changePercentagePoints/(2*maxChange));
  const selectedPoint=points.find(point=>point.district===selected);
  const reading=eligibleMovementPoints(selected?(selectedPoint?[selectedPoint]:[]):overall?[overall]:[])[0];
  const labels=new Set([selected,...(view==='change'?[...points].sort((a,b)=>Math.abs(b.changePercentagePoints)-Math.abs(a.changePercentagePoints)).slice(0,2).map(point=>point.district):[])]);
  const ticks=[0,.25,.5,.75,1];
  const pct=(value:number)=>`${(value*100).toFixed(2)}%`;
  const pp=(value:number)=>`${value>0?'+':''}${value.toFixed(2)} pp`;
  return <section className="rural-radar" aria-label="District collection movement radar">
    <div className="radar-toolbar"><div className="radar-view-switch" role="group" aria-label="Radar chart view"><button aria-pressed={view==='rates'} onClick={()=>setView('rates')}>July vs August</button><button aria-pressed={view==='change'} onClick={()=>setView('change')}>Starting point & change</button></div><label><span className="sr-only">Comparison scope</span><select aria-label="Rural comparison district" value={selected} onChange={event=>onSelect(event.target.value)}><option value="">All matched districts</option>{[...rows].sort((a,b)=>a.district.localeCompare(b.district)).map(point=><option key={point.district}>{point.district}</option>)}</select></label></div>
    <div className="radar-exploration"><div className="radar-plot">
      <svg viewBox="0 0 610 450" role="group" aria-label={view==='rates'?'July versus August collection reporting by district':'July starting rate versus change by district'}>
        {view==='rates'?<><path d={`M${left} ${top}H${left+width}L${left} ${top+height}Z`} className="radar-zone-increase"/><path d={`M${left+width} ${top}V${top+height}H${left}Z`} className="radar-zone-decrease"/></>:<><rect x={left} y={top} width={width} height={height/2} className="radar-zone-increase"/><rect x={left} y={top+height/2} width={width} height={height/2} className="radar-zone-decrease"/></>}
        {ticks.map(tick=><g key={tick}><line className="radar-grid-line" x1={x(tick)} x2={x(tick)} y1={top} y2={top+height}/><line className="radar-grid-line" x1={left} x2={left+width} y1={top+height*(1-tick)} y2={top+height*(1-tick)}/><text className="radar-tick" x={x(tick)} y={top+height+21} textAnchor="middle">{tick*100}%</text><text className="radar-tick" x={left-12} y={top+height*(1-tick)+4} textAnchor="end">{view==='rates'?`${tick*100}%`:`${(tick-.5)*2*maxChange>0?'+':''}${(tick-.5)*2*maxChange}`}</text></g>)}
        {view==='rates'?<line className="radar-reference-line" x1={left} y1={top+height} x2={left+width} y2={top}/>:<><line className="radar-reference-line" x1={left} x2={left+width} y1={top+height/2} y2={top+height/2}/><line className="radar-reference-line" x1={x(median)} x2={x(median)} y1={top} y2={top+height}/></>}
        <text x={left+12} y={top+19} className="radar-zone-label">{view==='rates'?'Higher in August':'Increase'}</text><text x={left+width-12} y={top+height-13} textAnchor="end" className="radar-zone-label">{view==='rates'?'Lower in August':'Decrease'}</text>
        <text x={left+width/2} y={432} textAnchor="middle" className="radar-axis-label">July collection reporting rate</text><text transform={`translate(15 ${top+height/2}) rotate(-90)`} textAnchor="middle" className="radar-axis-label">{view==='rates'?'August collection reporting rate':'Change in percentage points'}</text>
        {[...points].sort((a,b)=>Number(a.district===selected)-Number(b.district===selected)).map(point=><g key={point.district} role="button" tabIndex={0} aria-pressed={selected===point.district} aria-label={`${point.district}: July ${pct(point.julyRate)}, August ${pct(point.augustRate)}, ${pp(point.changePercentagePoints)}, ${point.pairs.toLocaleString('en-IN')} pairs`} className={`radar-point ${point.changePercentagePoints<0?'is-decrease':'is-increase'} ${selected===point.district?'is-selected':''}`} onClick={()=>onSelect(selected===point.district?'':point.district)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(selected===point.district?'':point.district);}}}>
          <circle className="radar-point-hit" cx={x(point.julyRate)} cy={y(point)} r="14"/><circle className="radar-point-ring" cx={x(point.julyRate)} cy={y(point)} r={selected===point.district?11:7}/><circle className="radar-point-dot" cx={x(point.julyRate)} cy={y(point)} r={selected===point.district?6:4}/>
          {labels.has(point.district)&&<text className="radar-point-label" x={x(point.julyRate)+(point.julyRate>.72?-13:13)} y={y(point)-12} textAnchor={point.julyRate>.72?'end':'start'}>{point.district}</text>}
          <title>{point.district}: {pct(point.julyRate)} → {pct(point.augustRate)}; {pp(point.changePercentagePoints)}; {point.pairs} matched GP-day pairs</title>
        </g>)}
      </svg>
      <p className="radar-chart-note">{view==='rates'?'The diagonal means no change. Above it: a higher reported rate in August. Below it: a lower rate.':`Horizontal line: no change. Vertical line: the observed district median starting rate (${pct(median)}), an exploratory reference rather than a performance target.`} Each dot is one district; equal dot sizes do not imply equal observation counts.</p>
    </div><aside className="radar-selected" role="group" aria-label="Matched collection comparison" aria-live="polite"><span className="vi-kicker">{selectedPoint?'Selected district':'All matched districts'}</span><h3>{selectedPoint?.district??`Across ${points.length} districts`}</h3>{reading?<><strong className="radar-selected-change">{pp(reading.changePercentagePoints)}</strong><p>{reading.changePercentagePoints>0?'Increase':reading.changePercentagePoints<0?'Decrease':'No change in the reported rate'} over the matched first week.</p><dl><div><dt>1–7 July</dt><dd>{pct(reading.julyRate)}</dd></div><div><dt>1–7 August</dt><dd>{pct(reading.augustRate)}</dd></div></dl><p>{reading.pairs.toLocaleString('en-IN')} matched GP-day pairs</p>{selectedPoint?<button className="radar-clear" onClick={()=>onSelect('')}>Clear district selection</button>:<p>Select one of {points.length} dots or choose a district to inspect its movement.</p>}</>:<><p>Select a dot or choose a district to connect its starting position, change and paired evidence.</p><dl><div><dt>Districts plotted</dt><dd>{points.length}</dd></div><div><dt>Increased</dt><dd>{points.filter(point=>point.changePercentagePoints>0).length}</dd></div><div><dt>Decreased</dt><dd>{points.filter(point=>point.changePercentagePoints<0).length}</dd></div></dl></>}<p className="radar-boundary">“pp” means percentage points. Reported change does not establish a performance rating or its cause.</p></aside></div>
  </section>;
}
