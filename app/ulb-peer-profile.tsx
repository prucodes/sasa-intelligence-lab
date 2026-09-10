'use client';
import {useState,useEffect} from 'react';
import {getUlbComparison,deliveryPosition} from '@/lib/ulb-comparison';
import {sourceCandidateKey} from '@/lib/snapshots';
import type {EvidenceRecord} from '@/lib/domain';
import type {ReviewIssueId} from '@/lib/overview';
import './ulb-review.css';

export function UlbPeerProfile({records,onInspect}:{records:EvidenceRecord[];onInspect:(id:string)=>void}){
  const [subject,setSubject]=useState<ReviewIssueId>('sanitation');
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get('programme');if(requested&&['sanitation','collection','processing'].includes(requested)){
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubject(requested as ReviewIssueId);
  }},[]);
  const data=getUlbComparison(subject);
  const key=subject==='sanitation'?'sasa_sac_identification_of_new_ihhls_api':subject==='collection'?'sasa_sac_machinery_e_autos_service_model_api':'sasa_100_percent_clearance_of_legacy_waste_api';
  const evidence=records.find(record=>record.tableKey===key&&record.period===data.period&&record.grain==='ULB');
  const candidate=evidence?sourceCandidateKey(evidence.rawFields):null;
  const point=data.points.find(row=>row.key===candidate);
  const unplotted=data.unplotted.find(row=>row.key===candidate);
  const peers=data.points.filter(row=>row.key!==candidate);
  const below=point?peers.filter(row=>row.rate<point.rate-1e-8).length:0;
  const above=point?peers.filter(row=>row.rate>point.rate+1e-8).length:0;
  const equal=peers.length-below-above;
  const rankingSubject=subject==='sanitation'?'toilets':subject==='collection'?'vehicles':'legacy';
  const n=(v:number)=>v.toLocaleString('en-IN',{maximumFractionDigits:1});
  return <section className="ulb-peer-profile" aria-label="ULB delivery position among peers"><header><div><span className="ur-kicker">The reported position</span><h2>Delivery, in context.</h2></div><label><span className="sr-only">Diagnostic comparison programme</span><select aria-label="Diagnostic comparison programme" value={subject} onChange={e=>setSubject(e.target.value as ReviewIssueId)}><option value="sanitation">Household toilets</option><option value="collection">Vehicle delivery</option><option value="processing">Legacy waste clearance</option></select></label></header>
    <div className="up-layout"><div className="up-reading"><span>{data.period} · {data.title}</span><strong>{point?`${n(point.rate)}%`:'No comparable rate'}</strong><b>{point?deliveryPosition(point):unplotted?.reason??'Required measurements missing or held out'}</b>{point&&<p>{n(point.completed)} {data.completedLabel} / {n(point.basis)} {data.basisLabel}<br/>{n(point.value)} {data.unit} reported remaining</p>}{evidence&&<button onClick={()=>onInspect(evidence.id)}>Inspect these figures ↗</button>}</div><div className="up-peers"><h3>{point?'How this compares':'Why no point is plotted'}</h3>{point?<><p>Other ULB candidates in this source and period. Rates describe completion; workloads differ.</p><div className="up-distribution" role="img" aria-label={`${below} peers lower, ${equal} at the same rate, ${above} higher; selected rate ${n(point.rate)} percent`}><span>0%</span><div>{peers.map(peer=><i key={peer.key} style={{left:`${peer.rate}%`}}/>)}<b style={{left:`${point.rate}%`}}/></div><span>100%</span></div><dl><div><dt>Lower rate</dt><dd>{below}</dd></div><div><dt>Same rate</dt><dd>{equal}</dd></div><div><dt>Higher rate</dt><dd>{above}</dd></div></dl><small>The outlined marker is this ULB; thin marks are peers. Overlapping marks are counted in the figures.</small></>:<p>{unplotted?.reason??'This source does not provide an eligible pair of measurements for the selected ULB in its current retained period.'} A missing rate is not a low performance score. Select another programme or inspect the source record.</p>}<a href={"/gap-radar?mode=governed&programme="+subject+(candidate?"&ulb="+encodeURIComponent(candidate):"")}>Open all-ULB comparison ↗</a>{candidate&&<><br/><a href={`/gap-radar?mode=governed&view=rankings&subject=${rankingSubject}&entity=${encodeURIComponent(`${rankingSubject}:${candidate}`)}`}>Open subject rank & evidence profile ↗</a></>}</div></div>
  </section>;
}
