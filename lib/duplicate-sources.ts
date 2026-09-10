import { governedSnapshots, type SnapshotEnvelope, type SnapshotRecord } from './snapshots';

/**
 * Endpoints that serve the same dataset.
 *
 * The September 2026 platform revision merged several sources and kept serving them
 * under their old keys. Three endpoints, `sasa_50_percent_greencover_api`,
 * `sasa_50_percent_rejuvenation_api` and `sasa_50_percent_green_spaces_api`, now return
 * byte-identical rows carrying all three programmes' measures in one table.
 * `soak_pits_api` returns Compost Pits rows and says so in its own `work_name` column.
 *
 * Treating those as separate programmes double- and triple-counts them. Nothing about a
 * dataset's name reveals this, so it is detected from content: identical row sets mean
 * one dataset, however many keys it answers to. The first key alphabetically is treated
 * as canonical purely so the choice is stable and explainable, not because it is more
 * correct than the others.
 *
 * Detection is by content, so if the platform separates them again the duplicate flag
 * disappears on the next pull without anyone editing a list.
 */

export interface DuplicateGroup {
  /** The key whose rows every member repeats. */
  canonical: string;
  /** Keys serving the same rows, excluded from any total. */
  duplicates: string[];
  rows: number;
  /** Distinct `work_name`-style labels the members claim, when they disagree. */
  claimedLabels: string[];
}

/** Row content only: the descriptive columns that differ between copies are ignored. */
function contentSignature(records: SnapshotRecord[]): string {
  return records
    .map((record) => JSON.stringify(
      Object.keys(record).filter((key) => key !== 'work_name' && key !== 'units').sort()
        .map((key) => [key, record[key]]),
    ))
    .sort()
    .join('\n');
}

function labelOf(snapshot: SnapshotEnvelope): string | null {
  const names = new Set(snapshot.records.map((record) => String(record.work_name ?? '').trim()).filter(Boolean));
  return names.size === 1 ? [...names][0] : null;
}

export function getDuplicateSourceGroups(): DuplicateGroup[] {
  const bySignature = new Map<string, SnapshotEnvelope[]>();
  for (const snapshot of governedSnapshots) {
    // An empty dataset has nothing to compare; two empties are not evidence of anything.
    if (!snapshot.records.length) continue;
    const signature = contentSignature(snapshot.records);
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), snapshot]);
  }

  const groups: DuplicateGroup[] = [];
  for (const members of bySignature.values()) {
    if (members.length < 2) continue;
    const keys = members.map((snapshot) => snapshot.responseMetadata.tableKey).sort();
    groups.push({
      canonical: keys[0],
      duplicates: keys.slice(1),
      rows: members[0].records.length,
      claimedLabels: [...new Set(members.map(labelOf).filter((label): label is string => label !== null))].sort(),
    });
  }
  return groups.sort((a, b) => b.duplicates.length - a.duplicates.length || a.canonical.localeCompare(b.canonical));
}

/** Keys that repeat another source's rows. Exclude these from any corpus-wide total. */
export function duplicateSourceKeys(): Set<string> {
  return new Set(getDuplicateSourceGroups().flatMap((group) => group.duplicates));
}

export interface DuplicateSourceSummary {
  groups: DuplicateGroup[];
  /** Endpoints answering with rows another endpoint already returned. */
  redundantKeys: number;
  /** Rows that would be counted more than once if every key were treated separately. */
  redundantRows: number;
  boundary: string;
}

export function getDuplicateSourceSummary(): DuplicateSourceSummary {
  const groups = getDuplicateSourceGroups();
  return {
    groups,
    redundantKeys: groups.reduce((total, group) => total + group.duplicates.length, 0),
    redundantRows: groups.reduce((total, group) => total + group.rows * group.duplicates.length, 0),
    boundary: 'Detected by comparing row content, not dataset names. Repeated endpoint copies are excluded from content totals and combined programme use. Raw-retention counts still include them and are labelled separately.',
  };
}

/** Physical retention and endpoint-distinct content are different facts. */
export function getCorpusEvidenceCounts() {
  const aliases=duplicateSourceKeys();
  const rawRows=governedSnapshots.reduce((sum,source)=>sum+source.records.length,0);
  const rowsExcludingAliases=governedSnapshots.filter(source=>!aliases.has(source.responseMetadata.tableKey)).reduce((sum,source)=>sum+source.records.length,0);
  return {rawRows,rowsExcludingAliases,aliasRows:rawRows-rowsExcludingAliases,aliasRoutes:aliases.size};
}
