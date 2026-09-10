type NamedPoint={key:string;name:string;x:number;y:number};
/** Keep point coordinates exact; move only labels and connect displaced labels. */
export function RadarNames({points}:{points:NamedPoint[]}){
 const placed:{x:number;y:number;width:number}[]=[];
 return <g aria-label="Named ULB examples" style={{pointerEvents:'none'}}>{points.map(p=>{
  const width=Math.min(210,p.name.length*6.4),lx=Math.max(78,Math.min(780-width,p.x+12));
  let ly=Math.max(96,Math.min(455,p.y-15));
  for(let i=0;i<28&&placed.some(b=>lx<b.x+b.width+8&&lx+width+8>b.x&&Math.abs(ly-b.y)<19);i++)ly=ly+20>457?96:ly+20;
  placed.push({x:lx,y:ly,width});
  return <g key={p.key}><line x1={p.x} y1={p.y} x2={lx} y2={ly-4} stroke="currentColor" opacity=".35"/><text x={lx} y={ly} style={{fontSize:10,fontWeight:650,fill:'var(--ink)',paintOrder:'stroke',stroke:'var(--surface,#fff)',strokeWidth:4,strokeLinejoin:'round'}}>{p.name}</text></g>;
 })}</g>;
}
