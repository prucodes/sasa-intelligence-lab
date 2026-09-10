import snapshot from '@/data/aggregates/ulb-service-snapshot.json';

export const serviceSnapshot = snapshot;
export type ServiceUlb = typeof snapshot.ulbs[number];
export type ServiceCategory = 'both' | 'collection' | 'segregation' | 'review';
export const serviceCategories: {id:ServiceCategory;label:string;description:string}[] = [
  {id:'both',label:'Doing well on both',description:'Collection and segregation meet the draft references.'},
  {id:'collection',label:'Investigate collection reach',description:'Collection below reference; segregation meets it.'},
  {id:'segregation',label:'Investigate segregation',description:'Collection meets reference; segregation below it.'},
  {id:'review',label:'Priority review: both measures',description:'Collection and segregation below the draft references.'},
];
export function serviceRates(row: Pick<ServiceUlb,'households'|'collected'|'segregated'>) {
  return {collection:row.households>0?row.collected/row.households*100:null,segregation:row.collected>0?row.segregated/row.collected*100:null};
}
export function serviceExclusions(row: ServiceUlb) {
  return [...(row.mappingReviewSecretariats ? ['Native / enriched geographic codes need review'] : []),
    ...(row.households<=0 ? ['Household denominator is zero'] : []),
    ...(row.collected<=0 ? ['No collection reported; segregation / collected is undefined'] : [])];
}
export function serviceCategory(row: ServiceUlb, collectionReference=80, segregationReference=80):ServiceCategory|null {
  if(serviceExclusions(row).length) return null;
  const rates=serviceRates(row);
  if(rates.collection===null || rates.segregation===null) return null;
  return rates.collection>=collectionReference ? rates.segregation>=segregationReference?'both':'segregation' : rates.segregation>=segregationReference?'collection':'review';
}
export function serviceCoordinates(rows: ServiceUlb[]) {
  const groups=new Map<string,{collection:number;segregation:number;ulbs:ServiceUlb[]}>();
  for(const row of rows) {
    const rates=serviceRates(row);
    if(serviceExclusions(row).length || rates.collection===null || rates.segregation===null) continue;
    const key=`${rates.collection}|${rates.segregation}`;
    const group=groups.get(key)??{collection:rates.collection,segregation:rates.segregation,ulbs:[]};
    group.ulbs.push(row);groups.set(key,group);
  }
  return [...groups.values()];
}
