import aggregate from '@/data/aggregates/reporting-continuity.json';

/** Valid reporting includes zero. Positive activity and missing measurements are separate. */

export type ContinuityVerdict = 'single-day-concentration' | 'partial-but-steady' | 'continuous' | 'no-measure';

export interface ContinuityDay {
  date: string;
  rows: number;
  reporting: number;
  reportingRatio: number | null;
  value: number;
  positive:number;
  zero:number;
  missing:number;
  positiveRatio:number|null;
}

export interface ContinuityDataset {
  tableKey: string;
  label: string;
  unit: string | null;
  /** How the measure reads in a sentence: "collected households", not "households". */
  measureLabel: string;
  rows: number;
  rawRows:number;
  quality:{rawRows:number;uniqueRows:number;duplicateRows:number;conflictingKeys:number;conflictingRows:number;missingKeyRows:number};
  missingExpectedRecords:number;
  entitiesWithPositiveActivity:number;
  measure: string | null;
  denominator: string | null;
  entityGrain: string | null;
  entities: number;
  entitiesNeverReporting: number;
  entitiesReportingEveryDay: number;
  days: ContinuityDay[];
  busiestDate: string | null;
  /** Share of all reported value falling on the single busiest day. */
  busiestDateShare: number | null;
  /** What that share would be if reporting were even across the days present. */
  evenShare: number | null;
  verdict: ContinuityVerdict;
  /** The ratio the data invites. Recorded to be shown as unusable, never as a finding. */
  naiveRatio: number | null;
  busiestDayRatio: number | null;
  totalValue: number;
  totalDenominator: number;
  retrievedAt: string;
  pages: number;
}

export interface ReportingContinuity {
  datasets: ContinuityDataset[];
  rows: number;
  entities: number;
  /** Datasets whose reported value is concentrated on one day. */
  concentrated: number;
  boundary: string;
}

const READINGS: Record<ContinuityVerdict, { title: string; reading: string }> = {
  'single-day-concentration': {
    title: 'One day carries the evidence',
    reading: 'Most of the reported value falls on a single day. The remaining days are present, filled, and almost entirely zero, so any rate computed across the whole export is set by one day and diluted by the rest.',
  },
  'partial-but-steady': {
    title: 'A minority of entities, every day',
    reading: 'A minority of observed entities report positive activity. Other retained observations may be valid zero or missing measures. Changing daily record coverage limits comparisons.',
  },
  continuous: {
    title: 'Reported across days and entities',
    reading: 'Reporting is spread across both the days and the entities present. That makes the series readable, though it still establishes what was reported and not what occurred.',
  },
  'no-measure': {
    title: 'No measure column resolved',
    reading: 'No positive measured total is available in this export. Inspect valid zeros and missing measurements separately.',
  },
};

export function continuityReading(verdict: ContinuityVerdict) {
  return READINGS[verdict];
}

export function getReportingContinuity(): ReportingContinuity {
  const datasets = aggregate.datasets as ContinuityDataset[];
  return {
    datasets,
    rows: datasets.reduce((total, dataset) => total + dataset.rows, 0),
    entities: Math.max(...datasets.map((dataset) => dataset.entities), 0),
    concentrated: datasets.filter((dataset) => dataset.verdict === 'single-day-concentration').length,
    boundary: aggregate.boundary,
  };
}
