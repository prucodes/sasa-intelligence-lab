import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {measurement, reportedSum, latestMonthlyRows} from '@/lib/measurement';
import {askEvidence, suggestedQuestions, checkWrittenAnswer} from '@/lib/ask-evidence';
import {atlasCsv, getUlbAtlas, measureHeadline, districtMapRows} from '@/lib/ulb-atlas';
import {atlasBrief} from '@/lib/atlas-brief';
import {AskEvidence} from '@/app/ask-evidence';

describe('reported measurement boundaries', () => {
  it.each(['', ' ', null, undefined, -2, '-23%', 'NaN', Infinity, true])('does not turn %s into a nonnegative reading', value => expect(measurement(value)).toBeNull());
  it('preserves genuine zero and quoted formatted measurements', () => {
    expect(measurement('0')).toBe(0);
    expect(measurement('"1,234.5"')).toBe(1234.5);
    expect(measurement('46.2%')).toBe(46.2);
    expect(reportedSum([1, null, 3])).toBeNull();
    expect(reportedSum([0, 3])).toBe(3);
    expect(reportedSum([])).toBeNull();
  });
  it('selects January of the next year over December, excluding undated rows', () => {
    const rows = [{year:2026, month:12}, {year:2027, month:1}, {year:2027, month:13}, {year:'', month:12}];
    expect(latestMonthlyRows(rows)).toEqual([rows[1]]);
  });
});

describe('rank and export boundaries', () => {
  const atlas = getUlbAtlas();
  it('withholds rank comparisons across every data presentation', () => {
    const measure = atlas.measures.find(m => m.id === 'rank')!;
    expect(measure.median).toBeNull();
    expect(atlas.districts.every(d => d.medians.rank === null)).toBe(true);
    expect(districtMapRows(atlas, 'rank')).toBeNull();
    expect(measureHeadline(atlas, 'rank').figure).toBe(measure.reporting);
    for (const ulb of atlas.ulbs) {
      const cell = ulb.cells.rank;
      if (cell?.state === 'value') {expect(cell.comparable).toBe(false); expect(cell.ahead).toBe(0);}
    }
    expect(atlasCsv(atlas)).toContain('Comparison withheld: ranking category not supplied');
  });
  it('exports only the selected population and preserves held readings', () => {
    const rows = atlas.ulbs.filter(u => u.district === atlas.ulbs[0].district);
    const brief = atlasBrief(atlas, rows, 'toilets', rows[0].district);
    expect(brief).toContain(`${rows.length} visible ULBs`);
    expect(brief).toContain('July 2026');
    expect(brief).toContain('held out');
    expect(brief).not.toContain(`urban body code ${atlas.ulbs.find(u => u.district !== rows[0].district)!.code}:`);
  });
});

describe('deterministic evidence questions', () => {
  it.each(suggestedQuestions())('answers the suggested question: %s', question => {
    const answer = askEvidence(question);
    expect(answer.status).toBe('answered');
    expect(answer.facts.length).toBeGreaterThan(0);
    expect(answer.facts.every(f => f.period && f.dataset && f.screen)).toBe(true);
  });
  it.each(['Why is collection low?', 'Which city has the best rank?', 'Collection in Atlantis', 'Collection in Atlantis district', 'Compare collection in Vijayawada city vs Atlantis', 'Collection today', 'Toilets in June 2026', 'Which district has the most legacy waste?', 'Collection in Visakhapatnam'])('withholds unsupported or ambiguous answers: %s', question => {
    expect(askEvidence(question).status).toBe('not-found');
  });
  it('honours city and district grain separately', () => {
    expect(askEvidence('Collection in Visakhapatnam city').facts.every(f => f.kind === 'ulb')).toBe(true);
    expect(askEvidence('Collection in Visakhapatnam district').facts.every(f => f.kind === 'district')).toBe(true);
  });
  it('rejects a false conclusion even when all numbers are drawn from real facts', () => {
    const facts = askEvidence('Collection in Vijayawada city').facts;
    expect(facts.length).toBeGreaterThan(0);
    expect(checkWrittenAnswer(facts[0].sentence, [facts[0].id], facts, '').ok).toBe(true);
    expect(checkWrittenAnswer(`${facts[0].sentence} This proves success.`, [facts[0].id], facts, '').ok).toBe(false);
    expect(checkWrittenAnswer(facts[0].sentence, ['invented'], facts, '').ok).toBe(false);
  });
  it('opens a usable dialog, shows source-backed answers and closes with Escape', () => {
    const close = vi.fn();
    render(<AskEvidence onClose={close} href={path => path}/>);
    expect(screen.getByRole('textbox', {name:'Your question'})).toHaveFocus();
    fireEvent.click(screen.getByRole('button', {name:/highest remaining share/}));
    expect(screen.getByLabelText('Evidence answer')).toHaveTextContent('Prakasam');
    expect(screen.getAllByRole('link', {name:/Open evidence/}).length).toBeGreaterThan(0);
    fireEvent.keyDown(document, {key:'Escape'});
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('written framing from the optional Claude worker', () => {
  it('accepts a plain framing sentence and rejects figures, judgements and causes', async () => {
    const {checkFraming, modelRecords} = await import('@/lib/ask-evidence');
    expect(checkFraming('Here are the collection and segregation readings retained for Vijayawada, from the August service day.').ok).toBe(true);
    for (const text of ['Vijayawada collects from 74% of households.', 'Vijayawada is doing better than Guntur.', 'Collection is low because vehicles are missing.', 'Kurnool will reach the target soon.', 'The target was missed.', ''])
      expect(checkFraming(text).ok).toBe(false);
    const records = modelRecords(askEvidence('How is Vijayawada city doing on collection and segregation?'));
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) expect(record.text).toMatch(/\[.+; .+\]$/);
  });
});

describe('assistant charts', () => {
  it('places a named ULB at its own Atlas value among every ULB with a value', () => {
    const answer = askEvidence('How is Vijayawada city doing on collection and segregation?');
    const strip = answer.charts!.find((chart) => chart.kind === 'strip' && chart.title.startsWith('Collection reach'))!;
    if (strip.kind !== 'strip') throw new Error('expected a strip');
    const atlas = getUlbAtlas();
    const vijayawada = atlas.ulbs.find((ulb) => ulb.name === 'VIJAYAWADA')!.cells.reach!;
    if (vijayawada.state !== 'value') throw new Error('expected a value');
    expect(strip.points.filter((point) => point.highlight).map((point) => point.value)).toEqual([vijayawada.value]);
    expect(strip.points).toHaveLength(atlas.measures.find((measure) => measure.id === 'reach')!.reporting);
  });

  it('never draws an urban trend from the window of mostly stored zeros, and says why', () => {
    const answer = askEvidence('Collection trend in Guntur city');
    expect(answer.charts?.some((chart) => chart.kind === 'line')).toBe(false);
    expect(answer.notes.join(' ')).toMatch(/No urban trend is drawn/);
  });

  it('draws rural months from the common cohort exactly as retained', async () => {
    const months = (await import('@/data/aggregates/month-series.json')).default;
    const answer = askEvidence('Rural collection in Kurnool district');
    const line = answer.charts!.find((chart) => chart.kind === 'line')!;
    if (line.kind !== 'line') throw new Error('expected a line');
    expect(line.series[0].values).toEqual(months.series.map((entry) => entry.comparable.collectionRate * 100));
    const kurnool = months.byDistrict.find((row) => row.district === 'Kurnool')!;
    expect(line.series.find((entry) => entry.label === 'Kurnool')!.values).toEqual(kurnool.points.map((point) => point.collectionRate * 100));
  });

  it('profiles districts highest first and draws nothing for incomparable ranks', () => {
    const answer = askEvidence('Which district has the highest remaining share of legacy waste?');
    const columns = answer.charts!.find((chart) => chart.kind === 'columns')!;
    if (columns.kind !== 'columns') throw new Error('expected columns');
    expect(columns.bars.map((bar) => bar.value)).toEqual([...columns.bars.map((bar) => bar.value)].sort((a, b) => b - a));
    expect(columns.lowerIsBetter).toBe(true);
    expect(askEvidence('What is the reported rank of Guntur city?').charts ?? []).toHaveLength(0);
  });
});
