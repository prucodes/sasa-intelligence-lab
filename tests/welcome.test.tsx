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
