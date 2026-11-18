import {afterEach, describe, expect, it} from 'vitest';
import {EARLY_REVEAL_SCRIPT, revealedEarly} from '@/lib/early-reveal';

/** Runs the inline head script against a URL, as the browser would before first paint. */
function boot(url: string) {
  document.documentElement.removeAttribute('data-boot');
  document.documentElement.classList.remove('motion-early');
  window.history.replaceState({}, '', url);
  new Function(EARLY_REVEAL_SCRIPT)();
  return revealedEarly();
}

describe('early reveal of the prerendered page', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('shows a governed, light link at once, since the prerender is exactly that view', () => {
    expect(boot('/')).toBe(true);
    expect(boot('/goals/?mode=governed')).toBe(true);
    expect(boot('/atlas/?mode=sample&measure=reach')).toBe(true);
  });

  it('keeps the shell hidden until the client resolves any other mode or theme', () => {
    expect(boot('/?mode=demo')).toBe(false);
    expect(boot('/?mode=live')).toBe(false);
    expect(boot('/?mode=governed&theme=dark')).toBe(false);
    expect(boot('/?present=1')).toBe(false);
    expect(boot('/diagnostics/live-pending/')).toBe(false);
    expect(boot('/diagnostics/demo-delta/')).toBe(false);
  });
});
