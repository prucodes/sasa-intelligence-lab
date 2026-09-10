import { currentSnapshotRecords, governedSnapshotByKey, governedSnapshotStats, snapshotPeriod, sourceCandidateKey, recordPeriodLabel, type SnapshotRecord } from './snapshots';

export const vehicleSourceKey = 'sasa_sac_machinery_e_autos_service_model_api';
export interface VehiclePoint { key:string; ulb:string; district:string; orders:number; supplied:number }

function measurement(raw:string | undefined | null):number | null {
  // Ten retained snapshots carry JSON null, so `SnapshotRecord`'s string typing is not
  // true of the data. `??` at the call site falls through null, which means both
  // candidate columns being null hands this a null rather than undefined.
  if (raw === undefined || raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Input is one source-period only. Duplicate signatures are never additive. */
export function pairVehicleRecords(records:SnapshotRecord[]) {
  if(new Set(records.map(recordPeriodLabel)).size>1) throw new Error('Vehicle pairs require one reporting period.');
  const groups = new Map<string,SnapshotRecord[]>();
  let missingIdentity = 0;
  for (const record of records) {
    const key = sourceCandidateKey(record);
    if (!key || key.split('|').some(part=>!part)) { missingIdentity++; continue; }
    groups.set(key,[...(groups.get(key) ?? []),record]);
  }
  const points:VehiclePoint[] = [];
  let disputed = 0, missing = 0;
  for (const [key,group] of groups) {
    const values = group.map(row=>({orders:measurement(row.actual_work_order_issued ?? row.actual_wrk_order_issued),supplied:measurement(row.achievement ?? row.no_of_vehicles_supplied_in_nos)}));
    if (new Set(values.map(value=>JSON.stringify(value))).size > 1) { disputed++; continue; }
    const value = values[0];
    if (value.orders === null || value.supplied === null) { missing++; continue; }
    points.push({key,ulb:group[0].ulb_name ?? group[0].ulb_nm,district:group[0].district_name ?? group[0].dstrt_nm,orders:value.orders,supplied:value.supplied});
  }
  points.sort((a,b)=>b.orders-a.orders || a.ulb.localeCompare(b.ulb));
  const coordinates = new Map<string,{key:string;orders:number;supplied:number;points:VehiclePoint[]}>();
  for (const point of points) {
    const key = `${point.orders}|${point.supplied}`;
    const coordinate = coordinates.get(key) ?? {key,orders:point.orders,supplied:point.supplied,points:[]};
    coordinate.points.push(point);
    coordinates.set(key,coordinate);
  }
  return {points,coordinates:[...coordinates.values()],disputed,missing,missingIdentity,returnedCandidates:groups.size,
    orderedNone:points.filter(point=>point.orders>0 && point.supplied===0).length,
    supplyReported:points.filter(point=>point.supplied>0).length,
    zeroBoth:points.filter(point=>point.orders===0 && point.supplied===0).length};
}

export function getVehiclePairing() {
  const snapshot = governedSnapshotByKey.get(vehicleSourceKey)!;
  return {...pairVehicleRecords(currentSnapshotRecords(snapshot)),period:snapshotPeriod(snapshot),source:snapshot.responseMetadata.tableName,tableKey:vehicleSourceKey,
    observedFrame:governedSnapshotStats.baselineUlbCandidates};
}
