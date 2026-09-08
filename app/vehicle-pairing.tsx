'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { getVehiclePairing } from '@/lib/vehicle-pairing';
import './vehicle-pairing.css';

function subscribeCompact(listener:()=>void) {
  if(typeof window.matchMedia!=='function')return ()=>{};
  const query=window.matchMedia('(max-width: 600px)');query.addEventListener('change',listener);
  return ()=>query.removeEventListener('change',listener);
}
const compactSnapshot=()=>window.matchMedia?.('(max-width: 600px)').matches ?? false;

export function VehiclePairing() {
  const data = useMemo(()=>getVehiclePairing(),[]);
  const compact=useSyncExternalStore(subscribeCompact,compactSnapshot,()=>false);
  const [selected,setSelected] = useState(data.points.find(point=>point.orders>0&&point.supplied===0)?.key ?? data.points[0]?.key ?? '');
  const point = data.points.find(point=>point.key===selected);
  const coordinate = data.coordinates.find(group=>group.points.some(point=>point.key===selected));
  const max = Math.max(50,Math.ceil(Math.max(...data.points.flatMap(point=>[point.orders,point.supplied]))/50)*50);
  const width=compact?360:648,height=compact?310:374,left=58,right=24,top=30,bottom=58;
  const x = (value:number)=>left+value/max*(width-left-right);
  const y = (value:number)=>height-bottom-value/max*(height-top-bottom);
  const ticks = compact?[0,max/2,max]:[0,max/4,max/2,max*3/4,max];
  if (!point) return null;
  return <section className="vehicle-pairing" aria-labelledby="vehicle-pairing-title">
    <header><div><span className="eyebrow">Same source · same period · reported counts</span><h2 id="vehicle-pairing-title">Orders issued. Vehicles supplied?</h2><p>Read procurement stages together without mixing sources or years.</p></div><span className="vehicle-period">{data.period}</span></header>
    <div className="vehicle-pair-body">
      <div className="vehicle-plot">
        <div className="vehicle-plot-read"><strong>{data.orderedNone}<small> / {data.points.length}</small></strong><span>paired ULB-name candidates report<br/><b>work orders, but zero supplied.</b></span></div>
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Work orders versus supplied vehicles. Select a point or use the ULB list.">
          {ticks.map(tick=><g key={tick}><line x1={x(tick)} x2={x(tick)} y1={top} y2={height-bottom}/><line x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text x={x(tick)} y={height-bottom+24} textAnchor="middle">{tick}</text><text x={left-8} y={y(tick)+4} textAnchor="end">{tick}</text></g>)}
          <text className="vp-axis-label" x={(left+width-right)/2} y={height-6} textAnchor="middle">Work orders issued · vehicles</text><text className="vp-axis-label" transform="rotate(-90)" x={-(top+height-bottom)/2} y={14} textAnchor="middle">Vehicles supplied</text>
          {data.coordinates.map(group=><circle key={group.key} className={coordinate?.key===group.key?'is-selected':undefined} cx={x(group.orders)} cy={y(group.supplied)} r={Math.min(compact?9:14,(compact?3:5)+Math.sqrt(group.points.length)*1.5)} role="button" tabIndex={0} aria-pressed={coordinate?.key===group.key} aria-label={`${group.orders} ordered, ${group.supplied} supplied: ${group.points.length} ULB-name candidates`} onClick={()=>setSelected(group.points[0].key)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(group.points[0].key);}}}><title>{group.points.map(point=>point.ulb).join(', ')}</title></circle>)}
        </svg>
        <p>{data.points.length} candidates share {data.coordinates.length} coordinate positions. Larger dots group identical counts; positions are not shifted to separate them.</p>
      </div>
      <aside className="vehicle-pair-detail" aria-label="Selected procurement evidence">
        <label>Browse a ULB<select aria-label="Browse a procurement ULB" value={selected} onChange={event=>setSelected(event.target.value)}>{[...new Set(data.points.map(point=>point.district))].sort().map(district=><optgroup key={district} label={district}>{data.points.filter(point=>point.district===district).sort((a,b)=>a.ulb.localeCompare(b.ulb)).map(point=><option key={point.key} value={point.key}>{point.ulb}</option>)}</optgroup>)}</select></label>
        <div className="vehicle-selected" aria-live="polite"><small>Selected source record</small><h3>{point.ulb}</h3><p>{point.district} · {data.period}</p><dl><div><dt>Work orders</dt><dd>{point.orders.toLocaleString('en-IN')}</dd></div><div><dt>Supplied</dt><dd>{point.supplied.toLocaleString('en-IN')}</dd></div></dl><p>{point.orders>0&&point.supplied===0?'Orders are reported; supplied count is explicitly zero. This is not a missing value.':point.orders===0&&point.supplied===0?'Both counts are reported as zero. Neither is treated as missing.':'Supply is reported. Delivery dates and deployment are not established.'}</p></div>
        {coordinate && coordinate.points.length>1 && <details><summary>{coordinate.points.length} candidates at this point</summary><div className="vehicle-point-members">{coordinate.points.map(member=><button key={member.key} aria-pressed={member.key===selected} onClick={()=>setSelected(member.key)}>{member.ulb}<small>{member.district}</small></button>)}</div></details>}
      </aside>
    </div>
    <footer><div><b>{data.supplyReported}</b><span>report positive supply</span></div><div><b>{data.zeroBoth}</b><span>report zero on both axes</span></div><p><b>{data.points.length} paired / {data.observedFrame} observed-name reference frame</b> · {data.returnedCandidates} source candidates returned; {data.missing} lack a valid pair; {data.disputed} disputed; {data.missingIdentity} rows lack identity. Not an official statewide denominator.</p></footer>
    <details className="vehicle-method"><summary>Source & reading boundary</summary><p>{data.source} · {data.tableKey} · ULB grain · {data.period}. Each dot uses two counts from the same source record. No name crosswalk, national-rank association, delay estimate or performance score is inferred. Overlapping names can be browsed individually.</p></details>
  </section>;
}
