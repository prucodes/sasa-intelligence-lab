/** Read-only feasibility audit over retained selectors; no matching is approved. */
import { getCollectionProcurementSummary, getIHHLFunnel, getLegacyWasteSummary, getSwachhOutcomeSummary } from '../lib/analytics';
import { sourceCandidateKey } from '../lib/snapshots';

const collection = getCollectionProcurementSummary();
const ihhl = getIHHLFunnel();
const legacy = getLegacyWasteSummary();
const outcomes = getSwachhOutcomeSummary();
const map = (rows: Array<{key:string | null; value:number | null}>) => new Map(rows.flatMap(row => row.key && row.value !== null && Number.isFinite(row.value) ? [[row.key, row.value] as const] : []));
const sets = {
  vehicleDelivery: map(collection.rows.map(row => ({key:sourceCandidateKey(row.raw),value:row.deliveryRatio}))),
  vehicleOrders: map(collection.rows.map(row => ({key:sourceCandidateKey(row.raw),value:row.workOrderRatio}))),
  toiletCompletion: map(ihhl.rows.map(row => ({key:sourceCandidateKey(row.raw),value:row.completionRatio}))),
  wasteClearance: map(legacy.rows.map(row => ({key:sourceCandidateKey(row.raw),value:row.clearanceRatio}))),
  rank2024: map(outcomes.rows.map(row => ({key:row.candidateKey,value:row.nationalRank !== null && row.nationalRank > 0 ? row.nationalRank : null}))),
};
const pairs = [
  ['vehicleDelivery','rank2024'], ['toiletCompletion','rank2024'], ['wasteClearance','rank2024'],
  ['vehicleOrders','vehicleDelivery'], ['vehicleDelivery','toiletCompletion'], ['wasteClearance','toiletCompletion'],
] as const;
console.log(JSON.stringify({
  periods: {vehicles:[...new Set(collection.rows.map(row=>row.period))],toilets:[...new Set(ihhl.rows.map(row=>row.period))],waste:legacy.period,outcomes:outcomes.reportingYear},
  axes:Object.fromEntries(Object.entries(sets).map(([name,values])=>[name,{usable:values.size,zero:[...values.values()].filter(value=>value===0).length,distinctValues:new Set(values.values()).size}])),
  pairings:pairs.map(([x,y])=>{const values=[...sets[x]].flatMap(([key,value])=>sets[y].has(key)?[[value,sets[y].get(key)!]]:[]);return {x,y,exactNamePairs:values.length,xZero:values.filter(v=>v[0]===0).length,yZero:values.filter(v=>v[1]===0).length,distinctCoordinates:new Set(values.map(v=>v.join('|'))).size};}),
  categorical:{odf:outcomes.odfRecords,gfc:outcomes.gfcRecords,rank:outcomes.rankRecords},
},null,2));
