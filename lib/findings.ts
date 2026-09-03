/**
 * Named findings: who is carrying the gap, not how large the gap is.
 *
 * Every headline this product showed was a statewide aggregate — "7.0% delivery
 * ratio", "0.2% completion". Both are true and both are unactionable, because a
 * ratio over 83 ULBs cannot tell an officer which office to call. The evidence to
 * answer that was already retained at ULB grain; it was simply never surfaced.
 *
 * A finding here is therefore not a number but a distribution: the size of the
 * shortfall, how few entities hold most of it, and which ones by name. That last
 * part is the whole point. "1,019 vehicles ordered and not delivered" becomes a
 * meeting agenda only once it reads "Kurnool 91, Anantapuram 62, Vijayawada 50".
 *
 * These are descriptive statements about what sources reported, on the same terms
 * as the rest of the product: no composite, no score, no inference about cause.
 * A ULB that did not return a value is absent from the ranking rather than
 * ranked last, because a blank is not a zero.
 */

import type { Coverage } from '@/lib/coverage';
import {
  getCollectionProcurementSummary,
  getIHHLFunnel,
  getLegacyWasteSummary,
} from '@/lib/analytics';

export interface FindingEntity {
  ulb: string;
  district: string;
  /**
   * The magnitude the list is ordered and drawn by. It is deliberately the same
   * quantity as the ranking, so the bars always shorten down the list; sizing the
   * bar on tonnage while ranking on share made the legacy list read as broken.
   */
  value: number;
  /** `value` formatted for display, which is a percentage on a share ranking. */
  display: string;
  /** The stages behind the number, so the rank is never a bare claim. */
  detail: string;
  /**
   * Progress short of completion, when a source reports any. Kept out of `detail`
   * so that column stays one line, and because "52 under way" is the fact that
   * distinguishes this entity from the stalled ones around it.
   */
  note?: string;
  /** True when the entity reports no progress at all, not merely less than target. */
  stalled: boolean;
}

export interface Finding {
  id: string;
  tone: 'teal' | 'violet' | 'blue';
  /** What the shortfall is counted in. Plural, lower case. */
  unit: string;
  /** The statewide shortfall this finding describes. */
  total: number;
  headline: string;
  /** One sentence naming the concentration, written from the derived numbers. */
  statement: string;
  /** Entities carrying any of the shortfall. */
  affected: number;
  /** Entities that returned a usable value at all. The honest denominator. */
  reporting: number;
  /** Of `affected`, how many report no progress whatsoever. */
  stalled: number;
  /** Ranked largest first. Capped for display; `affected` holds the true count. */
  entities: FindingEntity[];
  /**
   * What the ranking is ordered by, which a reader must know to read the list:
   * 'volume' ranks by the size of the shortfall, 'share' by the proportion of that
   * entity's own target still outstanding.
   */
  rankedBy: 'volume' | 'share';
  /**
   * How much of the shortfall the top `count` entities hold. Null on a share-ranked
   * finding, where a concentration of mass would describe a list nobody is looking at.
   */
  concentration: { count: number; value: number; share: number } | null;
  coverage: Coverage;
  period: string;
  tableKey: string;
  /** The analytics tab that shows the full table behind this finding. */
  tab: 'collection' | 'sanitation' | 'processing';
}

/** Ranked entities never shown beyond this; the rest live in the analytics table. */
const TOP_N = 6;

function concentrationOf(entities: FindingEntity[], total: number, count: number) {
  const value = entities.slice(0, count).reduce((sum, entity) => sum + entity.value, 0);
  return { count: Math.min(count, entities.length), value, share: total > 0 ? value / total : 0 };
}

/**
 * Vehicles that were ordered and have not arrived.
 *
 * The gap measured here is work orders minus supplied, not target minus supplied.
 * Target is an intention and a shortfall against it can mean the procurement was
 * never started; a work order is a commitment already placed, so the distance
 * between orders and deliveries is the part that has actually gone wrong.
 */
function undeliveredOrders(): Finding | null {
  const summary = getCollectionProcurementSummary();
  const rows = summary.rows.filter((row) => row.ulb && (row.workOrders ?? 0) > 0);
  if (!rows.length) return null;

  const entities: FindingEntity[] = rows
    .map((row) => {
      const ordered = row.workOrders ?? 0;
      const supplied = row.supplied ?? 0;
      return {
        ulb: row.ulb as string,
        district: row.district,
        value: Math.max(ordered - supplied, 0),
        display: Math.max(ordered - supplied, 0).toLocaleString('en-IN'),
        detail: `${supplied.toLocaleString('en-IN')} of ${ordered.toLocaleString('en-IN')} delivered`,
        stalled: supplied === 0,
      };
    })
    .filter((entity) => entity.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = entities.reduce((sum, entity) => sum + entity.value, 0);
  const stalled = entities.filter((entity) => entity.stalled).length;

  return {
    id: 'undelivered-orders',
    tone: 'teal',
    unit: 'vehicles',
    total,
    headline: `${total.toLocaleString('en-IN')} vehicles ordered and not delivered`,
    statement: `${stalled} of ${rows.length} ULBs with work orders have received nothing at all.`,
    affected: entities.length,
    reporting: rows.length,
    stalled,
    entities: entities.slice(0, TOP_N),
    rankedBy: 'volume',
    concentration: concentrationOf(entities, total, 5),
    coverage: summary.coverage,
    period: summary.rows[0]?.period ?? '',
    tableKey: 'sasa_sac_machinery_e_autos_service_model_api',
    tab: 'collection',
  };
}

/**
 * Household toilets approved by MoHUA where nothing has been built.
 *
 * Entities are ranked by open approvals, and `stalled` distinguishes the ones with
 * no construction under way from those merely running behind — the difference
 * between a programme that is slow and one that has not begun.
 */
function stalledApprovals(): Finding | null {
  const funnel = getIHHLFunnel();
  const rows = funnel.rows.filter((row) => (row.approved ?? 0) > 0);
  if (!rows.length) return null;

  const entities: FindingEntity[] = rows
    .map((row) => {
      const approved = row.approved ?? 0;
      const completed = row.completed ?? 0;
      const underway = row.underConstruction ?? 0;
      return {
        ulb: row.ulb,
        district: row.district,
        value: Math.max(approved - completed, 0),
        display: Math.max(approved - completed, 0).toLocaleString('en-IN'),
        detail: `${completed.toLocaleString('en-IN')} of ${approved.toLocaleString('en-IN')} built`,
        note: underway > 0 ? `${underway.toLocaleString('en-IN')} under way` : undefined,
        stalled: completed === 0 && underway === 0,
      };
    })
    .filter((entity) => entity.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = entities.reduce((sum, entity) => sum + entity.value, 0);
  const stalled = entities.filter((entity) => entity.stalled).length;

  return {
    id: 'stalled-approvals',
    tone: 'violet',
    unit: 'approvals',
    total,
    headline: `${total.toLocaleString('en-IN')} approved toilets not yet built`,
    statement: `${stalled} of ${rows.length} ULBs holding approvals report no construction started.`,
    affected: entities.length,
    reporting: rows.length,
    stalled,
    entities: entities.slice(0, TOP_N),
    rankedBy: 'volume',
    concentration: concentrationOf(entities, total, 5),
    coverage: funnel.coverage,
    period: funnel.rows[0]?.period ?? '',
    tableKey: 'sasa_sac_identification_of_new_ihhls_api',
    tab: 'sanitation',
  };
}

/**
 * Legacy waste still on the ground, ranked by the share left rather than its mass.
 *
 * Ranking this one by tonnage was wrong and the data says so plainly: it put GVMC
 * at the top, a ULB that has cleared 88% of the largest dump in the state. Absolute
 * balance tracks city size, so a list built on it names the biggest places instead
 * of the furthest behind. The share remaining is scale-free and ranks Palacole
 * above GVMC, which is the order an officer would actually work in.
 *
 * Rows whose own arithmetic does not close are excluded rather than ranked: a
 * balance that contradicts its target and achievement is an unknown quantity, and
 * placing an unknown in a ranked list states a position the source never
 * supported.
 */
function remainingLegacyWaste(): Finding | null {
  const summary = getLegacyWasteSummary();
  const rows = summary.rows.filter(
    (row) => row.balanceCheck !== 'conflict' && (row.balance ?? 0) > 0 && (row.target ?? 0) > 0,
  );
  if (!rows.length) return null;

  const entities: FindingEntity[] = rows
    .map((row) => {
      const balance = row.balance ?? 0;
      const target = row.target ?? 0;
      const share = balance / target;
      return {
        ulb: row.ulb,
        district: row.district,
        value: share,
        display: `${Math.round(share * 100)}%`,
        detail: `${Math.round(balance).toLocaleString('en-IN')} t of ${Math.round(target).toLocaleString('en-IN')} t left`,
        stalled: (row.achievement ?? 0) === 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const total = rows.reduce((sum, row) => sum + (row.balance ?? 0), 0);

  return {
    id: 'legacy-balance',
    tone: 'blue',
    unit: 'tonnes',
    total,
    headline: `${Math.round(total).toLocaleString('en-IN')} tonnes of legacy waste remain`,
    statement: `${entities.length} of ${summary.rows.length} ULBs report a balance still on the ground.`,
    affected: entities.length,
    reporting: summary.rows.length,
    stalled: entities.filter((entity) => entity.stalled).length,
    entities: entities.slice(0, TOP_N),
    rankedBy: 'share',
    concentration: null,
    coverage: summary.coverage,
    period: summary.period,
    tableKey: 'sasa_100_percent_clearance_of_legacy_waste_api',
    tab: 'processing',
  };
}

/**
 * Every named finding the retained evidence supports, largest concentration first.
 */
export function getNamedFindings(): Finding[] {
  return [undeliveredOrders(), stalledApprovals(), remainingLegacyWaste()]
    .filter((finding): finding is Finding => finding !== null)
    // Ordered by how much of the reporting population has not started at all,
    // which is a sharper claim on attention than the size of the shortfall.
    .sort((a, b) => b.stalled / b.reporting - a.stalled / a.reporting);
}
