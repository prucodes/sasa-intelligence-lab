import manifest from '@/data/snapshot-fingerprints.json';

interface PeriodFingerprint {
  rows: number;
  content: string;
  entities: string;
}

interface DatasetFingerprint {
  tableKey: string | null;
  retrievedAt: string | null;
  rows: number;
  content: string;
  periods: Record<string, PeriodFingerprint>;
}

const datasets = manifest.datasets as Record<string, DatasetFingerprint>;

export interface DatasetVintage {
  tableKey: string;
  retrievedAt: string;
  rows: number;
  periods: Array<{ period: string; rows: number; content: string }>;
}

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-');
  const index = Number.parseInt(month, 10) - 1;
  return monthLabels[index] ? `${monthLabels[index]} ${year}` : period;
}

export const datasetVintages: DatasetVintage[] = Object.entries(datasets)
  .map(([key, value]) => ({
    tableKey: value.tableKey ?? key,
    retrievedAt: value.retrievedAt ?? '',
    rows: value.rows,
    periods: Object.entries(value.periods)
      .map(([period, fingerprint]) => ({ period, rows: fingerprint.rows, content: fingerprint.content }))
      .sort((a, b) => a.period.localeCompare(b.period)),
  }))
  .sort((a, b) => a.tableKey.localeCompare(b.tableKey));

// Keep the full timestamp: a date-only string parses as UTC midnight and can
// render as the previous day west of Greenwich.
const retrievalDates = datasetVintages
  .map((item) => item.retrievedAt)
  .filter(Boolean)
  .sort();

export const vintageSummary = {
  datasets: datasetVintages.length,
  periods: datasetVintages.reduce((total, item) => total + item.periods.length, 0),
  rows: datasetVintages.reduce((total, item) => total + item.rows, 0),
  earliestRetrieval: retrievalDates[0] ?? '',
  latestRetrieval: retrievalDates[retrievalDates.length - 1] ?? '',
  /** Datasets whose retained rows span more than one reported period. */
  multiPeriodDatasets: datasetVintages.filter((item) => item.periods.length > 1).length,
};

export function formatRetrievalDate(value: string): string {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
