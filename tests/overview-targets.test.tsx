import {fireEvent, render, screen, within} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {OverviewReview} from '@/app/overview-review';
import {LabApp} from '@/app/lab-app';
import {LAST_SOURCE_CHECK, getSasaGoals, goalSummary, householdLine, pooledDistrictMap, statusLabel} from '@/lib/sasa-goals';

const href = (path: string) => `${path}?mode=governed`;
const model = getSasaGoals();
// Kurnool and Bapatla carry readings; Alluri Sitharama Raju has no town in the register.
const shapes = [
  {d: 'Kurnool', path: 'M0 0L10 0L10 10Z'},
  {d: 'Bapatla', path: 'M20 0L30 0L30 10Z'},
  {d: 'Alluri Sitharama Raju', path: 'M40 0L50 0L50 10Z'},
];

describe('overview targets band', () => {
  beforeEach(() => window.history.replaceState({}, '', '/?mode=governed'));

  it('carries the same tally, below-target readings and freshness as the Goals screen', () => {
    render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const band = screen.getByRole('region', {name: new RegExp(`^${model.goals.length} stated targets`)});
    const summary = goalSummary(model.goals);
    const tally = within(band).getByRole('list', {name: 'Targets by status'});
    expect(tally).toHaveTextContent(`${summary.shortAfterDeadline}${statusLabel['short-after-deadline']}`);
    expect(tally).toHaveTextContent(`${summary.notMeasured}${statusLabel['not-measured']}`);
    // One plain line per target, the ones below target after their date first, each opening its Goals row.
    const list = within(band).getByRole('list', {name: 'Every stated target'});
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(model.goals.length);
    const shortGoals = model.goals.filter((goal) => goal.status === 'short-after-deadline');
    shortGoals.forEach((goal, index) => expect(items[index]).toHaveClass('is-short-after-deadline'));
    for (const goal of model.goals) {
      const item = items.find((entry) => within(entry).getByRole('link').getAttribute('href') === `/goals?mode=governed#goal-${goal.id}`)!;
      expect(item).toHaveTextContent(statusLabel[goal.status]);
      expect(item).toHaveTextContent(goal.deadlineLabel);
      expect(item).toHaveTextContent(goal.reading ? goal.reading.display : 'No data');
      if (goal.reading) expect(item).toHaveTextContent(`latest ${goal.reading.asOfLabel}`);
      expect(item).not.toHaveTextContent(/Due No date|Due SWM/);
      // A bar only where the reading measures the target itself; never for a nearer measure, a tracked count or no data.
      const ring = item.querySelector('.ovt-gauge-value');
      const measuresTarget = goal.reading?.share != null && ['short-after-deadline', 'before-deadline', 'met'].includes(goal.status);
      expect(Boolean(ring)).toBe(measuresTarget);
      if (ring) {
        expect(Number(ring.getAttribute('data-share'))).toBe(goal.reading!.share);
        const circumference = 2 * Math.PI * 22;
        expect(parseFloat(ring.getAttribute('stroke-dasharray')!)).toBeCloseTo(Math.max(1, Math.min(100, goal.reading!.share!)) / 100 * circumference, 1);
      }
    }
    // Legacy waste reads as what is left; its bar shows the share of the target cleared, and says so.
    const legacy = model.goals.find((goal) => goal.id === 'legacy')!;
    const legacyItem = items.find((entry) => within(entry).getByRole('link').getAttribute('href')!.endsWith('#goal-legacy'))!;
    expect(legacyItem).toHaveTextContent(`${legacy.reading!.share!.toLocaleString('en-IN', {maximumFractionDigits: 1})}% of the target reached`);
    expect(band).toHaveTextContent(`Data Lake checked ${LAST_SOURCE_CHECK.date}`);
    expect(within(band).getByRole('link', {name: /Open SASA Goals/})).toHaveAttribute('href', '/goals?mode=governed');
  });
});

describe('every 100 urban households', () => {
  it('draws 100 houses from the same base as the collection and segregation targets', () => {
    const line = householdLine();
    const collection = model.goals.find((goal) => goal.id === 'collection')!.reading!.share!;
    const segregation = model.goals.find((goal) => goal.id === 'segregation')!.reading!.share!;
    expect(line.collected / line.households * 100).toBeCloseTo(collection, 9);
    expect(line.segregated / line.households * 100).toBeCloseTo(segregation, 9);
    render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const section = screen.getByRole('region', {name: /Of every 100 households/});
    expect(section.querySelectorAll('.ovh-house')).toHaveLength(100);
    expect(section.querySelectorAll('.ovh-house.is-segregating')).toHaveLength(Math.round(segregation));
    expect(section.querySelectorAll('.ovh-house.is-segregating, .ovh-house.is-collected')).toHaveLength(Math.round(collection));
    expect(section).toHaveTextContent(`${line.households.toLocaleString('en-IN')} households`);
  });
});

describe('target wheel', () => {
  beforeEach(() => window.history.replaceState({}, '', '/?mode=governed'));

  it('draws one equal segment per target in the tile order, coloured by status, and names the target pointed at', () => {
    const {container} = render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const segments = [...container.querySelectorAll('.ovt-seg')];
    const tiles = [...container.querySelectorAll('.ovt-tile')];
    expect(segments).toHaveLength(model.goals.length);
    segments.forEach((segment, index) => expect(tiles[index]).toHaveClass(`is-${segment.getAttribute('data-status')}`));
    const centre = container.querySelector('.ovt-wheel-centre')!;
    expect(centre).toHaveTextContent(`${model.goals.length}stated targets`);
    const collection = model.goals.find((goal) => goal.id === 'collection')!;
    fireEvent.mouseEnter(within(container.querySelector('.ovt-tiles') as HTMLElement).getByRole('link', {name: /^Collection/}));
    expect(centre).toHaveTextContent(collection.reading!.display.split(' ')[0]);
    expect(centre).toHaveTextContent(statusLabel[collection.status]);
    expect(container.querySelector('.ovt-seg.is-active')).toHaveAttribute('data-status', collection.status);
    expect(container.querySelectorAll('.ovt-seg.is-quiet')).toHaveLength(model.goals.length - 1);
  });
});

describe('overview hero map', () => {
  beforeEach(() => window.history.replaceState({}, '', '/?mode=governed'));

  it('gives each district its Goals figure, in the welcome map bands, and opens its Goals row', () => {
    const {container} = render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    for (const measure of ['collection', 'segregation'] as const) {
      if (measure === 'segregation') fireEvent.click(screen.getByRole('button', {name: 'Segregation'}));
      expect(screen.getByRole('button', {name: measure === 'collection' ? 'Collection' : 'Segregation'})).toHaveAttribute('aria-pressed', 'true');
      for (const name of ['Kurnool', 'Bapatla']) {
        const row = pooledDistrictMap(measure).find((entry) => entry.district === name)!;
        const goalRow = model.districts.rows.find((entry) => entry.district === name)!;
        expect(row.value).toBe(goalRow[measure].value);
        const link = screen.getByRole('link', {name: new RegExp(`^${name}: ${row.value!.toFixed(1)}% of households`)});
        expect(link).toHaveAttribute('href', `/goals?mode=governed&district=${name}#goal-districts`);
        const expected = row.value! < 50 ? 'band-0' : row.value! < 75 ? 'band-1' : 'band-2';
        expect(link.querySelector('path')).toHaveClass(expected);
      }
    }
    // A boundary with no town is hatched, not a link and not a zero.
    expect(container.querySelectorAll('.ov-hero-map path.is-hatched')).toHaveLength(1);
    expect(screen.queryByRole('link', {name: /Alluri Sitharama Raju/})).not.toBeInTheDocument();
  });

  it('names the district under the pointer with its households line', () => {
    render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const row = pooledDistrictMap('collection').find((entry) => entry.district === 'Bapatla')!;
    fireEvent.focus(screen.getByRole('link', {name: /^Bapatla:/}));
    expect(document.querySelector('.ov-map-readout')).toHaveTextContent(`Bapatla ${row.value!.toFixed(1)}% · ${row.detail.split(' · ')[0]}`);
  });

  it('states the collection target and its status under the headline figure', () => {
    render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const goal = model.goals.find((entry) => entry.id === 'collection')!;
    const card = screen.getByRole('button', {name: /Households collected from/});
    expect(card).toHaveTextContent(`Target due ${goal.deadlineLabel} · ${statusLabel[goal.status].toLowerCase()}`);
  });
});

describe('town-level review subjects', () => {
  beforeEach(() => window.history.replaceState({}, '', '/?mode=governed'));

  it('state their total once, in the review card that follows the district filter', () => {
    const {container} = render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    for (const name of ['Vehicle delivery', 'Household toilets', 'Legacy waste']) {
      fireEvent.click(within(screen.getByLabelText('Operational review subjects')).getByRole('button', {name: new RegExp(name)}));
      expect(screen.queryByLabelText('Selected review subject')).not.toBeInTheDocument();
      const total = container.querySelector('.or-hero-value')!.textContent!;
      const workspace = screen.getByLabelText('Connected district and ULB review');
      expect(workspace.querySelectorAll('.or-hero-value')).toHaveLength(1);
      expect(within(workspace).getByRole('link', {name: /ULBs in Gap Radar/})).toHaveAttribute('href', expect.stringContaining('/gap-radar?mode=governed&programme='));
      expect(total).not.toBe('');
    }
    // The rural subject keeps its header: its figure is not repeated below.
    fireEvent.click(within(screen.getByLabelText('Operational review subjects')).getByRole('button', {name: /Rural collection change/}));
    expect(screen.getByLabelText('Selected review subject')).toBeInTheDocument();
  });
});

describe('Goals calendar', () => {
  it('names the year and says what each mark means', () => {
    render(<LabApp page="goals" initialMode="SAMPLE"/>);
    const calendar = document.querySelector('.screen-hero .gt')!;
    expect(calendar.querySelector('.gt-year')).toHaveTextContent('2026');
    expect(calendar.querySelector('.gt-marks')).toHaveTextContent(/Target date.*Latest reading.*When the latest readings were taken/);
    expect(document.body).toHaveTextContent('shows the time between them, not the size of any shortfall');
  });
});

describe('district chosen on the map', () => {
  it('marks that row in the Goals district table', () => {
    window.history.replaceState({}, '', '/goals?mode=governed&district=Bapatla');
    render(<LabApp page="goals" initialMode="SAMPLE"/>);
    const table = screen.getByRole('table', {name: /District standing/});
    const picked = table.querySelector('tr.is-picked')!;
    expect(within(picked as HTMLElement).getByRole('rowheader')).toHaveTextContent('Bapatla');
    expect(table.querySelectorAll('tr.is-picked')).toHaveLength(1);
    window.history.replaceState({}, '', '/');
  });

  it('ignores a district name the register does not hold', () => {
    window.history.replaceState({}, '', '/goals?mode=governed&district=Nowhere');
    render(<LabApp page="goals" initialMode="SAMPLE"/>);
    expect(screen.getByRole('table', {name: /District standing/}).querySelector('tr.is-picked')).toBeNull();
    window.history.replaceState({}, '', '/');
  });
});

describe('every 100 rural panchayat-days', () => {
  it('draws the latest cohort month, follows the day basis, and keeps its own unit', async () => {
    const {getRuralMovement} = await import('@/lib/rural-movement');
    window.history.replaceState({}, '', '/?mode=governed');
    const {container} = render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    for (const basis of ['all-days', 'working-days'] as const) {
      if (basis === 'working-days') fireEvent.change(screen.getByRole('combobox', {name: 'Rural collection day basis'}), {target: {value: 'working-days'}});
      const last = getRuralMovement(basis).series.at(-1)!;
      const rate = last.comparable.collectionRate! * 100;
      const section = screen.getByRole('region', {name: /Of every 100 panchayat.days/});
      expect(section.querySelectorAll('.ovh-house')).toHaveLength(100);
      expect(section.querySelectorAll('.ovh-house.is-reported')).toHaveLength(Math.round(rate));
      expect(section).toHaveTextContent(`${last.comparable.pairs.toLocaleString('en-IN')} in`);
      expect(section).toHaveTextContent('not comparable with the urban figure');
    }
    // The all-days count is the stored one: 62,970 of 85,769 in August.
    const august = getRuralMovement('all-days').series.at(-1)!;
    expect(Math.round(august.comparable.collectionRate! * august.comparable.pairs)).toBe(august.comparable.collected);
    expect(container.querySelectorAll('.ov-households')).toHaveLength(2);
  });
});
