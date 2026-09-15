import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { GOATCOUNTER_ENDPOINT, VISIT_COUNTER_SCRIPT } from '@/lib/visit-counter';

type CounterWindow = Window & typeof globalThis & {
  goatcounter: { path: () => string; count?: (vars: { path: string }) => void };
};

const APP = 'https://prucodes.github.io/sasa-intelligence-lab';

// Runs the inline script the way the layout ships it. count.js itself is never fetched.
function open(url: string) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><script>${VISIT_COUNTER_SCRIPT}</script></body></html>`, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const window = dom.window as unknown as CounterWindow;
  const count = vi.fn();
  window.goatcounter.count = count;
  return { window, count };
}

function setVisibility(window: CounterWindow, state: 'visible' | 'hidden') {
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => state });
}

describe('visit counter', () => {
  it('records a screen as its address and the parameters that pick the screen', () => {
    const { window } = open(`${APP}/operational-analytics/?mode=governed&theme=dark&tab=processing&subview=facilities&present=1`);
    expect(window.goatcounter.path()).toBe('/sasa-intelligence-lab/operational-analytics/?tab=processing&subview=facilities');
  });

  it('loads count.js asynchronously with the prucodes endpoint', () => {
    const { window } = open(`${APP}/?mode=governed`);
    const loader = window.document.head.querySelector<HTMLScriptElement>('script[src="https://gc.zgo.at/count.js"]');
    expect(loader?.async).toBe(true);
    expect(loader?.getAttribute('data-goatcounter')).toBe(GOATCOUNTER_ENDPOINT);
    expect(window.goatcounter.path()).toBe('/sasa-intelligence-lab/');
  });

  it('counts a tab or view change once, and ignores mode, theme and selections', () => {
    const { window, count } = open(`${APP}/operational-analytics/?mode=governed&tab=collection`);
    window.history.replaceState({}, '', '?mode=demo&tab=collection&theme=dark');
    expect(count).not.toHaveBeenCalled();
    window.history.replaceState({}, '', '?mode=demo&tab=delivery');
    window.history.replaceState({}, '', '?mode=governed&tab=delivery');
    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({ path: '/sasa-intelligence-lab/operational-analytics/?tab=delivery' });
    window.history.pushState({}, '', `${APP}/gap-radar/?mode=governed&view=rankings&ulb=NARSIPATNAM`);
    expect(count).toHaveBeenCalledTimes(2);
    expect(count).toHaveBeenLastCalledWith({ path: '/sasa-intelligence-lab/gap-radar/?view=rankings' });
  });

  it('skips changes while the page is hidden, and counts back and forward moves', () => {
    const { window, count } = open(`${APP}/gap-radar/?view=service`);
    setVisibility(window, 'hidden');
    window.history.pushState({}, '', '?view=rankings');
    expect(count).not.toHaveBeenCalled();
    setVisibility(window, 'visible');
    // Change the address without the wrapper, as the browser does before firing popstate.
    window.History.prototype.replaceState.call(window.history, {}, '', '?view=register');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
    expect(count).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith({ path: '/sasa-intelligence-lab/gap-radar/?view=register' });
  });
});
