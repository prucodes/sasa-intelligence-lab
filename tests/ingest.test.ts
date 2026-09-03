import { describe, expect, it } from 'vitest';
import { datasets, pick, pickNumber, periodOf } from '../scripts/dataset-map.mjs';
import { aggregateRecords, rollUpToUlb } from '../scripts/aggregate.mjs';

const config = datasets.msw_door_to_door_collection_api;

const row = (over: Record<string, string | null> = {}) => ({
  date1: '2026-08-12',
  district_name: 'Anantapuram',
  district_code: '502',
  ulb_name: 'GUNTAKAL',
  ulb_code: '1003',
  sachivalayam_name: 'GUTTAAREA-02',
  sachivalayam_code: '21003020',
  total_households: '886',
  collected_households: '400',
  garbage_segregation: '120',
  api_lgd_dist_code: '502',
  api_district_name: 'ANANTHAPURAMU',
  api_lgd_mandal_code: '1003',
  api_mandal_name: 'GUNTAKAL',
  ...over,
});

describe('field mapping', () => {
  it('takes the first present candidate so a column rename is a one-line change', () => {
    expect(pick(row(), config.district)).toBe('502');
    // When the LGD column is absent the mapping falls back to the legacy column.
    expect(pick(row({ api_lgd_dist_code: null }), config.district)).toBe('502');
  });

  it('treats blank, null and NA as missing rather than as values', () => {
    expect(pick(row({ ulb_name: '', api_mandal_name: null }), config.ulbName)).toBeNull();
    expect(pick({ achivement: 'NA' }, ['achivement'])).toBeNull();
    expect(pick({ achivement: '' }, ['achivement'])).toBeNull();
  });

  it('keeps a reported zero distinct from a missing value', () => {
    expect(pickNumber(row({ collected_households: '0' }), config.measures.collectedHouseholds)).toBe(0);
    expect(pickNumber(row({ collected_households: '' }), config.measures.collectedHouseholds)).toBeNull();
  });

  it('parses quoted and comma-formatted numbers seen in the retained payloads', () => {
    expect(pickNumber({ target: '"36,400"' }, ['target'])).toBe(36400);
  });

  it('derives the period from the observation date', () => {
    expect(periodOf(row(), config)).toBe('2026-08');
    expect(periodOf(row({ date1: '' }), config)).toBeNull();
  });
});

describe('aggregation', () => {
  it('collapses daily rows into one bucket per secretariat per period', () => {
    const { rows } = aggregateRecords([
      row({ date1: '2026-08-12', collected_households: '400' }),
      row({ date1: '2026-08-13', collected_households: '500' }),
    ], config);
    expect(rows).toHaveLength(1);
    expect(rows[0].rows).toBe(2);
    expect(rows[0].days).toBe(2);
    expect(rows[0].measures.collectedHouseholds.sum).toBe(900);
  });

  it('counts reported zeros and missing values separately', () => {
    const { rows } = aggregateRecords([
      row({ date1: '2026-08-12', collected_households: '0' }),
      row({ date1: '2026-08-13', collected_households: '' }),
      row({ date1: '2026-08-14', collected_households: '250' }),
    ], config);
    const measure = rows[0].measures.collectedHouseholds;
    expect(measure.reported).toBe(2);
    expect(measure.zero).toBe(1);
    expect(measure.missing).toBe(1);
    expect(measure.sum).toBe(250);
  });

  it('suppresses a ratio when the denominator was never reported', () => {
    const { rows } = aggregateRecords([
      row({ total_households: '', collected_households: '10' }),
    ], config);
    expect(rows[0].ratios.collectionCoverage).toBeNull();
  });

  it('computes a coverage ratio only from reported denominators', () => {
    const { rows } = aggregateRecords([row({ total_households: '1000', collected_households: '250' })], config);
    expect(rows[0].ratios.collectionCoverage).toBeCloseTo(0.25);
  });

  it('skips rows with no usable date or entity rather than inventing one', () => {
    const { skipped } = aggregateRecords([
      row({ date1: '' }),
      row({ ulb_code: null, api_lgd_mandal_code: null, sachivalayam_code: null, secretariat_code: null }),
    ], config);
    expect(skipped.noPeriod).toBe(1);
    expect(skipped.noEntity).toBe(1);
  });

  it('separates periods for the same secretariat', () => {
    const { rows } = aggregateRecords([
      row({ date1: '2026-08-12' }),
      row({ date1: '2026-09-02' }),
    ], config);
    expect(rows.map((entry) => entry.period)).toEqual(['2026-08', '2026-09']);
  });
});

describe('ULB roll-up', () => {
  it('sums secretariats into one row per ULB per period and keeps missing counts', () => {
    const { rows } = aggregateRecords([
      row({ sachivalayam_code: '21003020', total_households: '500', collected_households: '250' }),
      row({ sachivalayam_code: '21003021', total_households: '500', collected_households: '' }),
    ], config);
    const [ulb] = rollUpToUlb(rows, config);
    expect(ulb.subEntities).toBe(2);
    expect(ulb.measures.totalHouseholds.sum).toBe(1000);
    expect(ulb.measures.collectedHouseholds.missing).toBe(1);
    expect(ulb.ratios.collectionCoverage).toBeCloseTo(0.25);
  });
});
