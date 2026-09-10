import {sameDistrict} from './crosswalk';

export interface DistrictMeasure { district:string; value:number|null; detail:string }
export interface DistrictShape { d:string; path:string }
const expanded=(name:string)=>name.toUpperCase().replace(/[^A-Z]/g,'')==='SPSRNELLORE'?'SRI POTTI SRIRAMULU NELLORE':name;

/** A label is attached only when both directions of the match are unique. */
export function matchDistrictMeasure(name:string,rows:DistrictMeasure[],shapes:DistrictShape[]) {
  const candidates=rows.filter(row=>sameDistrict(expanded(row.district),expanded(name)));
  if(candidates.length!==1)return null;
  return shapes.filter(shape=>sameDistrict(expanded(shape.d),expanded(candidates[0].district))).length===1?candidates[0]:null;
}

export interface MovementPoint {district:string;pairs:number;julyRate:number|null;augustRate:number|null;changePercentagePoints:number|null}
export function eligibleMovementPoints(rows:MovementPoint[]) {
  return rows.filter((r):r is MovementPoint & {julyRate:number;augustRate:number;changePercentagePoints:number}=>r.pairs>0&&r.julyRate!==null&&r.augustRate!==null&&r.changePercentagePoints!==null&&Number.isFinite(r.julyRate)&&Number.isFinite(r.augustRate)&&Number.isFinite(r.changePercentagePoints)&&r.julyRate>=0&&r.julyRate<=1&&r.augustRate>=0&&r.augustRate<=1);
}
export function observedMedian(values:number[]) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length?sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2:null;
}

export function projectDistricts(value:unknown):DistrictShape[] {
  const collection=value as {features?:Array<{properties:{d:string};geometry:{type:string;coordinates:number[][][]|number[][][][]}}>};
  if(!Array.isArray(collection?.features))throw new Error('District boundaries unavailable');
  const width=560,lon0=76.761,lon1=84.761,lat0=12.624,lat1=19.166;
  const height=width*(lat1-lat0)/((lon1-lon0)*Math.cos((lat0+lat1)/2*Math.PI/180));
  const ring=(coordinates:number[][])=>coordinates.map(([x,y],index)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Invalid boundary coordinate');
    return `${index?'L':'M'}${((x-lon0)/(lon1-lon0)*width).toFixed(1)} ${((lat1-y)/(lat1-lat0)*height).toFixed(1)}`;
  }).join('')+'Z';
  return collection.features.map(feature=>{
    if(!feature.properties?.d||!['Polygon','MultiPolygon'].includes(feature.geometry?.type))throw new Error('Invalid district boundary');
    return {d:feature.properties.d,path:feature.geometry.type==='Polygon'?(feature.geometry.coordinates as number[][][]).map(ring).join(''):(feature.geometry.coordinates as number[][][][]).flatMap(polygon=>polygon.map(ring)).join('')};
  });
}
