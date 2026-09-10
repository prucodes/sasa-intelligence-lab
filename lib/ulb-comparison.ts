import {getOverviewIssues,type ReviewIssue,type ReviewRow,type ReviewIssueId} from './overview';
import {observedMedian} from './visual-evidence';

export function buildUlbComparison(issue:ReviewIssue){
  const points=issue.rows.filter(row=>row.basis>0&&row.completed>=0&&row.completed<=row.basis).map(row=>({...row,rate:row.completed/row.basis*100}));
  const unplotted=issue.rows.filter(row=>!points.some(point=>point.key===row.key)).map(row=>({...row,reason:row.basis===0?'Zero denominator — no completion rate':'Reported completion exceeds the denominator — inspect the source'}));
  const median=observedMedian(points.map(point=>point.basis));
  const groups=new Map<string,{basis:number;rate:number;points:typeof points}>();
  for(const point of points){const key=`${point.basis}|${point.rate}`;const group=groups.get(key)??{basis:point.basis,rate:point.rate,points:[]};group.points.push(point);groups.set(key,group);}
  return {...issue,points,unplotted,median,coordinates:[...groups.values()]};
}
export function getUlbComparison(id:ReviewIssueId='sanitation'){return buildUlbComparison(getOverviewIssues().find(issue=>issue.id===id)!);}
export function deliveryPosition(row:ReviewRow){
  if(row.basis<=0)return 'No rate';
  if(row.completed>row.basis)return 'Above denominator';
  if(row.completed===row.basis)return 'Reported complete';
  if(row.completed===0)return 'No completion reported';
  return 'Partly delivered';
}
