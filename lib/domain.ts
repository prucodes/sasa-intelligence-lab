import { authorizedCatalogue, authorizedCatalogueStats, readinessCatalogue, readinessCatalogueStats } from '@/lib/catalogue';
import type { Coverage } from '@/lib/coverage';
import {
  governedSnapshotByKey,
  governedSnapshotStats,
  governedSnapshots,
  currentSnapshotRecords,
  recordPeriodLabel,
  recordsBySourceCandidate,
  snapshotPeriod,
  snapshotProvenance,
  sourceCandidateKey,
  type SnapshotEnvelope,
  type SnapshotRecord,
} from '@/lib/snapshots';

export type DataMode = 'DEMO' | 'SAMPLE' | 'LIVE';

export type GapState =
  | 'DOING_WELL'
  | 'LEARN_FROM'
  | 'INFRASTRUCTURE_GAP'
  | 'INVESTIGATE'
  | 'UNSCORED';

export type UnscoredReason =
  | 'ULB_MATCH_UNREVIEWED'
  | 'PERIOD_MISMATCH'
  | 'STALE_OUTCOME'
  | 'MISSING_VALUE'
  | 'INVALID_DENOMINATOR'
  | 'INCOMPLETE_PAYLOAD'
  | 'LIVE_ACCESS_PENDING'
  | 'PERIOD_CONFLICT';

export interface EvidenceRecord {
  id: string;
  dataset: string;
  tableKey: string;
  period: string;
  rawFields: Record<string, string>;
  joinMethod: string;
  matchStatus: string;
  freshness: string;
  provenance: string;
  grain: 'ULB' | 'District';
  normalizedCandidate: string;
  formula: string;
}

export interface MetricRow {
  label: string;
  value: string;
  detail: string;
  tone: 'teal' | 'blue' | 'violet' | 'green' | 'orange' | 'red' | 'neutral';
  evidenceId?: string;
  /**
   * The denominator behind the value. Required whenever `value` is a bare rate;
   * see `rateCoverageViolation` in lib/coverage, which the test suite runs over
   * every metric the product ships.
   */
  coverage?: Coverage;
}

export interface GapAssessment {
  ulbKey: string;
  name: string;
  district: string;
  x: number | null;
  y: number | null;
  state: GapState;
  reasons: UnscoredReason[];
  summary: string;
}

export interface Diagnostic {
  ulbKey: string;
  name: string;
  district: string;
  reportingContext: string;
  state: GapState;
  title: string;
  summary: string;
  metrics: MetricRow[];
  evidence: EvidenceRecord[];
  qualityFlags: string[];
}

export interface ReadinessRow {
  dataset: string;
  tableKey: string;
  programme: string;
  theme: string;
  fields: number;
  frequency: string;
  columns: string[];
  records: number | null;
  period: string;
  snapshotComplete: boolean;
  dataLakeLink?: string;
  publicSchema: string;
  payloadEvidence: string;
  joinReadiness: string;
  eligibility: string;
  representative: boolean;
  sourceState: string;
  /** Set when the endpoint was queried live and returned a row count but no snapshot was retained. */
  liveRowCount?: number;
}

export interface ReadinessGate {
  title: string;
  detail: string;
  state: 'met' | 'blocked' | 'future';
}

export interface ModeDataset {
  mode: DataMode;
  banner: string;
  overview: MetricRow[];
  radar: GapAssessment[];
  diagnostics: Diagnostic[];
  readiness: {
    cards: MetricRow[];
    rows: ReadinessRow[];
    gates: ReadinessGate[];
  };
}

export interface SasaDataProvider {
  readonly mode: DataMode;
  getOverview(): MetricRow[];
  getGapAssessments(): GapAssessment[];
  getDiagnostic(ulbKey?: string): Diagnostic;
  getReadiness(): ModeDataset['readiness'];
}

export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): { value: number | null; flag?: 'undefined_denominator' | 'missing_value' } {
  if (numerator === null || numerator === undefined || denominator === null || denominator === undefined) {
    return { value: null, flag: 'missing_value' };
  }
  if (denominator === 0) return { value: null, flag: 'undefined_denominator' };
  return { value: numerator / denominator };
}

export function validatePeriod(monthNumber: number, monthName: string): boolean {
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  return monthNumber >= 1 && monthNumber <= 12 && months[monthNumber - 1] === monthName.toUpperCase();
}

export function outcomeLagYears(operationalYear: number, outcomeYear: number): number {
  return operationalYear - outcomeYear;
}

export function classifyDemoGap(x: number, y: number, threshold = 0.6): GapState {
  if (x >= threshold && y >= threshold) return 'DOING_WELL';
  if (x < threshold && y >= threshold) return 'LEARN_FROM';
  if (x < threshold && y < threshold) return 'INFRASTRUCTURE_GAP';
  return 'INVESTIGATE';
}

export function assessEligibility(input: {
  reviewedMatch: boolean;
  completePayload: boolean;
  operationalYear?: number;
  outcomeYear?: number;
  requiredValuesPresent: boolean;
  periodValid: boolean;
}): UnscoredReason[] {
  const reasons: UnscoredReason[] = [];
  if (!input.reviewedMatch) reasons.push('ULB_MATCH_UNREVIEWED');
  if (!input.completePayload) reasons.push('INCOMPLETE_PAYLOAD');
  if (!input.periodValid) reasons.push('PERIOD_CONFLICT');
  if (!input.requiredValuesPresent) reasons.push('MISSING_VALUE');
  if (input.operationalYear !== undefined && input.outcomeYear !== undefined && input.operationalYear !== input.outcomeYear) {
    reasons.push('PERIOD_MISMATCH');
    if (input.operationalYear > input.outcomeYear) reasons.push('STALE_OUTCOME');
  }
  return reasons;
}

const demoRadar: GapAssessment[] = [
  ['demo-alpha', 'Demo ULB Alpha', 'Demo District North', 0.83, 0.78, 'Stable reported progress and outcome fixture.'],
  ['demo-bravo', 'Demo ULB Bravo', 'Demo District North', 0.31, 0.82, 'Outcome fixture is stronger than reported implementation.'],
  ['demo-charlie', 'Demo ULB Charlie', 'Demo District Central', 0.27, 0.24, 'Both fixture dimensions are below the illustrative threshold.'],
  ['demo-delta', 'Demo ULB Delta', 'Demo District Central', 0.79, 0.29, 'Reported implementation and outcome fixtures appear misaligned.'],
  ['demo-foxtrot', 'Demo ULB Foxtrot', 'Demo District South', 0.68, 0.71, 'Fixture falls above both illustrative thresholds.'],
].map(([ulbKey, name, district, x, y, summary]) => ({
  ulbKey: String(ulbKey), name: String(name), district: String(district), x: Number(x), y: Number(y),
  state: classifyDemoGap(Number(x), Number(y)), reasons: [], summary: String(summary),
}));

demoRadar.push({
  ulbKey: 'demo-echo', name: 'Demo ULB Echo', district: 'Demo District South', x: null, y: null,
  state: 'UNSCORED', reasons: ['MISSING_VALUE'], summary: 'Synthetic outcome evidence is intentionally absent.',
});

/**
 * Coverage for the demo headline cards, derived from the fixtures themselves so
 * the denominator cannot drift away from the radar it describes. Demo ULB Echo
 * deliberately returns nothing, which is what makes it a useful demonstration.
 */
const demoHeadlineCoverage: Coverage = {
  reported: demoRadar.filter((item) => item.x !== null && item.y !== null).length,
  expected: demoRadar.length,
  unit: 'demo ULBs',
  basis: 'Illustrative fixtures. Not a state total.',
};

const demoDiagnostics: Diagnostic[] = demoRadar.map((item, index) => ({
  ulbKey: item.ulbKey,
  name: item.name,
  district: item.district,
  reportingContext: 'Illustrative period · Synthetic fixture',
  state: item.state,
  title: item.state === 'UNSCORED' ? 'Evidence not sufficient' : item.state === 'INVESTIGATE' ? 'Reported gap detected' : 'Fixture assessment',
  summary: item.summary,
  metrics: [
    { label: 'E-Autos', value: `${56 + index * 6}%`, detail: 'synthetic delivery ratio', tone: 'teal' },
    { label: 'ISWM', value: `${18 + index * 4} TPD`, detail: 'synthetic configured capacity', tone: 'blue' },
    { label: 'IHHL', value: `${42 + index * 5}%`, detail: 'synthetic completion ratio', tone: 'violet' },
    { label: 'Outcome context', value: item.y === null ? 'Unavailable' : `${Math.round(item.y * 100)} / 100`, detail: 'illustrative index', tone: item.y === null ? 'neutral' : 'green' },
  ],
  evidence: [{
    id: `demo-${index}`, dataset: 'Synthetic demonstration fixture', tableKey: 'demo_fixture_v1', period: 'Illustrative period',
    rawFields: { implementation_index: item.x?.toString() ?? 'null', outcome_index: item.y?.toString() ?? 'null' },
    joinMethod: 'Synthetic canonical fixture key', matchStatus: 'Demo eligible only', freshness: 'Illustrative',
    provenance: 'Local fixture · not a SASA source record',
    grain: 'ULB', normalizedCandidate: `demo fixture ${index + 1}`, formula: 'Illustrative fixture policy only',
  }],
  qualityFlags: item.reasons.length ? ['Required fixture value intentionally omitted'] : ['Synthetic data — not an official finding'],
}));

const datasetNameByKey = new Map(authorizedCatalogue.map((dataset) => [dataset.tableKey, dataset.catalogueName]));
const ihhlTableKey = 'sasa_sac_identification_of_new_ihhls_api';
const eAutoTableKey = 'sasa_sac_machinery_e_autos_service_model_api';
const iswmTableKey = 'sasa_sac_msw_processing_facilities_iswm_facilities_api';
const fstpTableKey = 'sasa_sac_establishing_fstps_information_api';
const odfTableKey = 'sasa_sac_swacch_survekshan_information_odf_status_api';
const gfcTableKey = 'sasa_sac_swacch_survekshan_information_gfc_status_api';
const rankTableKey = 'sasa_sac_swacch_survekshan_information_national_rank_api';
const legacyWasteTableKey = 'sasa_100_percent_clearance_of_legacy_waste_api';

const candidateIndexes = new Map(
  governedSnapshots.map((snapshot) => [snapshot.responseMetadata.tableKey, recordsBySourceCandidate(snapshot.responseMetadata.tableKey)]),
);

function evidenceId(tableKey: string, record: SnapshotRecord): string {
  return `${tableKey}:${sourceCandidateKey(record) ?? 'district-record'}:${recordPeriodLabel(record)}`;
}

function makeSnapshotEvidence(snapshot: SnapshotEnvelope, record: SnapshotRecord, anchor = false): EvidenceRecord {
  const tableKey = snapshot.responseMetadata.tableKey;
  const formula = tableKey === ihhlTableKey ? 'completion_ratio = completed / approved · safe divide'
    : tableKey === eAutoTableKey ? 'delivery_ratio = supplied / target · safe divide'
      : tableKey === iswmTableKey ? 'split_check = |total_tpd − (wet_tpd + dry_tpd)| ≤ 0.01'
        : tableKey === legacyWasteTableKey ? 'clearance_ratio = achievement / target · balance_check = target − achievement − balance'
        : tableKey === fstpTableKey ? 'period_check = month_number ↔ month_name'
          : [odfTableKey, gfcTableKey, rankTableKey].includes(tableKey) ? 'Descriptive source field · no cross-period calculation'
            : 'No derived formula used';
  return {
    id: evidenceId(snapshot.responseMetadata.tableKey, record),
    dataset: datasetNameByKey.get(snapshot.responseMetadata.tableKey) ?? snapshot.responseMetadata.tableKey,
    tableKey: snapshot.responseMetadata.tableKey,
    period: recordPeriodLabel(record),
    rawFields: record,
    joinMethod: anchor ? 'IHHL source row used as the local profile anchor' : 'Normalized district + ULB name candidate',
    matchStatus: anchor ? 'Source identity retained; cross-source mapping unreviewed' : 'Unreviewed — excluded from scoring',
    freshness: `Snapshot generated ${snapshot.responseMetadata.generatedAt}`,
    provenance: snapshotProvenance(snapshot),
    grain: record.ulb_name || record.ulb_nm ? 'ULB' : 'District',
    normalizedCandidate: sourceCandidateKey(record) ?? `District only · ${record.district_name ?? record.dstrt_nm ?? 'not supplied'}`,
    formula,
  };
}

function sourceRecord(tableKey: string, candidate: string): SnapshotRecord | undefined {
  return candidateIndexes.get(tableKey)?.get(candidate);
}

function sourceEvidenceForCandidate(candidate: string): EvidenceRecord[] {
  return governedSnapshots.flatMap((snapshot) => {
    const seen = new Map<string, number>();
    return snapshot.records
      .filter((record) => sourceCandidateKey(record) === candidate)
      .map((record) => {
        const evidence = makeSnapshotEvidence(snapshot, record, snapshot.responseMetadata.tableKey === ihhlTableKey);
        const occurrence = seen.get(evidence.id) ?? 0;
        seen.set(evidence.id, occurrence + 1);
        return occurrence ? { ...evidence, id: `${evidence.id}:duplicate-${occurrence + 1}` } : evidence;
      });
  });
}

/**
 * The diagnostics route key for a ULB, so any table row can link through to its evidence.
 * Exported because the analytics tables need to build the same key from a source row.
 */
export function diagnosticsKeyFor(name: string, district: string): string {
  return localUlbKey(name, district);
}

function localUlbKey(name: string, district: string): string {
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return name.toLowerCase() === 'narsipatnam' ? 'sample-narsipatnam' : `sample-${slug(district)}-${slug(name)}`;
}

function recordMetric(
  label: string,
  record: SnapshotRecord | undefined,
  value: (record: SnapshotRecord) => string,
  detail: (record: SnapshotRecord) => string,
  tone: MetricRow['tone'],
): MetricRow {
  return record
    ? { label, value: value(record), detail: detail(record), tone, evidenceId: evidenceId(
      label === 'IHHL pipeline' ? ihhlTableKey
        : label === 'E-Autos' ? eAutoTableKey
          : label === 'Processing facility' && record.total_tpd !== undefined ? iswmTableKey
            : label === 'Processing facility' ? fstpTableKey
              : record.odf_status !== undefined ? odfTableKey
                : record.gfc_status !== undefined ? gfcTableKey : rankTableKey,
      record,
    ) }
    : { label, value: 'Not returned', detail: 'No exact normalized source candidate in this snapshot', tone: 'neutral' };
}

const ihhlSnapshot = governedSnapshotByKey.get(ihhlTableKey);
const currentIhhlRecords = currentSnapshotRecords(ihhlSnapshot);
const currentIhhlCandidateCount = new Set(currentIhhlRecords.map(sourceCandidateKey).filter(Boolean)).size;
const ihhlCandidateCounts = currentIhhlRecords.reduce<Map<string, number>>((counts, record) => {
  const candidate = sourceCandidateKey(record);
  if (candidate) counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  return counts;
}, new Map());
const uniqueIhhlRecords = [...new Map((ihhlSnapshot?.records ?? []).map((record) => [sourceCandidateKey(record), record])).values()]
  .filter((record): record is SnapshotRecord => Boolean(record));
const sampleDiagnostics: Diagnostic[] = uniqueIhhlRecords.map((ihhlRecord) => {
  const candidate = sourceCandidateKey(ihhlRecord)!;
  const name = ihhlRecord.ulb_name;
  const district = ihhlRecord.district_name;
  const eAutoRecord = sourceRecord(eAutoTableKey, candidate);
  const iswmRecord = sourceRecord(iswmTableKey, candidate);
  const fstpRecord = sourceRecord(fstpTableKey, candidate);
  const odfRecord = sourceRecord(odfTableKey, candidate);
  const gfcRecord = sourceRecord(gfcTableKey, candidate);
  const rankRecord = sourceRecord(rankTableKey, candidate);
  const processingRecord = iswmRecord ?? fstpRecord;
  const outcomeRecord = odfRecord ?? gfcRecord ?? rankRecord;
  const approved = Number(ihhlRecord.ihhls_approved_by_mohua);
  const completed = Number(ihhlRecord.completed);
  const completion = safeDivide(completed, approved);
  const fstpConflict = Boolean(fstpRecord)
    && !validatePeriod(Number(fstpRecord!.month_number), fstpRecord!.month_name);
  const hasOutcome = Boolean(outcomeRecord);
  const operationalPeriod = recordPeriodLabel(ihhlRecord);
  const reasons: UnscoredReason[] = ['ULB_MATCH_UNREVIEWED'];
  if (hasOutcome) reasons.push('PERIOD_MISMATCH', 'STALE_OUTCOME');
  if (fstpConflict) reasons.push('PERIOD_CONFLICT');
  if (completion.flag === 'undefined_denominator') reasons.push('INVALID_DENOMINATOR');
  const outcomeValue = [
    odfRecord?.odf_status,
    gfcRecord?.gfc_status,
    rankRecord?.national_rank ? `Rank ${rankRecord.national_rank}` : undefined,
  ].filter(Boolean).join(' · ');
  return {
    ulbKey: localUlbKey(name, district),
    name,
    district,
    reportingContext: hasOutcome ? `Operational: ${operationalPeriod} · Outcomes: 2024` : `Operational snapshot: ${operationalPeriod}`,
    state: 'UNSCORED',
    title: fstpConflict ? 'Source period conflict — review required' : hasOutcome ? 'Period and identity review required' : 'Identity review required',
    summary: 'Complete governed rows are retained, but cross-source identity has not been approved and outcome periods are not assumed to align.',
    metrics: [
      recordMetric('IHHL pipeline', ihhlRecord, (record) => `${record.completed} / ${record.ihhls_approved_by_mohua}`, () => completion.value === null ? 'completed / approved · ratio unavailable' : `${Math.round(completion.value * 100)}% completed / approved`, 'violet'),
      recordMetric('E-Autos', eAutoRecord, (record) => `${record.achievement ?? record.no_of_vehicles_supplied_in_nos} / ${record.target}`, (record) => `${record.actual_work_order_issued ?? record.actual_wrk_order_issued} work orders · supplied / target`, 'teal'),
      recordMetric('Processing facility', processingRecord, (record) => record.total_tpd !== undefined ? `${record.total_tpd} TPD` : `${record.capacity_in_kld} KLD`, (record) => record.total_tpd !== undefined ? `configured capacity · source status: ${record.status_tx}` : `configured capacity · source progress: ${record.overall_progress}`, 'blue'),
      recordMetric('Outcome context', outcomeRecord, () => outcomeValue, () => 'source-reported 2024 context', 'green'),
    ],
    evidence: sourceEvidenceForCandidate(candidate),
    qualityFlags: [
      'Complete authenticated snapshots retained and pagination reconciled',
      'No shared stable ULB ID across the selected SASA sources',
      'Normalized source names are candidates, not an approved crosswalk',
      ...(hasOutcome ? ['Outcome period is two years earlier than operational records'] : []),
      ...(fstpConflict ? ['FSTP month number 7 conflicts with source month name JUNE'] : []),
      ...(completion.flag === 'undefined_denominator' ? ['IHHL completion ratio suppressed because approvals are zero'] : []),
      ...((ihhlCandidateCounts.get(candidate) ?? 0) > 1 ? [`IHHL source contains ${ihhlCandidateCounts.get(candidate)} identical rows for this name candidate`] : []),
    ],
  };
});

function joinReadinessFor(columns: string[]): string {
  if (columns.includes('ulb_id')) return 'DATASET-SPECIFIC ULB ID';
  if (columns.includes('ulb_name') || columns.includes('ulb_nm')) return 'NAME CROSSWALK REQUIRED';
  return 'DISTRICT GRAIN';
}

const sampleReadinessRows: ReadinessRow[] = readinessCatalogue.map((dataset) => {
  const snapshot = governedSnapshotByKey.get(dataset.tableKey);
  const documentedPending = dataset.sourceState === 'DOCUMENTED — INGESTION PENDING';
  const complete = Boolean(snapshot)
    && snapshot!.responseMetadata.hasNextPage === false
    && snapshot!.responseMetadata.totalRecordCount === snapshot!.records.length;
  return {
    dataset: dataset.catalogueName,
    tableKey: dataset.tableKey,
    programme: dataset.programme,
    theme: dataset.theme,
    fields: dataset.fieldCount,
    frequency: dataset.frequency,
    columns: dataset.columns,
    records: snapshot?.records.length ?? null,
    period: snapshot ? snapshotPeriod(snapshot) : documentedPending ? 'Not retained · documentation example only' : 'Unavailable',
    snapshotComplete: complete,
    dataLakeLink: dataset.dataLakeLink,
    publicSchema: dataset.schemaVerification,
    payloadEvidence: documentedPending ? dataset.payloadEvidence : complete ? `COMPLETE SNAPSHOT · ${snapshot!.records.length} ROWS` : 'SOURCE ERROR · NO SNAPSHOT',
    joinReadiness: documentedPending ? dataset.joinEligibility : joinReadinessFor(dataset.columns),
    eligibility: 'UNSCORED',
    representative: dataset.retainedExcerpt,
    sourceState: dataset.sourceState,
    liveRowCount: dataset.liveRowCount,
  };
});

const demoReadinessRows: ReadinessRow[] = Array.from({ length: 6 }, (_, index) => ({
  dataset: `Synthetic fixture ${index + 1}`,
  tableKey: `demo_fixture_${index + 1}`,
  programme: 'DEMO',
  theme: 'Synthetic demonstration',
  fields: 4,
  frequency: 'Illustrative',
  columns: ['fixture_key', 'implementation_index', 'outcome_index', 'period'],
  records: 1,
  period: 'Illustrative',
  snapshotComplete: true,
  publicSchema: 'LOCAL FIXTURE',
  payloadEvidence: 'SYNTHETIC FIXTURE',
  joinReadiness: 'SYNTHETIC KEY',
  eligibility: index === 5 ? 'UNSCORED' : 'DEMO ONLY',
  representative: false,
  sourceState: 'SYNTHETIC',
}));

const demoData: ModeDataset = {
  mode: 'DEMO', banner: 'Synthetic fixture mode · values are illustrative and not official findings',
  overview: [
    { label: 'Collection & Machinery', value: '84%', detail: 'illustrative reported progress', tone: 'teal', coverage: demoHeadlineCoverage },
    { label: 'Processing & Facilities', value: '71%', detail: 'illustrative readiness', tone: 'blue', coverage: demoHeadlineCoverage },
    { label: 'Sanitation Delivery', value: '63%', detail: 'illustrative pipeline progress', tone: 'violet', coverage: demoHeadlineCoverage },
    { label: 'Swachh Outcomes', value: '76%', detail: 'illustrative outcome index', tone: 'green', coverage: demoHeadlineCoverage },
  ], radar: demoRadar, diagnostics: demoDiagnostics,
  readiness: {
    cards: [
      { label: 'Fixture datasets', value: '6', detail: 'synthetic demonstration sources', tone: 'teal' },
      { label: 'Fixture joins', value: '100%', detail: 'synthetic canonical keys', tone: 'blue', coverage: { reported: 6, expected: 6, unit: 'fixture datasets' } },
      { label: 'Eligible fixtures', value: '5 / 6', detail: 'illustrative policy v0-demo', tone: 'green' },
      { label: 'Unscored fixtures', value: '1', detail: 'missing illustrative outcome', tone: 'orange' },
    ], rows: demoReadinessRows,
    gates: [
      { title: 'Synthetic canonical keys', detail: 'Available for demonstration fixtures only', state: 'met' },
      { title: 'Illustrative aligned periods', detail: 'Configured only to demonstrate interactions', state: 'met' },
      { title: 'Government source access', detail: 'Not used in Demo mode', state: 'future' },
    ],
  },
};

const sampleRadar: GapAssessment[] = sampleDiagnostics.map((diagnostic) => ({
  ulbKey: diagnostic.ulbKey,
  name: diagnostic.name,
  district: diagnostic.district,
  x: null,
  y: null,
  state: 'UNSCORED',
  reasons: [
    'ULB_MATCH_UNREVIEWED',
    ...(diagnostic.reportingContext.includes('Outcomes') ? ['PERIOD_MISMATCH', 'STALE_OUTCOME'] as UnscoredReason[] : []),
    ...(diagnostic.title.includes('period conflict') ? ['PERIOD_CONFLICT'] as UnscoredReason[] : []),
  ],
  summary: diagnostic.summary,
}));

const sampleData: ModeDataset = {
  mode: 'SAMPLE', banner: 'Authenticated, governed SASA evidence · current review mode',
  overview: [
    { label: 'Collection & Machinery', value: '193 rows', detail: 'six complete current-period exports · mixed grain', tone: 'teal' },
    { label: 'Processing & Facilities', value: '180 rows', detail: 'five latest-period facility exports · configured values/status', tone: 'blue' },
    {
      label: 'Sanitation Delivery',
      value: `${governedSnapshotStats.baselineUlbRows} rows`,
      detail: `${currentIhhlCandidateCount} July candidates · ${governedSnapshotStats.baselineUlbCandidates} observed across retained history`,
      tone: 'violet',
      // The one headline card with a denominator that is genuinely known: the
      // latest IHHL period against the observed ULB registry. The other three
      // count rows across mixed grain, so no single entity denominator is honest.
      coverage: {
        reported: governedSnapshotStats.baselineUlbRows,
        expected: governedSnapshotStats.baselineUlbCandidates,
        unit: 'ULBs',
        basis: 'Latest IHHL period against observed ULB candidates.',
      },
    },
    { label: 'Swachh Outcomes', value: '164 rows', detail: 'GFC, ODF and rank · source year 2024', tone: 'orange' },
  ], radar: sampleRadar, diagnostics: sampleDiagnostics,
  readiness: {
    cards: [
      { label: 'Authorized datasets', value: String(authorizedCatalogueStats.authorizedDatasets), detail: `${readinessCatalogueStats.documentedDatasets} documented · ${readinessCatalogueStats.documentedPending} ingestion pending`, tone: 'teal' },
      { label: 'Complete snapshots', value: `${governedSnapshotStats.completeDatasets} / ${governedSnapshotStats.authorizedDatasets}`, detail: 'pagination totals reconciled', tone: 'blue' },
      { label: 'Retained records', value: governedSnapshotStats.records.toLocaleString('en-IN'), detail: 'authenticated governed JSON rows', tone: 'green' },
      { label: 'ULB candidates', value: String(governedSnapshotStats.baselineUlbCandidates), detail: `${governedSnapshotStats.baselineUlbRows} latest-period IHHL rows · ${currentIhhlCandidateCount} current candidates`, tone: 'violet' },
    ], rows: sampleReadinessRows,
    gates: [
      { title: 'Governed source access', detail: '30 of 30 endpoints authorized in the signed-in account', state: 'met' },
      { title: 'Complete paginated snapshots', detail: '29 complete; Gobardhan export currently fails', state: 'blocked' },
      { title: 'Documented PR integrations', detail: 'Three additional schemas are known; full authenticated exports and semantic review remain pending', state: 'blocked' },
      { title: 'Reviewed ULB crosswalk', detail: 'Required because selected sources expose names only', state: 'blocked' },
      { title: 'Same-year outcome data', detail: 'Required before any asset–outcome flag', state: 'blocked' },
      { title: 'Persistent bottleneck evidence', detail: 'Requires at least six consecutive validated months', state: 'future' },
      { title: 'Forward-looking warning evidence', detail: 'Requires 12+ months, a defined target, and backtesting cycles', state: 'future' },
      { title: 'Action-ranking evidence', detail: 'Requires interventions, costs, eligibility, and post-action outcomes', state: 'future' },
    ],
  },
};

const liveDiagnostic: Diagnostic = {
  ulbKey: 'live-pending', name: 'Live source pending', district: 'Governed SASA Data Lake', reportingContext: 'No authenticated request attempted',
  state: 'UNSCORED', title: 'On the roadmap', summary: 'Live mode is the planned on-demand connector to the AI Living Labs Data Lake. It is not enabled in this prototype; Governed data mode shows the same sources today, retained as snapshots.',
  metrics: [{ label: 'Live metrics', value: 'Unavailable', detail: 'authenticated source access required', tone: 'neutral' }],
  evidence: [], qualityFlags: ['Platform token required', 'Dataset permissions unverified', 'Complete pagination unverified'],
};

const liveData: ModeDataset = {
  mode: 'LIVE', banner: 'Live connector · on the roadmap — on-demand authenticated pull, not yet enabled',
  overview: [
    { label: 'Collection & Machinery', value: '—', detail: 'access pending', tone: 'neutral' },
    { label: 'Processing & Facilities', value: '—', detail: 'access pending', tone: 'neutral' },
    { label: 'Sanitation Delivery', value: '—', detail: 'access pending', tone: 'neutral' },
    { label: 'Swachh Outcomes', value: '—', detail: 'access pending', tone: 'neutral' },
  ],
  radar: [{ ulbKey: 'live-pending', name: 'Live data unavailable', district: 'Connector reserved', x: null, y: null, state: 'UNSCORED', reasons: ['LIVE_ACCESS_PENDING'], summary: 'Authentication and dataset permissions are required.' }],
  diagnostics: [liveDiagnostic],
  readiness: {
    cards: [
      { label: 'Connection', value: 'Pending', detail: 'no client-side API access', tone: 'orange' },
      { label: 'Payload coverage', value: 'Unknown', detail: 'full pages not retrieved', tone: 'neutral' },
      { label: 'Reviewed joins', value: '0', detail: 'crosswalk not supplied', tone: 'red' },
      { label: 'Eligible scores', value: '0', detail: 'activation gates not met', tone: 'violet' },
    ], rows: sampleReadinessRows.map((row) => ({ ...row, records: null, period: 'Live request not made', snapshotComplete: false, payloadEvidence: 'ACCESS PENDING', joinReadiness: 'NOT EVALUATED', eligibility: 'UNSCORED', representative: false })),
    gates: sampleData.readiness.gates,
  },
};

export const datasets: Record<DataMode, ModeDataset> = { DEMO: demoData, SAMPLE: sampleData, LIVE: liveData };

export function createProvider(mode: DataMode): SasaDataProvider {
  const dataset = datasets[mode];
  return {
    mode,
    getOverview: () => dataset.overview,
    getGapAssessments: () => dataset.radar,
    getDiagnostic: (ulbKey) => dataset.diagnostics.find((item) => item.ulbKey === ulbKey) ?? dataset.diagnostics[0],
    getReadiness: () => dataset.readiness,
  };
}

export const stateLabels: Record<GapState, string> = {
  DOING_WELL: 'Doing Well', LEARN_FROM: 'Learn From', INFRASTRUCTURE_GAP: 'Infrastructure Gap', INVESTIGATE: 'Investigate',
  // Plain wording on purpose: "Unscored" was routinely read as poor performance.
  UNSCORED: 'Not enough evidence',
};

export const reasonLabels: Record<UnscoredReason, string> = {
  ULB_MATCH_UNREVIEWED: 'Name match not confirmed', PERIOD_MISMATCH: 'Reporting periods do not align', STALE_OUTCOME: 'Outcome data is from an earlier year',
  MISSING_VALUE: 'Required value missing', INVALID_DENOMINATOR: 'Denominator is zero or missing', INCOMPLETE_PAYLOAD: 'Full response not retained',
  LIVE_ACCESS_PENDING: 'Live access pending', PERIOD_CONFLICT: 'Source period fields conflict',
};
