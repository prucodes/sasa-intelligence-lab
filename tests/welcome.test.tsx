import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {WelcomeScreen} from '@/app/welcome';
import {WELCOME_ENTRY_SCRIPT, WELCOME_SEEN_KEY} from '@/lib/welcome-entry';

// Run the same inline script as an initial document load, before hydration.
function visitHome(path = '/') {
  delete document.documentElement.dataset.sasaWelcome;
  window.history.replaceState({}, '', path);
  new Function(WELCOME_ENTRY_SCRIPT)();
  return document.documentElement.dataset.sasaWelcome;
}

describe('welcome entry', () => {
  beforeEach(() => {
    localStorage.removeItem(WELCOME_SEEN_KEY);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem(WELCOME_SEEN_KEY);
    delete document.documentElement.dataset.sasaWelcome;
    window.history.replaceState({}, '', '/');
  });

  it('opens on first visit at the development and production home addresses', () => {
    expect(visitHome()).toBe('open');
    expect(visitHome('/sasa-intelligence-lab/')).toBe('open');
  });

  it.each(['/?mode=governed', '/?mode=demo', '/?theme=dark', '/#main-content', '/?present=1', '/?welcome=1&present=1'])(
    'preserves a direct workspace link at %s',
    path => expect(visitHome(path)).not.toBe('open'),
  );

  it('enters the lab, remembers the decision and supports an explicit replay', async () => {
    visitHome();
    render(<WelcomeScreen/>);
    const enter = screen.getByRole('link', {name: /enter the lab/i});
    const fallback = new URL(enter.getAttribute('href')!, window.location.href);
    expect(fallback.searchParams.get('mode')).toBe('governed');
    fireEvent.click(enter);
    await waitFor(() => {
      expect(localStorage.getItem(WELCOME_SEEN_KEY)).toBeTruthy();
      expect(document.documentElement.dataset.sasaWelcome).toBeUndefined();
    });
    expect(visitHome()).not.toBe('open');
    expect(visitHome('/?welcome=1')).toBe('open');
  });

  it('still allows entry when the browser denies access to storage', async () => {
    const denied = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
    expect(visitHome()).toBe('open');
    render(<WelcomeScreen/>);
    fireEvent.click(screen.getByRole('link', {name: /enter the lab/i}));
    await waitFor(() => expect(document.documentElement.dataset.sasaWelcome).toBeUndefined());
  });

  it.each([true, false])('restores workspace focus and preserves query parameters with motion allowed = %s', async enabled => {
    vi.stubGlobal('matchMedia', (query: string) => ({matches: enabled && query.includes('no-preference')}));
    visitHome('/?welcome=1&theme=dark&mode=governed');
    render(<><WelcomeScreen/><main id="main-content" tabIndex={-1}>Workspace</main></>);
    fireEvent.click(screen.getByRole('link', {name: /enter the lab/i}));
    if (enabled) expect(document.documentElement.dataset.sasaWelcome).toBe('leaving');
    else expect(document.documentElement.dataset.sasaWelcome).toBeUndefined();
    await waitFor(() => expect(document.getElementById('main-content')).toHaveFocus());
    const params = new URLSearchParams(window.location.search);
    expect(params.has('welcome')).toBe(false);
    expect(params.get('theme')).toBe('dark');
    expect(params.get('mode')).toBe('governed');
  });
});

describe('welcome map figures', () => {
  // The maps are generated files; these checks fail if they drift from the Goals district table.
  it('gives each district the same pooled figure as the Goals screen, and names any district it cannot draw', async () => {
    const {readFileSync} = await import('node:fs');
    const {welcomeMapKey, welcomeSegregationKey} = await import('@/lib/welcome-map-key');
    const {getSasaGoals, pooledDistrictMap} = await import('@/lib/sasa-goals');
    const {districtPlacements, getUlbAtlas} = await import('@/lib/ulb-atlas');
    const normal = (label: string) => label.toUpperCase().replace(/[^A-Z]/g, '');
    const placements = districtPlacements(getUlbAtlas());
    const shapes: string[] = JSON.parse(readFileSync('public/ap-districts.geojson', 'utf8')).features.map((feature: {properties: {d: string}}) => feature.properties.d);
    const goals = getSasaGoals().districts.rows;
    const fmt = (value: number) => `${value.toFixed(1)}%`;
    for (const [key, column] of [[welcomeMapKey, 'collection'], [welcomeSegregationKey, 'segregation']] as const) {
      const rows = pooledDistrictMap(column);
      const drawn = shapes.map((shape) => rows.filter((row) => normal(placements.get(row.district) ?? row.district) === normal(shape))).filter((match) => match.length === 1 && match[0].value !== null).map((match) => match[0]);
      expect(key.mapped).toBe(drawn.length);
      expect(key.total).toBe(shapes.length);
      expect(key.mapUlbCount).toBe(drawn.reduce((sum, row) => sum + row.ulbs, 0));
      const band = (value: number) => value < 50 ? 0 : value < 75 ? 1 : 2;
      expect(key.bands.map((entry) => entry.count)).toEqual([0, 1, 2].map((index) => drawn.filter((row) => band(row.value!) === index).length));
      for (const example of key.examples) {
        const goal = goals.find((row) => row.district === example.district)!;
        expect(example.display).toBe(fmt(goal[column].value!));
      }
      const offMap = rows.filter((row) => row.value !== null && !drawn.includes(row));
      expect(key.offMap.map((row) => row.district)).toEqual(offMap.map((row) => row.district));
      // Every district with a reading is either drawn or named; none is dropped silently.
      expect(drawn.length + offMap.length).toBe(rows.filter((row) => row.value !== null).length);
    }
  });
});
