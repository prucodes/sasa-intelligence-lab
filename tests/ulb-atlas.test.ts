import {describe, expect, it} from 'vitest';
import {atlasCsv, districtMapRows, districtPlacements, getUlbAtlas, largestGaps, lgdDistrictNames, lookFirst, measureHeadline, type AtlasValue} from '@/lib/ulb-atlas';
import {getRankingDefinition, rankSubject} from '@/lib/subject-rankings';
import {serviceSnapshot} from '@/lib/ulb-service';
import {governedSnapshotByKey} from '@/lib/snapshots';

const model = getUlbAtlas();
const values = (id: Parameters<typeof measureHeadline>[1]) => model.ulbs.map((ulb) => ulb.cells[id]).filter((cell): cell is AtlasValue => cell?.state === 'value');

describe('ULB atlas model', () => {
  it('holds every registry ULB once, keyed by its urban body code', () => {
    expect(model.ulbs).toHaveLength(serviceSnapshot.ulbs.length);
    expect(new Set(model.ulbs.map((ulb) => ulb.code)).size).toBe(model.ulbs.length);
    expect(model.stats.cells).toBe(model.ulbs.length * model.measures.length);
    expect(model.stats.placed + model.stats.held + model.stats.unreported).toBe(model.stats.cells);
  });

  it('agrees with the governed rankings on every delivery rate it places', () => {
    for (const id of ['reach', 'segregation', 'toilets'] as const) {
      const ranked = new Map(rankSubject(getRankingDefinition(id).inputs).rows.filter((row) => row.identity).map((row) => [row.identity!.slice('urban:'.length), row.rate]));
      for (const ulb of model.ulbs) {
        const cell = ulb.cells[id];
        if (cell?.state === 'value') expect(cell.value).toBeCloseTo(ranked.get(ulb.code)!, 8);
      }
    }
  });

  it('counts ties as shared, so a floor most ULBs report is not singled out', () => {
    const toilets = values('toilets');
    const zero = toilets.filter((cell) => cell.value === 0);
    expect(zero.length).toBeGreaterThan(toilets.length / 2);
    for (const cell of zero) { expect(cell.ahead).toBe(0); expect(cell.tied).toBe(zero.length - 1); expect(cell.step).toBe(0); }
  });

  it('colours a rate by its own value, not by its rank among peers', () => {
    for (const cell of values('reach')) expect(cell.step).toBe(Math.min(4, Math.floor(cell.value / 20)));
  });

  it('never places a survey row twice, and counts the mandal-coded repeats it leaves out', () => {
    const survey = model.measures.find((measure) => measure.id === 'odf')!;
    expect(survey.reporting + survey.held).toBeLessThanOrEqual(model.ulbs.length);
    expect(survey.uncodedRepeats).toBeGreaterThan(0);
    expect(survey.uncodedRepeats).toBeLessThanOrEqual(survey.uncoded);
  });

  it('reads the sewage plants for the latest month the response states, and none as operating', () => {
    const latest = Math.max(...governedSnapshotByKey.get('sewage_treated_qty_new1_api')!.records.map((row) => Number(row.mnth_no)));
    expect(model.measures.find((measure) => measure.id === 'stp')!.period).toContain(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][latest - 1]);
    expect(measureHeadline(model, 'stp').tiles.find((tile) => tile.label === 'Reported operating')!.value).toBe('0');
  });

  it('states the faecal sludge month as unknown rather than choosing one', () => {
    expect(model.measures.find((measure) => measure.id === 'fstp')!.period).toBe('Month not established');
  });

  it('sums shortfalls in units and ranks them largest first', () => {
    const gaps = largestGaps(model, 'reach', 5);
    expect(gaps).toHaveLength(5);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i - 1].cell.gap).toBeGreaterThanOrEqual(gaps[i].cell.gap);
    for (const {cell} of gaps) expect(cell.gap).toBe(cell.count!.of - cell.count!.done);
  });

  it('pools the headline from the same counts the cells carry', () => {
    const cells = values('reach');
    const pooled = cells.reduce((sum, cell) => sum + cell.count!.done, 0) / cells.reduce((sum, cell) => sum + cell.count!.of, 0) * 100;
    expect(measureHeadline(model, 'reach').figure).toBeCloseTo(pooled, 10);
  });

  it('never sends a reader first to 2024 survey context', () => {
    for (const ulb of model.ulbs) {
      const first = lookFirst(ulb, model);
      if (first) expect(first.measure.family).not.toBe('Survey outcomes, 2024');
    }
  });

  it('places districts by LGD code and leaves a code with two names unresolved', () => {
    const names = lgdDistrictNames();
    const placements = districtPlacements(model);
    expect(placements.get('Anantapuram')).toBe('ANANTHAPURAMU');
    for (const district of model.districts) if (district.code && district.lgdName) expect(names.get(district.code)).toBe(district.lgdName);
  });

  it('does not map national ranks, whose lists the response does not name', () => {
    expect(districtMapRows(model, 'rank')).toBeNull();
    expect(districtMapRows(model, 'reach')!.rows).toHaveLength(model.districts.length);
  });

  it('exports one CSV row per ULB with every measure and its position', () => {
    const lines = atlasCsv(model).split('\n');
    expect(lines).toHaveLength(model.ulbs.length + 1);
    expect(lines[0].split(',').length).toBe(3 + model.measures.length * 2);
  });

  it('lists every respelled ULB with the register name first', () => {
    for (const ulb of model.ulbs.filter((entry) => entry.spellings.length > 1)) expect(ulb.spellings[0]).toBe(ulb.name);
    expect(model.stats.respelled).toBeGreaterThan(0);
  });
});
