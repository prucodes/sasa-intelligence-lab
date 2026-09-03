import {
  governedSnapshotByKey,
  governedSnapshots,
  normalizeSourceName,
  type SnapshotRecord,
} from '@/lib/snapshots';
import { seedDecisions } from '@/lib/crosswalk-seed';

/**
 * Entity resolution against a source-provided anchor registry.
 *
 * Three MEPMA-family exports carry a real `ulb_id`. Within that family the mapping is
 * internally consistent — no id resolves to more than one name and no name to more than
 * one id — so it is usable as an anchor spine for proposing matches from other sources.
 *
 * Nothing here approves a match. Every proposal is a candidate for human review, and the
 * scoring in `similarity` is a ranking hint only. Naive name similarity produces confident
 * wrong answers on exactly the entities that matter: three different towns named Gudur
 * (Nellore, Kurnool, Tirupati) and two named Atmakur (Nellore, Kurnool) all collapse onto
 * one anchor entry. Proposals are therefore scoped by district, and a proposal that has to
 * cross district lines is flagged rather than ranked alongside same-district candidates.
 */

const ANCHOR_TABLE_KEY = 'sasa_mepma_households_promoted_for_home_composite_api';

/** Sources that carry the same `ulb_id`, used to confirm the anchor has no internal conflict. */
const ANCHOR_FAMILY = [
  ANCHOR_TABLE_KEY,
  'sasa_mepma_entrepreneurs_promoted_for_circular_economy_api',
  'sasa_households_promoted_for_terrace_gardening_kitchen_gardens_api',
];

export interface AnchorEntity {
  ulbId: string;
  name: string;
  district: string;
  nameSignature: string;
  districtSignature: string;
}

export type ProposalTier = 'exact' | 'single-candidate' | 'ambiguous' | 'cross-district' | 'unmatched';

export interface MatchCandidate {
  ulbId: string;
  name: string;
  district: string;
  score: number;
  sameDistrict: boolean;
}

export interface QueueItem {
  /** Stable identity for a reviewer decision: the observed name plus its observed district. */
  id: string;
  sourceName: string;
  sourceDistrict: string;
  /** Every table key in which this exact observed name appears. */
  sources: string[];
  occurrences: number;
  tier: ProposalTier;
  candidates: MatchCandidate[];
}

export interface CrosswalkStats {
  anchorSize: number;
  anchorConflicts: number;
  totalPairs: number;
  resolvedPairs: number;
  residualPairs: number;
  residualNames: number;
  singleCandidate: number;
  ambiguous: number;
  crossDistrictOnly: number;
  unmatched: number;
}

/** Punctuation- and spacing-insensitive comparison key. */
function signature(value: string): string {
  return normalizeSourceName(value).replace(/\s+/g, '');
}

function buildAnchor(): AnchorEntity[] {
  const snapshot = governedSnapshotByKey.get(ANCHOR_TABLE_KEY);
  const seen = new Map<string, AnchorEntity>();
  for (const record of snapshot?.records ?? []) {
    const ulbId = record.ulb_id;
    const name = (record.ulb_name ?? '').trim();
    const district = (record.district_name ?? '').trim();
    if (!ulbId || !name || seen.has(ulbId)) continue;
    seen.set(ulbId, {
      ulbId,
      name,
      district,
      nameSignature: signature(name),
      districtSignature: signature(district),
    });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const anchorRegistry: AnchorEntity[] = buildAnchor();

const anchorByNameSignature = new Map(anchorRegistry.map((entity) => [entity.nameSignature, entity]));

/**
 * Counts id-to-name and name-to-id conflicts across the whole anchor family. A non-zero
 * result would disqualify the registry as a spine, so it is surfaced rather than assumed.
 */
export function anchorConflictCount(): number {
  const idToNames = new Map<string, Set<string>>();
  const nameToIds = new Map<string, Set<string>>();
  for (const tableKey of ANCHOR_FAMILY) {
    for (const record of governedSnapshotByKey.get(tableKey)?.records ?? []) {
      const id = record.ulb_id;
      const name = signature(record.ulb_name ?? '');
      if (!id || !name) continue;
      if (!idToNames.has(id)) idToNames.set(id, new Set());
      if (!nameToIds.has(name)) nameToIds.set(name, new Set());
      idToNames.get(id)!.add(name);
      nameToIds.get(name)!.add(id);
    }
  }
  const idConflicts = [...idToNames.values()].filter((names) => names.size > 1).length;
  const nameConflicts = [...nameToIds.values()].filter((ids) => ids.size > 1).length;
  return idConflicts + nameConflicts;
}

/** Dice coefficient over character bigrams. Deterministic, and a ranking hint only. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (value: string) => {
    const list: string[] = [];
    for (let index = 0; index < value.length - 1; index += 1) list.push(value.slice(index, index + 2));
    return list;
  };
  const left = bigrams(a);
  const right = bigrams(b);
  const pool = new Map<string, number>();
  for (const gram of left) pool.set(gram, (pool.get(gram) ?? 0) + 1);
  let shared = 0;
  for (const gram of right) {
    const available = pool.get(gram) ?? 0;
    if (available > 0) {
      shared += 1;
      pool.set(gram, available - 1);
    }
  }
  return (2 * shared) / (left.length + right.length);
}

/** Cross-district proposals must clear a high bar; same-district ones need far less,
 *  because the district itself is strong evidence. */
const CANDIDATE_FLOOR = 0.62;
const SAME_DISTRICT_FLOOR = 0.45;

/**
 * District names vary as much as ULB names — Anantapur/Ananthapur, Nandyal/Nandyala,
 * Kadapa/YSR Kadapa, Ambedkar Konaseema/Dr. B.R Ambedkar Konaseema, West Godavari/
 * West Godavari District. Comparing them by exact signature silently broke district
 * scoping and pushed correct same-district matches into the cross-district bucket.
 */
export function sameDistrict(a: string, b: string): boolean {
  const left = signature(a);
  const right = signature(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  return similarity(left, right) >= 0.82;
}

function ulbGrainSources(): Array<{ tableKey: string; records: SnapshotRecord[] }> {
  return governedSnapshots
    .map((snapshot) => ({ tableKey: snapshot.responseMetadata.tableKey, records: snapshot.records }))
    .filter((source) => source.records.some((record) => record.ulb_name));
}

interface Observation {
  name: string;
  district: string;
  sources: Set<string>;
  occurrences: number;
}

function observations(): Map<string, Observation> {
  const observed = new Map<string, Observation>();
  for (const { tableKey, records } of ulbGrainSources()) {
    for (const record of records) {
      const name = (record.ulb_name ?? '').trim();
      if (!name) continue;
      const district = (record.district_name ?? record.dstrt_nm ?? '').trim();
      const id = `${signature(district)}|${signature(name)}`;
      if (!observed.has(id)) observed.set(id, { name, district, sources: new Set(), occurrences: 0 });
      const entry = observed.get(id)!;
      entry.sources.add(tableKey);
      entry.occurrences += 1;
    }
  }
  return observed;
}

/**
 * Every distinct observed (district, ULB name) that does not resolve to the anchor by exact
 * signature match, with district-scoped candidates attached.
 */
export function crosswalkQueue(): QueueItem[] {
  const queue: QueueItem[] = [];
  for (const [id, entry] of observations()) {
    if (anchorByNameSignature.has(signature(entry.name))) continue;

    const nameSignature = signature(entry.name);
    const scored = anchorRegistry
      .map((anchor) => ({
        ulbId: anchor.ulbId,
        name: anchor.name,
        district: anchor.district,
        sameDistrict: sameDistrict(entry.district, anchor.district),
        score: similarity(nameSignature, anchor.nameSignature),
      }))
      .filter((candidate) => candidate.score >= (candidate.sameDistrict ? SAME_DISTRICT_FLOOR : CANDIDATE_FLOOR))
      .sort((a, b) => (Number(b.sameDistrict) - Number(a.sameDistrict)) || (b.score - a.score));

    const withinDistrict = scored.filter((candidate) => candidate.sameDistrict);
    const candidates = (withinDistrict.length > 0 ? withinDistrict : scored).slice(0, 4);

    const tier: ProposalTier = candidates.length === 0
      ? 'unmatched'
      : withinDistrict.length === 0
        ? 'cross-district'
        : withinDistrict.length === 1
          ? 'single-candidate'
          : 'ambiguous';

    queue.push({
      id,
      sourceName: entry.name,
      sourceDistrict: entry.district,
      sources: [...entry.sources].sort(),
      occurrences: entry.occurrences,
      tier,
      candidates,
    });
  }
  return queue.sort((a, b) => b.occurrences - a.occurrences || a.sourceName.localeCompare(b.sourceName));
}

export function crosswalkStats(): CrosswalkStats {
  let totalPairs = 0;
  let resolvedPairs = 0;
  for (const { records } of ulbGrainSources()) {
    const namesInSource = new Set<string>();
    for (const record of records) {
      const name = (record.ulb_name ?? '').trim();
      if (name) namesInSource.add(signature(name));
    }
    for (const name of namesInSource) {
      totalPairs += 1;
      if (anchorByNameSignature.has(name)) resolvedPairs += 1;
    }
  }
  const queue = crosswalkQueue();
  return {
    anchorSize: anchorRegistry.length,
    anchorConflicts: anchorConflictCount(),
    totalPairs,
    resolvedPairs,
    residualPairs: totalPairs - resolvedPairs,
    residualNames: queue.length,
    singleCandidate: queue.filter((item) => item.tier === 'single-candidate').length,
    ambiguous: queue.filter((item) => item.tier === 'ambiguous').length,
    crossDistrictOnly: queue.filter((item) => item.tier === 'cross-district').length,
    unmatched: queue.filter((item) => item.tier === 'unmatched').length,
  };
}

/** The whole registry, grouped by district, for manual assignment when no proposal fits. */
export function anchorByDistrict(): Array<{ district: string; entities: AnchorEntity[] }> {
  const groups = new Map<string, AnchorEntity[]>();
  for (const entity of anchorRegistry) {
    const key = entity.district || 'Unknown district';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entity);
  }
  return [...groups.entries()]
    .map(([district, entities]) => ({ district, entities: entities.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.district.localeCompare(b.district));
}

export type DecisionState = 'approved' | 'rejected' | 'deferred';

export interface Decision {
  itemId: string;
  state: DecisionState;
  ulbId: string | null;
  decidedAt: string;
}

/**
 * Reviewer decisions are held locally in the browser and are explicitly not an approved
 * crosswalk. They exist so a reviewer can work through the queue and export the result for
 * the approval process that has to happen outside this prototype.
 */
export const DECISION_STORAGE_KEY = 'sasa-crosswalk-decisions-v1';

/**
 * A tiny external store so the workbench can read localStorage without writing state from an
 * effect. The server snapshot is always empty, which keeps hydration stable.
 */
let decisionCache: Record<string, Decision> | null = null;
const decisionListeners = new Set<() => void>();

/**
 * The reviewed crosswalk that ships with the build. Used as the fallback whenever a
 * browser holds no decisions of its own — so a static host, which starts localStorage
 * empty for every visitor, still shows the finished review rather than a blank queue.
 * A reviewer's own edits are written to localStorage and take precedence from then on.
 * Returned as the server snapshot too, so the prerendered HTML already reflects it and
 * a fresh visitor sees no flash from empty to reviewed.
 */
const seed = seedDecisions;

export function readDecisions(): Record<string, Decision> {
  if (decisionCache) return decisionCache;
  try {
    const stored = window.localStorage.getItem(DECISION_STORAGE_KEY);
    decisionCache = stored ? (JSON.parse(stored) as Record<string, Decision>) : seed;
  } catch {
    decisionCache = seed;
  }
  return decisionCache;
}

export function serverDecisions(): Record<string, Decision> {
  return seed;
}

export function writeDecisions(next: Record<string, Decision>): void {
  decisionCache = next;
  try {
    window.localStorage.setItem(DECISION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or private-mode failure: decisions still live in the in-memory cache.
  }
  for (const listener of decisionListeners) listener();
}

export function subscribeDecisions(listener: () => void): () => void {
  decisionListeners.add(listener);
  return () => {
    decisionListeners.delete(listener);
  };
}

/**
 * Approved decisions as a lookup from an observed name signature to the anchor `ulb_id` a
 * reviewer accepted for it. This is what lets other selectors read evidence that was
 * previously unreachable because the source spelled the entity differently.
 */
export function approvedAliases(decisions: Record<string, Decision>): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const decision of Object.values(decisions)) {
    if (decision.state !== 'approved' || !decision.ulbId) continue;
    const observedName = decision.itemId.split('|')[1];
    if (observedName) aliases.set(observedName, decision.ulbId);
  }
  return aliases;
}

export function serializeDecisions(decisions: Decision[], stats: CrosswalkStats): string {
  return JSON.stringify({
    artifact: 'candidate-ulb-crosswalk',
    status: 'UNAPPROVED — reviewer working copy',
    anchorTableKey: ANCHOR_TABLE_KEY,
    anchorSize: stats.anchorSize,
    generatedAt: new Date().toISOString(),
    decisions,
  }, null, 2);
}


export interface ImportOutcome {
  applied: number;
  skipped: number;
  /** Why a decision was rejected, so a bad paste says what was wrong. */
  problems: string[];
}

/**
 * Reads a working crosswalk back in.
 *
 * The artifact is meant to leave for sign-off and return, and until now it could
 * only leave. Import also gives a reviewer a way to correct a batch of decisions
 * without clicking through the queue again.
 *
 * Every decision is validated against the anchor registry: an approval pointing
 * at a ULB id that does not exist is dropped rather than written, because a
 * silent bad join is exactly what this workbench exists to prevent.
 */
export function parseDecisionArtifact(raw: string): { decisions: Record<string, Decision>; outcome: ImportOutcome } {
  const decisions: Record<string, Decision> = {};
  const problems: string[] = [];
  let skipped = 0;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { decisions, outcome: { applied: 0, skipped: 0, problems: ['That is not valid JSON.'] } };
  }

  const list = Array.isArray(payload) ? payload
    : (payload && typeof payload === 'object' && Array.isArray((payload as { decisions?: unknown }).decisions))
      ? (payload as { decisions: unknown[] }).decisions
      : null;
  if (!list) {
    return { decisions, outcome: { applied: 0, skipped: 0, problems: ['No decisions array found in that file.'] } };
  }

  const known = new Set(anchorRegistry.map((anchor) => String(anchor.ulbId)));
  list.forEach((entry, index) => {
    const item = entry as Partial<Decision> & { itemId?: unknown; state?: unknown; ulbId?: unknown };
    const itemId = typeof item.itemId === 'string' ? item.itemId : null;
    const state = item.state;
    if (!itemId || (state !== 'approved' && state !== 'rejected' && state !== 'deferred')) {
      skipped += 1;
      problems.push(`Entry ${index + 1}: missing itemId or unrecognised state.`);
      return;
    }
    const ulbId = item.ulbId === null || item.ulbId === undefined ? null : String(item.ulbId);
    if (state === 'approved') {
      if (!ulbId) { skipped += 1; problems.push(`${itemId}: approved with no ulb_id.`); return; }
      if (!known.has(ulbId)) { skipped += 1; problems.push(`${itemId}: ulb_id ${ulbId} is not in the registry.`); return; }
    }
    decisions[itemId] = {
      itemId,
      state: state as DecisionState,
      ulbId: state === 'approved' ? ulbId : null,
      decidedAt: typeof item.decidedAt === 'string' ? item.decidedAt : new Date().toISOString(),
    };
  });

  return { decisions, outcome: { applied: Object.keys(decisions).length, skipped, problems: problems.slice(0, 6) } };
}
