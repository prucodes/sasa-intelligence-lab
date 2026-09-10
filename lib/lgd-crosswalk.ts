import {
  governedSnapshotByKey,
  governedSnapshots,
  lgdIdentity,
  normalizeSourceName,
  sourceCandidateKey,
  type SnapshotRecord,
} from './snapshots';

/**
 * The source-supplied LGD crosswalk.
 *
 * Until September 2026 the app had no canonical entity identity. Every cross-source
 * question failed the same gate, `ULB_MATCH_UNREVIEWED`, because matching two
 * departments' spellings of a ULB name is an inference, and an inference is not
 * evidence. The 28 August audit asked the platform for an authoritative ULB master.
 *
 * What arrived instead is better in one respect and worse in another. The LGD-enriched
 * exports carry the mapping *inside the fact rows*: each row states its own departmental
 * label and the LGD district/mandal code the platform assigned it. That is a mapping the
 * source asserts, not one we inferred, so it can be used as evidence. But it is
 * incomplete, it disagrees with itself in places, and it is only present on six datasets.
 *
 * This module reads that mapping out, measures exactly how far it reaches, and reports
 * the disagreements rather than resolving them. It never invents a code for a row that
 * lacks one.
 */

/**
 * Whether two district labels are plausibly the same place spelled differently.
 *
 * "Anantapur" / "ANANTHAPURAMU" and "Baptla" / "BAPATLA" are spellings of one district.
 * "SPSR Nellore" / "KURNOOL" are two different districts 300km apart. The product must
 * not treat those the same way, and it must not decide which is correct, so this only
 * separates "same name, written differently" from "a different name was used", and the
 * second is routed to a human rather than applied.
 */
function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index, ...Array<number>(right.length).fill(0)]);
  for (let column = 0; column <= right.length; column += 1) rows[0][column] = column;
  for (let a = 1; a <= left.length; a += 1) {
    for (let b = 1; b <= right.length; b += 1) {
      rows[a][b] = Math.min(
        rows[a - 1][b] + 1,
        rows[a][b - 1] + 1,
        rows[a - 1][b - 1] + (left[a - 1] === right[b - 1] ? 0 : 1),
      );
    }
  }
  return rows[left.length][right.length];
}

export function sameNameDifferentSpelling(left: string, right: string): boolean {
  const a = normalizeSourceName(left);
  const b = normalizeSourceName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  // A shared word is strong evidence: "ntr district"/"ntr", "spsr nellore"/"... nellore".
  const tokensA = new Set(a.split(' ').filter((token) => token.length > 2));
  const tokensB = new Set(b.split(' ').filter((token) => token.length > 2));
  if ([...tokensA].some((token) => tokensB.has(token))) return true;
  const longest = Math.max(a.length, b.length);
  return longest > 0 && 1 - editDistance(a, b) / longest >= 0.6;
}

/** Datasets that carry both a departmental label and an LGD code on every row. */
export const lgdEnrichedKeys = [
  'ihhl_new_identification_new1_api',
  'swacch_survekshan_info_new1_api',
  'fstps_stps_cotreatment_new1_api',
  'msw_cbg_units_new1_api',
  'cd_waste_process_plants_revival_new1_api',
  'sewage_treated_qty_new1_api',
] as const;

export interface CrosswalkEntry {
  /** Normalised `district|ulb` in the source's own words. */
  sourceKey: string;
  sourceDistrict: string;
  sourceUlb: string;
  lgdDistrictCode: string | null;
  lgdDistrictName: string | null;
  lgdUlbCode: string | null;
  lgdUlbName: string | null;
  /** Datasets that asserted this mapping. */
  sources: string[];
  /** The label actually changed between the departmental and LGD spelling. */
  districtRelabelled: boolean;
  ulbRelabelled: boolean;
  /** More than one LGD code was asserted for this source identity. */
  conflicting: boolean;
}

export interface CrosswalkCoverage {
  entries: CrosswalkEntry[];
  /** Distinct source identities appearing in the LGD-enriched exports. */
  candidates: number;
  /** Of those, how many carry a usable LGD ULB code. */
  resolved: number;
  unresolved: number;
  /** Identities where two datasets asserted different codes. Never auto-resolved. */
  conflicts: CrosswalkEntry[];
  districtRelabels: Array<{ from: string; to: string; ulbs: number; kind: RelabelKind }>;
  ulbRelabels: Array<{ from: string; to: string; kind: RelabelKind }>;
  /**
   * One departmental district label mapped to two or more different LGD districts
   * inside a single dataset. This is the source contradicting itself, not a naming
   * question, and it is the strongest reason the mapping cannot be adopted wholesale.
   */
  selfContradictions: Array<{ tableKey: string; sourceDistrict: string; lgdDistricts: string[] }>;
  datasets: number;
  rows: number;
  rowsWithUlbCode: number;
}

/**
 * `spelling`, the same district written differently; safe to read as one place.
 * `unrelated`, the two labels are not spelling variants of each other. That may be a
 * genuine boundary change, a rename the heuristic cannot see (Rajamahendravaram is
 * Rajahmundry), or a mapping defect. This is triage for a reviewer, never a verdict.
 */
export type RelabelKind = 'spelling' | 'unrelated';

function add(map: Map<string, CrosswalkEntry>, record: SnapshotRecord, tableKey: string) {
  const sourceKey = sourceCandidateKey(record);
  if (!sourceKey) return;
  const lgd = lgdIdentity(record);
  const existing = map.get(sourceKey);
  if (!existing) {
    map.set(sourceKey, {
      sourceKey,
      sourceDistrict: String(record.dstrt_nm ?? record.district_name ?? '').trim(),
      sourceUlb: String(record.ulb_nm ?? record.ulb_name ?? '').trim(),
      lgdDistrictCode: lgd.districtCode,
      lgdDistrictName: lgd.districtName,
      lgdUlbCode: lgd.ulbCode,
      lgdUlbName: lgd.ulbName,
      sources: [tableKey],
      districtRelabelled: false,
      ulbRelabelled: false,
      conflicting: false,
    });
    return;
  }
  if (!existing.sources.includes(tableKey)) existing.sources.push(tableKey);
  // A row that carries a code fills a gap left by one that did not; two rows carrying
  // DIFFERENT codes is a conflict and is recorded as one rather than overwritten.
  for (const [codeField, nameField] of [['lgdUlbCode', 'lgdUlbName'], ['lgdDistrictCode', 'lgdDistrictName']] as const) {
    const incoming = codeField === 'lgdUlbCode' ? lgd.ulbCode : lgd.districtCode;
    const incomingName = nameField === 'lgdUlbName' ? lgd.ulbName : lgd.districtName;
    if (incoming === null) continue;
    if (existing[codeField] === null) {
      existing[codeField] = incoming;
      existing[nameField] = incomingName;
    } else if (existing[codeField] !== incoming) {
      existing.conflicting = true;
    }
  }
}

export function getLgdCrosswalk(): CrosswalkCoverage {
  const map = new Map<string, CrosswalkEntry>();
  let rows = 0;
  let rowsWithUlbCode = 0;
  let datasets = 0;

  for (const tableKey of lgdEnrichedKeys) {
    const snapshot = governedSnapshotByKey.get(tableKey);
    if (!snapshot) continue;
    datasets += 1;
    for (const record of snapshot.records) {
      rows += 1;
      if (lgdIdentity(record).ulbCode) rowsWithUlbCode += 1;
      add(map, record, tableKey);
    }
  }

  const entries = [...map.values()].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  for (const entry of entries) {
    entry.districtRelabelled = Boolean(entry.lgdDistrictName)
      && normalizeSourceName(entry.sourceDistrict) !== normalizeSourceName(entry.lgdDistrictName!);
    entry.ulbRelabelled = Boolean(entry.lgdUlbName)
      && normalizeSourceName(entry.sourceUlb) !== normalizeSourceName(entry.lgdUlbName!);
  }

  const districtPairs = new Map<string, { from: string; to: string; ulbs: number; kind: RelabelKind }>();
  for (const entry of entries.filter((item) => item.districtRelabelled)) {
    const id = `${entry.sourceDistrict}→${entry.lgdDistrictName}`;
    const pair = districtPairs.get(id) ?? {
      from: entry.sourceDistrict,
      to: entry.lgdDistrictName!,
      ulbs: 0,
      kind: sameNameDifferentSpelling(entry.sourceDistrict, entry.lgdDistrictName!) ? 'spelling' as const : 'unrelated' as const,
    };
    pair.ulbs += 1;
    districtPairs.set(id, pair);
  }

  // Self-contradiction is checked per dataset: merging first would hide it behind the
  // cross-dataset conflict count, and a source disagreeing with itself is a different,
  // more serious finding than two sources disagreeing with each other.
  const selfContradictions: CrosswalkCoverage['selfContradictions'] = [];
  for (const tableKey of lgdEnrichedKeys) {
    const snapshot = governedSnapshotByKey.get(tableKey);
    if (!snapshot) continue;
    const byLabel = new Map<string, Set<string>>();
    for (const record of snapshot.records) {
      const source = String(record.dstrt_nm ?? '').trim();
      const lgd = lgdIdentity(record).districtName;
      if (!source || !lgd) continue;
      if (!byLabel.has(source)) byLabel.set(source, new Set());
      byLabel.get(source)!.add(lgd);
    }
    for (const [sourceDistrict, lgdDistricts] of byLabel) {
      if (lgdDistricts.size > 1) {
        selfContradictions.push({ tableKey, sourceDistrict, lgdDistricts: [...lgdDistricts].sort() });
      }
    }
  }

  const resolved = entries.filter((entry) => entry.lgdUlbCode !== null).length;
  return {
    entries,
    candidates: entries.length,
    resolved,
    unresolved: entries.length - resolved,
    conflicts: entries.filter((entry) => entry.conflicting),
    districtRelabels: [...districtPairs.values()]
      // Unrelated-looking mappings first: they are the ones a reviewer must see.
      .sort((a, b) => Number(b.kind === 'unrelated') - Number(a.kind === 'unrelated')
        || b.ulbs - a.ulbs || a.from.localeCompare(b.from)),
    ulbRelabels: entries.filter((entry) => entry.ulbRelabelled)
      .map((entry) => ({
        from: entry.sourceUlb,
        to: entry.lgdUlbName!,
        kind: sameNameDifferentSpelling(entry.sourceUlb, entry.lgdUlbName!) ? 'spelling' as const : 'unrelated' as const,
      }))
      .sort((a, b) => Number(b.kind === 'unrelated') - Number(a.kind === 'unrelated') || a.from.localeCompare(b.from)),
    selfContradictions,
    datasets,
    rows,
    rowsWithUlbCode,
  };
}

export interface IdentityReach {
  /** Source identities across every retained dataset, LGD-enriched or not. */
  totalCandidates: number;
  /** Those the crosswalk can name with an LGD code that no source disputes. */
  covered: number;
  /** Those still identified only by a departmental spelling. */
  uncovered: number;
  coverageRatio: number;
  /** Carry a code, but two sources assert different ones. Not counted as covered. */
  disputed: number;
  /** Datasets whose rows carry an LGD code, out of every retained dataset. */
  enrichedDatasets: number;
  totalDatasets: number;
  /** Set when the mapping cannot be adopted as canonical identity, and why. */
  blocker: string | null;
}

/**
 * How far the crosswalk reaches across everything retained, not just the six datasets
 * that supplied it. This is the number that matters for the identity gate: a mapping
 * covering six of forty-three datasets does not make the other thirty-seven scoreable.
 */
export function getIdentityReach(): IdentityReach {
  const crosswalk = getLgdCrosswalk();
  // A disputed code identifies nothing: two sources naming different places for one
  // identity is exactly the condition the identity gate exists to catch.
  const covered = new Set(crosswalk.entries
    .filter((entry) => entry.lgdUlbCode && !entry.conflicting)
    .map((entry) => entry.sourceKey));
  const all = new Set<string>();
  for (const snapshot of governedSnapshots) {
    for (const record of snapshot.records) {
      const key = sourceCandidateKey(record);
      if (key) all.add(key);
    }
  }
  const matched = [...all].filter((key) => covered.has(key)).length;
  const unrelated = crosswalk.districtRelabels.filter((relabel) => relabel.kind === 'unrelated');
  return {
    totalCandidates: all.size,
    covered: matched,
    uncovered: all.size - matched,
    coverageRatio: all.size ? matched / all.size : 0,
    disputed: crosswalk.conflicts.length,
    enrichedDatasets: crosswalk.datasets,
    totalDatasets: governedSnapshots.length,
    blocker: crosswalk.selfContradictions.length
      ? `${crosswalk.selfContradictions.length} departmental district label${crosswalk.selfContradictions.length === 1 ? '' : 's'} map to more than one LGD district inside a single source, and ${unrelated.length} district mapping${unrelated.length === 1 ? ' pairs' : 's pair'} labels that are not spelling variants of each other. The supplied mapping cannot be adopted as canonical identity until the source resolves them.`
      : null,
  };
}

export interface VintageCorroboration {
  programme: string;
  sources: [string, string];
  compared: number;
  agreeing: number;
  differing: number;
  /** Candidates present in one vintage but not the other. */
  unmatched: number;
  measures: string[];
  verdict: 'corroborated' | 'contradicted' | 'insufficient';
  boundary: string;
}

/**
 * Two vintages of one programme, checked against each other.
 *
 * `sasa_sac_identification_of_new_ihhls_api` (retained 2026-08-28) and
 * `ihhl_new_identification_new1_api` (the LGD-enriched reissue, retained 2026-09-08)
 * report the same programme over the same ULBs. Because both are retained, the product
 * can do something it has never been able to do: check a number against an independent
 * return of the same number, rather than against nothing.
 *
 * Agreement is not proof the figures are right, both could repeat one upstream error.
 * It establishes only that the September reissue did not alter the measures, which is
 * exactly the question a reviewer asks when a source is republished.
 */
export function getIhhlVintageCorroboration(): VintageCorroboration {
  const measures = ['ihhls_approved_by_mohua', 'no_of_benf_identified', 'under_construction', 'completed'];
  const sources: [string, string] = ['sasa_sac_identification_of_new_ihhls_api', 'ihhl_new_identification_new1_api'];
  const latest = (tableKey: string): Map<string, SnapshotRecord> => {
    const snapshot = governedSnapshotByKey.get(tableKey);
    const result = new Map<string, SnapshotRecord>();
    if (!snapshot) return result;
    const month = (record: SnapshotRecord) => Number(record.month_number ?? record.mnth_no ?? 0);
    const newest = Math.max(...snapshot.records.map(month));
    for (const record of snapshot.records) {
      if (month(record) !== newest) continue;
      const key = sourceCandidateKey(record);
      // A row without an identity cannot be matched against the other vintage.
      if (key) result.set(key, record);
    }
    return result;
  };

  const left = latest(sources[0]);
  const right = latest(sources[1]);
  const signature = (record: SnapshotRecord) => measures.map((field) => String(record[field] ?? '').trim()).join('|');

  let agreeing = 0;
  let differing = 0;
  for (const [key, record] of left) {
    const other = right.get(key);
    if (!other) continue;
    if (signature(record) === signature(other)) agreeing += 1; else differing += 1;
  }
  const compared = agreeing + differing;
  const unmatched = (left.size - compared) + (right.size - compared);

  return {
    programme: 'Identification of new IHHLs',
    sources,
    compared,
    agreeing,
    differing,
    unmatched,
    measures,
    verdict: compared === 0 ? 'insufficient' : differing === 0 ? 'corroborated' : 'contradicted',
    boundary: 'Agreement means the September reissue did not alter the measures. It is not evidence that either figure is correct: both vintages could repeat one upstream error.',
  };
}
