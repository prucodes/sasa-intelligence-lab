import { getCollectionProcurementSummary, getIHHLFunnel, getLegacyWasteSummary, type TraceableValue } from '@/lib/analytics';
import { sourceCandidateKey } from '@/lib/snapshots';

export type ReviewIssueId = 'collection' | 'sanitation' | 'processing';
export interface ReviewRow {
  key: string;
  ulb: string;
  district: string;
  value: number;
  basis: number;
  completed: number;
}
export interface ReviewIssue {
  id: ReviewIssueId;
  title: string;
  quantity: string;
  unit: string;
  basisLabel: string;
  completedLabel: string;
  period: string;
  source: string;
  rows: ReviewRow[];
  excluded: number;
  total: number;
  basis: number;
  completed: number;
  boundary: string;
}

/**
 * One cohort feeds the overview quantity, map, list, and concentration.
 * All required measures must be present. Repeated identical measurements count
 * once; conflicting measurements for one source identity are held out together.
 */
export function eligibleReviewRows<T extends TraceableValue & { ulb: string | null; district: string }>(
  rows: T[], measures: (row: T) => Array<number | null>, passes: (row: T) => boolean = () => true,
): { rows: T[]; excluded: number } {
  if (new Set(rows.map((row) => `${row.tableKey}|${row.period}|${row.grain}`)).size > 1) {
    throw new Error('Overview cohorts require one source, period and grain.');
  }
  const groups = new Map<string, T[]>();
  let excluded = 0;
  for (const row of rows) {
    const key = sourceCandidateKey(row.raw);
    if (!key || !row.ulb?.trim() || !row.district?.trim()) { excluded++; continue; }
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const eligible: T[] = [];
  for (const group of groups.values()) {
    const signatures = new Set(group.map((row) => JSON.stringify(measures(row))));
    if (signatures.size !== 1 || group.some((row) => measures(row).some((value) => value === null || !Number.isFinite(value) || value < 0) || !passes(row))) {
      excluded++;
    } else eligible.push(group[0]);
  }
  return { rows: eligible, excluded };
}

export function getOverviewIssues(): ReviewIssue[] {
  const collection = getCollectionProcurementSummary();
  const sanitation = getIHHLFunnel();
  const legacy = getLegacyWasteSummary();
  const vehicleRows = eligibleReviewRows(collection.rows, (row) => [row.workOrders, row.supplied]);
  const ihhlRows = eligibleReviewRows(sanitation.rows, (row) => [row.approved, row.completed]);
  const wasteRows = eligibleReviewRows(legacy.rows, (row) => [row.target, row.achievement, row.balance], (row) => row.balanceCheck === 'pass');
  const identity = (row: { raw: TraceableValue['raw']; ulb: string | null; district: string }) => ({
    key: sourceCandidateKey(row.raw)!, ulb: row.ulb!.trim(), district: row.district.trim(),
  });
  const configs: Array<Omit<ReviewIssue, 'total' | 'basis' | 'completed'>> = [
    {
      id: 'collection', title: 'Vehicle delivery', quantity: 'ordered vehicles awaiting supply', unit: 'vehicles',
      basisLabel: 'work orders', completedLabel: 'supplied', period: collection.rows[0]?.period ?? 'Not returned',
      source: 'E-Auto Service Model', excluded: vehicleRows.excluded,
      rows: vehicleRows.rows.map((row) => ({ ...identity(row), value: Math.max(row.workOrders! - row.supplied!, 0), basis: row.workOrders!, completed: row.supplied! })),
      boundary: 'Counts describe reported procurement. Delivery dates, deployment and service quality are not established.',
    },
    {
      id: 'sanitation', title: 'Household toilets', quantity: 'approvals awaiting completion', unit: 'IHHL approvals',
      basisLabel: 'approved', completedLabel: 'completed', period: sanitation.rows[0]?.period ?? 'Not returned',
      source: 'Identification of New IHHLs', excluded: ihhlRows.excluded,
      rows: ihhlRows.rows.map((row) => ({ ...identity(row), value: Math.max(row.approved! - row.completed!, 0), basis: row.approved!, completed: row.completed! })),
      boundary: 'Open approvals identify a review workload. The source does not establish why delivery is incomplete.',
    },
    {
      id: 'processing', title: 'Legacy waste', quantity: 'tonnes reported remaining', unit: 'tonnes',
      basisLabel: 'target tonnes', completedLabel: 'cleared tonnes', period: legacy.rows[0]?.period ?? 'Not returned',
      source: 'Clearance of Legacy Waste', excluded: wasteRows.excluded,
      rows: wasteRows.rows.map((row) => ({ ...identity(row), value: row.balance!, basis: row.target!, completed: row.achievement! })),
      boundary: 'Ranked by remaining tonnes to show workload concentration. This is not a ranking of sanitation performance.',
    },
  ];
  return configs.map((issue) => ({
    ...issue,
    rows: issue.rows.sort((a, b) => b.value - a.value || a.ulb.localeCompare(b.ulb)),
    total: issue.rows.reduce((sum, row) => sum + row.value, 0),
    basis: issue.rows.reduce((sum, row) => sum + row.basis, 0),
    completed: issue.rows.reduce((sum, row) => sum + row.completed, 0),
  }));
}
