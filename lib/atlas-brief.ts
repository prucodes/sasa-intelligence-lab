import {governedSnapshotByKey} from './snapshots';
import {serviceSnapshot} from './ulb-service';
import {type AtlasMeasureId, type AtlasModel, type AtlasUlb} from './ulb-atlas';

/** The exported brief describes exactly the visible rows, never a hidden statewide cohort. */
export function atlasBrief(model: AtlasModel, rows: AtlasUlb[], measureId: AtlasMeasureId, scope: string): string {
  const measure = model.measures.find((entry) => entry.id === measureId)!;
  const snapshot = governedSnapshotByKey.get(measure.source);
  const provenance = measureId === 'reach' || measureId === 'segregation'
    ? Object.entries(serviceSnapshot.generatedFrom).map(([key, source]) => `${key}: retained reference-day response generated ${source.referenceDay.generatedAt}; SHA-256 ${source.referenceDay.sha256}`)
    : snapshot ? [`Retained response: ${snapshot.responseMetadata.responseId}; generated ${snapshot.responseMetadata.generatedAt}`] : [];
  const usable = rows.filter((row) => row.cells[measureId]?.state === 'value');
  const held = rows.filter((row) => row.cells[measureId]?.state === 'held');
  const missing = rows.length - usable.length - held.length;
  return [
    'SASA INTELLIGENCE LAB · FILTERED EVIDENCE BRIEF',
    `Scope: ${scope} · ${rows.length} visible ULBs`,
    `Measure: ${measure.label} · ${measure.period}`,
    `Population: ${usable.length} usable, ${held.length} held out, ${missing} not reported`,
    `Definition: ${measure.reads}`,
    `Boundary: ${measure.boundary}`,
    `Source: ${measure.source}`,
    ...provenance,
    '',
    ...rows.map((row) => {
      const cell = row.cells[measureId];
      return `${row.name} · ${row.district} · urban body code ${row.code}: ${cell?.state === 'value' ? `${cell.display}${cell.count ? ` (${cell.count.done.toLocaleString('en-IN')} / ${cell.count.of.toLocaleString('en-IN')})` : ''}${cell.gap !== undefined && measure.gapLabel ? `; ${cell.gap.toLocaleString('en-IN')} ${measure.gapLabel}` : ''}` : cell?.state === 'held' ? `Held out: ${cell.reason}` : 'Not reported'}`;
    }),
    '', 'Retained source evidence; not a live reading, overall score or causal assessment.',
  ].join('\n');
}
