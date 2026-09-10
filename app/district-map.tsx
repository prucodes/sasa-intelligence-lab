'use client';
import {useEffect,useId,useState} from 'react';
import {matchDistrictMeasure,projectDistricts,type DistrictMeasure,type DistrictShape} from '@/lib/visual-evidence';
import './visual-intelligence.css';

export function DistrictMap({rows,selected,onSelect,title,unit,diverging=false,maximum,shapes:provided}: {
  rows:DistrictMeasure[];selected:string;onSelect:(district:string)=>void;title:string;unit:string;diverging?:boolean;maximum?:number;shapes?:DistrictShape[];
}){
  const [loaded,setLoaded]=useState<DistrictShape[]|null>(null);
  const [failed,setFailed]=useState(false);
  const hatch=useId().replace(/:/g,'');
  useEffect(()=>{
    if(provided)return;
    let alive=true;
    fetch('/ap-districts.geojson').then(response=>{if(!response.ok)throw new Error('Boundary request failed');return response.json();}).then(projectDistricts).then(shapes=>{if(alive)setLoaded(shapes);}).catch(()=>{if(alive)setFailed(true);});
    return()=>{alive=false;};
  },[provided]);
  const shapes=provided??loaded;
  const extent=maximum??Math.max(1,...rows.map(row=>Math.abs(row.value??0)));
  const unmatched=shapes?rows.filter(row=>!shapes.some(shape=>matchDistrictMeasure(shape.d,rows,shapes)===row)):[];
  const selectedRow=rows.find(row=>row.district===selected);
  const format=(v:number|null)=>v===null?'Not available':`${v>0&&diverging?'+':''}${v.toLocaleString('en-IN',{maximumFractionDigits:2})} ${unit}`;
  return <section className="district-evidence-map" aria-label={title}>
    <header><div><span className="vi-kicker">Locate the evidence</span><h3>{title}</h3></div><label><span className="sr-only">Map district</span><select aria-label="Map district" value={selected} onChange={e=>onSelect(e.target.value)}><option value="">All returned districts</option>{[...rows].sort((a,b)=>a.district.localeCompare(b.district)).map(row=><option key={row.district}>{row.district}</option>)}</select></label></header>
    <div className="district-map-stage">{shapes?<svg viewBox="0 0 560 480" role="group" aria-label={`${title} district map`}>
      <defs><pattern id={hatch} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth=".7" opacity=".5"/></pattern></defs>
      {shapes.map(shape=>{
        const row=matchDistrictMeasure(shape.d,rows,shapes);const value=row?.value;
        const ink=diverging&&value!==null&&value!==undefined&&value<0?'var(--vi-decrease)':'var(--vi-increase)';
        const fill=value===null||value===undefined?`url(#${hatch})`:`color-mix(in srgb, ${ink} ${12+Math.min(1,Math.abs(value)/extent)*80}%, var(--surface))`;
        return <path key={shape.d} d={shape.path} fill={fill} className={selected&&row?.district===selected?'is-selected':''} role={row?'button':undefined} tabIndex={row?0:undefined} aria-pressed={row?selected===row.district:undefined} aria-label={row?`${row.district}: ${format(row.value)}`:`${shape.d}: no uniquely matched source district`} onClick={()=>row&&onSelect(selected===row.district?'':row.district)} onKeyDown={e=>{if(row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(selected===row.district?'':row.district);}}}><title>{row?`${row.district}: ${format(row.value)}. ${row.detail}`:shape.d}</title></path>;
      })}
    </svg>:<p className="map-unavailable">{failed?'Map unavailable. Every source district remains in the selector.':'Loading district boundaries…'}</p>}</div>
    <div className="map-scale"><span>{diverging?`−${extent.toFixed(1)}`:'0'}</span><i className={diverging?'is-diverging':''}/><span>{extent.toLocaleString('en-IN',{maximumFractionDigits:1})}{maximum&&rows.some(row=>row.value!==null&&row.value>maximum)?'+':''} {unit}</span></div>
    <div className="map-selected-reading" aria-live="polite"><b>{selectedRow?.district??'Choose a district'}</b><strong>{selectedRow?format(selectedRow.value):`${rows.length} districts`}</strong><p>{selectedRow?.detail??'Selection focuses the accompanying figures or review list. Hatching indicates missing or unmatched evidence.'}</p></div>
    <details className="map-boundary"><summary>2022 boundary reference{unmatched.length?` · ${unmatched.length} source labels available in the selector only`:''}</summary><p>2022 district boundaries provide a location reference. Matching names do not certify that current administrative extents are unchanged. New, ambiguous or unmatched districts remain in the selector; no value is assigned to a guessed polygon. Colour uses a linear scale{maximum?' capped at the legend maximum; exact values remain visible':''}.</p>{unmatched.length>0&&<p>{unmatched.map(row=>row.district).join(' · ')}</p>}</details>
  </section>;
}
