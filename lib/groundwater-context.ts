import previous from '@/data/groundwater-series/2026-10-04/groundwater_aggregatedreadings_api.json';
import latest from '@/data/groundwater-series/2026-10-05/groundwater_aggregatedreadings_api.json';
import { canonicalRecord } from './record-contract.mjs';

/** Capture dates describe retention, not new observations. Compare by source UUID. */
export function getGroundwaterContext() {
  const before = new Map(previous.records.map(row => [row.uuid, canonicalRecord(row)]));
  const current = new Map(latest.records.map(row => [row.uuid, row]));
  const matched = [...current.keys()].filter(key => before.has(key));
  const stamps = [...current.values()].map(row => Number(row.egt)).filter(value => Number.isFinite(value) && value > 0);
  const districts = [...current.values()].filter(row => row.pname === 'Andhra Pradesh').length;
  return {
    tableKey: latest.requestEcho.tableKey,
    captureDates: [previous.coverage.capturedFor, latest.coverage.capturedFor],
    returned: current.size,
    expected: latest.coverage.reportedTotal,
    complete: latest.coverage.complete,
    missing: latest.coverage.shortfall,
    districts,
    subDistricts: current.size - districts,
    matched: matched.length,
    changed: matched.filter(key => before.get(key) !== canonicalRecord(current.get(key))).length,
    readingFrom: stamps.length ? new Date(Math.min(...stamps)).toISOString().slice(0, 10) : null,
    readingTo: stamps.length ? new Date(Math.max(...stamps)).toISOString().slice(0, 10) : null,
  };
}
