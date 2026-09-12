type NamedPoint={key:string;name:string;x:number;y:number};
type Box={x:number;y:number;width:number};
type Bounds={left:number;right:number;top:number;bottom:number};
/** Keep point coordinates exact; move only labels and connect displaced labels. `reserved` holds names already drawn, so examples steer around them. */
export function RadarNames({points,bounds={left:78,right:780,top:96,bottom:455},size=10,reserved=[]}:{points:NamedPoint[];bounds?:Bounds;size?:number;reserved?:Box[]}){
 const placed:Box[]=[...reserved];
 return <g aria-label="Named ULB examples" style={{pointerEvents:'none'}}>{points.map(p=>{
  const width=Math.min(210,p.name.length*size*.64),lx=Math.max(bounds.left,Math.min(bounds.right-width,p.x+12));
  let ly=Math.max(bounds.top,Math.min(bounds.bottom,p.y-15));
  for(let i=0;i<28&&placed.some(b=>lx<b.x+b.width+8&&lx+width+8>b.x&&Math.abs(ly-b.y)<19);i++)ly=ly+20>bounds.bottom+2?bounds.top:ly+20;
  placed.push({x:lx,y:ly,width});
  return <g key={p.key}><line x1={p.x} y1={p.y} x2={lx} y2={ly-4} stroke="currentColor" opacity=".35"/><text x={lx} y={ly} style={{fontSize:size,fontWeight:650,fill:'var(--ink)',paintOrder:'stroke',stroke:'var(--surface,#fff)',strokeWidth:4,strokeLinejoin:'round'}}>{p.name}</text></g>;
 })}</g>;
}
