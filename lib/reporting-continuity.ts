import aggregate from '@/data/aggregates/reporting-continuity.json';

/**
 * Whether a source was reported, as distinct from whether it was filled.
 *
 * The secretariat-day CDMA exports arrive 100% complete on every column. Nothing is
 * blank, so every completeness check in this product passes them. The defect is a value
 * that is present and zero, repeated across most entities and most days — which is
 * indistinguishable from "nothing happened" unless you look at who reported and when.
 *
 * That distinction matters because these datasets invite an obvious ratio. Dividing
 * collected households by total households across the whole door-to-door export gives
 * 4.4% statewide coverage. The same division on the one day most secretariats reported
 * gives 56.1%. Neither is published here. The gap between them is the finding.
 */

export type ContinuityVerdict = 'single-day-concentration' | 'partial-but-steady' | 'continuous' | 'no-measure';

export interface ContinuityDay {
  date: string;
  rows: number;
  reporting: number;
  reportingRatio: number | null;
  value: number;
}

export interface ContinuityDataset {
  tableKey: string;
  label: string;
  unit: string | null;
  /** How the measure reads in a sentence: "collected households", not "households". */
  measureLabel: string;
  rows: number;
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
    reading: 'Most of the reported value falls on a single day. The remaining days are present, filled, and almost entirely zero — so any rate computed across the whole export is set by one day and diluted by the rest.',
  },
  'partial-but-steady': {
    title: 'A minority of entities, every day',
    reading: 'Reporting is consistent across the days present, but only a minority of entities ever report. The series is stable and the population behind it is not, so a total describes the reporters rather than the state.',
  },
  continuous: {
    title: 'Reported across days and entities',
    reading: 'Reporting is spread across both the days and the entities present. That makes the series readable, though it still establishes what was reported and not what occurred.',
  },
  'no-measure': {
    title: 'No measure column resolved',
    reading: 'No countable measure was found in this export, so reporting continuity cannot be assessed for it.',
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
