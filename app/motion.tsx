'use client';

import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode} from 'react';
import {revealedEarly} from '@/lib/early-reveal';

/**
 * Motion that is correct first and animated second.
 *
 * Every element renders its true resting state on the server and on first paint. Motion is
 * added afterwards, only when the viewer allows it, the tab is visible and the element is on
 * screen, so a thumbnail, a background tab or a reader who prefers reduced motion always gets
 * the finished page rather than a frame parked halfway through an animation.
 */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Runs `onEnter` once when the element first meets the viewport, with a timer so it is never left waiting. */
function watchFirstSight(node: Element, onEnter: () => void) {
  let fired = false;
  const fire = () => { if (!fired) { fired = true; onEnter(); } };
  if (typeof IntersectionObserver === 'undefined') { fire(); return () => {}; }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) { fire(); observer.disconnect(); }
  }, {threshold: 0.2});
  observer.observe(node);
  const fallback = window.setTimeout(() => { fire(); observer.disconnect(); }, 900);
  return () => { observer.disconnect(); window.clearTimeout(fallback); };
}

const format = (value: number, decimals: number) => value.toLocaleString('en-IN', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});

/**
 * A number that counts up to itself. The rendered text is always the true value; the count is
 * painted over it frame by frame and ends by restoring that same text.
 */
export function CountUp({value, decimals = 0, prefix = '', suffix = '', duration = 1100}: {value: number; decimals?: number; prefix?: string; suffix?: string; duration?: number}) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = `${prefix}${format(value, decimals)}${suffix}`;
  useEffect(() => {
    const node = ref.current;
    if (!node || !motionAllowed() || value === 0) return;
    if (revealedEarly() && node.getBoundingClientRect().top < window.innerHeight) return;
    let frame = 0;
    const stop = watchFirstSight(node, () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        node.textContent = `${prefix}${format(value * (1 - Math.pow(1 - t, 3)), decimals)}${suffix}`;
        if (t < 1 && document.visibilityState === 'visible') frame = requestAnimationFrame(tick);
        else node.textContent = final;
      };
      frame = requestAnimationFrame(tick);
    });
    return () => { stop(); cancelAnimationFrame(frame); node.textContent = final; };
  }, [value, decimals, prefix, suffix, duration, final]);
  return <span className="count-up" aria-label={final}><span ref={ref} aria-hidden="true">{final}</span></span>;
}

/** A block that settles into place the first time it is seen. Without motion it is simply there. */
export function Reveal({as: Tag = 'div', className = '', delay = 0, style, children, ...rest}: {as?: ElementType; className?: string; delay?: number; style?: CSSProperties; children?: ReactNode} & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<'rest' | 'armed' | 'in'>('rest');
  useEffect(() => {
    const node = ref.current;
    if (!node || !motionAllowed()) return;
    let frame = 0;
    const stop = watchFirstSight(node, () => {
      setPhase('armed');
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setPhase('in')); });
    });
    return () => { stop(); cancelAnimationFrame(frame); };
  }, []);
  return <Tag ref={ref} className={`reveal reveal-${phase} ${className}`.trim()} style={{...style, '--reveal-delay': `${delay}ms`} as CSSProperties} {...rest}>{children}</Tag>;
}

/** Adds `motion-on` to the element once, so CSS entrance motion runs only where it is allowed. */
export function useMotionClass<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (motionAllowed()) ref.current?.classList.add('motion-on');
  }, []);
  return ref;
}

/**
 * Plays a chart's entrance the first time it is seen, and again whenever `replayKey` changes
 * (a filter or category), so the marks that answer the new question arrive visibly. The class
 * is removed once the entrance is over, so selection and hover never restart it.
 */
export function useChartEntrance<T extends HTMLElement>(replayKey: string, duration = 1500) {
  const ref = useRef<T>(null);
  const seen = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !motionAllowed()) return;
    let timer = 0;
    const play = () => {
      node.classList.remove('is-entering');
      void node.getBoundingClientRect();
      node.classList.add('is-entering');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => node.classList.remove('is-entering'), duration);
    };
    if (seen.current) { play(); return () => window.clearTimeout(timer); }
    const stop = watchFirstSight(node, () => { seen.current = true; play(); });
    return () => { stop(); window.clearTimeout(timer); };
  }, [replayKey, duration]);
  return ref;
}

const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
const FIGURE = /^(\D*?)([+\-−]?)(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\D.*|)$/;

/** Splits "63.7%", "−1.29", "13,14,813" or "7 ULBs" into parts a count can rebuild; null when it is not one figure. */
export function parseFigure(text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 26 || MONTH.test(trimmed)) return null;
  const match = FIGURE.exec(trimmed);
  if (!match) return null;
  const [, prefix, sign, digits, suffix] = match;
  const value = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(value) || value === 0) return null;
  if (!prefix && !suffix && /^(19|20)\d\d$/.test(digits)) return null;
  const decimals = digits.includes('.') ? digits.split('.')[1].length : 0;
  const grouped = digits.includes(',');
  return {
    value,
    render: (current: number) => `${prefix}${sign}${grouped ? current.toLocaleString('en-IN', {minimumFractionDigits: decimals, maximumFractionDigits: decimals}) : current.toFixed(decimals)}${suffix}`,
  };
}

/** Counts a text-only element up to its own figure, and gives way if React changes the text meanwhile. */
function countElement(node: HTMLElement, duration = 1000) {
  const finalText = node.textContent ?? '';
  const figure = parseFigure(finalText);
  if (!figure) return;
  const start = performance.now();
  let written = figure.render(0);
  node.textContent = written;
  const tick = (now: number) => {
    if (node.textContent !== written) return;
    const t = Math.min(1, (now - start) / duration);
    written = t < 1 ? figure.render(figure.value * (1 - Math.pow(1 - t, 3))) : finalText;
    node.textContent = written;
    if (t < 1 && document.visibilityState === 'visible') requestAnimationFrame(tick);
    else node.textContent = finalText;
  };
  requestAnimationFrame(tick);
}

const EASE = 'cubic-bezier(.2, .8, .2, 1)';
const BAR_TAGS = 'i[style*="width"], em[style*="width"], b[style*="width"], span[style*="width"], i[style*="height"], em[style*="height"], b[style*="height"]';
const MAP_PATHS = '.district-map-stage path, .or-map path, .presenter-map-district';
/** Sections and the cards inside them. Nested targets cascade: a section settles, then its cards. */
const REVEAL = 'section, article, .panel, .atlas-tiles > div, .usr-category, .mini-kpi, .metric-card, .atlas-dossier, .atlas-table-wrap, [class$="-card"], [class*="-card "]';
const LINE_PATHS = 'path.pr-line, polyline[class*="line"], path[class*="-line"]:not([class*="reference"]):not([class*="grid"])';

/** Position among similar marks in the same list or chart, so a list fills top to bottom. */
function orderIn(node: Element, selector: string) {
  const group = node.closest('ul, ol, tbody, svg, section, article') ?? node.parentElement;
  if (!group) return 0;
  return Math.min(14, [...group.querySelectorAll(selector)].indexOf(node));
}

/** A thin fill inside a wider track: the shape every bar in this app takes. */
function isBar(node: HTMLElement) {
  if (node.closest('.reveal, [data-still]')) return false;
  const box = node.getBoundingClientRect(), track = node.parentElement?.getBoundingClientRect();
  if (!track || box.width === 0 || box.height === 0) return false;
  const vertical = /height/.test(node.getAttribute('style') ?? '') && !/width/.test(node.getAttribute('style') ?? '');
  return vertical ? box.width <= 40 && track.height >= box.height : box.height <= 28 && track.width >= box.width;
}

function play(node: Element, kind: 'bar' | 'column' | 'map' | 'line', order: number) {
  const delay = order * (kind === 'map' ? 22 : 45);
  if (kind === 'bar') node.animate([{transform: 'scaleX(0)', transformOrigin: 'left center'}, {transform: 'scaleX(1)', transformOrigin: 'left center'}], {duration: 900, delay, easing: EASE});
  else if (kind === 'column') node.animate([{transform: 'scaleY(0)', transformOrigin: 'center bottom'}, {transform: 'scaleY(1)', transformOrigin: 'center bottom'}], {duration: 900, delay, easing: EASE});
  else if (kind === 'map') node.animate([{opacity: 0}, {opacity: 1}], {duration: 650, delay, easing: 'ease-out'});
  else {
    const path = node as SVGGeometryElement;
    const length = typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0;
    if (length > 0) path.animate([{strokeDasharray: `${length}`, strokeDashoffset: `${length}`}, {strokeDasharray: `${length}`, strokeDashoffset: '0'}], {duration: 1300, easing: EASE});
  }
}

/**
 * Screen-level motion for any page, including content that appears later (a new tab, a new
 * measure). Each element moves once, the first time it is seen:
 *  - sections below the fold settle in;
 *  - headline figures (text only, 18px and larger) count up to themselves;
 *  - bars fill from zero along their own axis, a list from top to bottom;
 *  - district maps land district by district, and line charts draw themselves in.
 * The motion runs through the Web Animations API or a class that is removed afterwards, so the
 * element always rests in its true, server-rendered state.
 */
export function useScreenMotion(rootId: string, key: string) {
  // Layout effect: cards are armed before the first paint of the screen, so nothing is shown and then hidden.
  useLayoutEffect(() => {
    const root = document.getElementById(rootId);
    if (!key || !root || !motionAllowed() || typeof IntersectionObserver === 'undefined') return;
    const seen = new WeakSet<Element>();
    const timers: number[] = [];
    const kinds = new WeakMap<Element, 'section' | 'figure' | 'bar' | 'column' | 'map' | 'line'>();
    const observer = new IntersectionObserver((entries) => {
      let revealed = 0;
      for (const entry of [...entries].sort((a, b) => (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))) {
        if (!entry.isIntersecting) continue;
        const node = entry.target as HTMLElement;
        observer.unobserve(node);
        const kind = kinds.get(node);
        if (kind === 'section') {
          const stagger = Math.min(6, revealed++) * 70;
          node.style.setProperty('--reveal-stagger', `${stagger}ms`);
          node.classList.replace('screen-reveal-armed', 'screen-reveal-in');
          timers.push(window.setTimeout(() => { node.classList.remove('screen-reveal-in'); node.style.removeProperty('--reveal-stagger'); }, 900 + stagger));
        } else if (kind === 'figure') countElement(node);
        else if (kind === 'map') node.querySelectorAll(MAP_PATHS).forEach((path, index) => play(path, 'map', Math.min(30, index)));
        else if (kind) play(node, kind, kind === 'line' ? 0 : orderIn(node, BAR_TAGS));
      }
    }, {threshold: 0, rootMargin: '0px 0px -8% 0px'});
    const watch = (node: Element, kind: 'section' | 'figure' | 'bar' | 'column' | 'map' | 'line') => {
      if (seen.has(node)) return;
      seen.add(node);
      kinds.set(node, kind);
      observer.observe(node);
    };
    const scan = (first: boolean) => {
      // On load every card is armed and then revealed in order; content that arrives later (a new
      // tab) is armed only below the fold, so nothing already on screen disappears and returns.
      const fold = window.innerHeight;
      root.querySelectorAll<HTMLElement>(REVEAL).forEach((node) => {
        if (seen.has(node) || node.closest('svg, table, .reveal, [data-still]')) return;
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0 || (!first && box.top < fold)) return;
        node.classList.add('screen-reveal-armed');
        watch(node, 'section');
      });
      // Only the initial scan of an early-revealed page skips what is already on screen; content that
      // arrives later (a new tab, a new measure) still moves.
      const unseen = (node: Element) => !initialEarly || node.getBoundingClientRect().top >= fold;
      root.querySelectorAll<HTMLElement>('strong, .or-hero-value').forEach((node) => {
        if (unseen(node) && !seen.has(node) && node.childElementCount === 0 && !node.closest('.count-up, [data-still]') && parseFloat(getComputedStyle(node).fontSize) >= 18 && parseFigure(node.textContent ?? '')) watch(node, 'figure');
      });
      root.querySelectorAll<HTMLElement>(BAR_TAGS).forEach((node) => {
        if (unseen(node) && !seen.has(node) && isBar(node)) watch(node, /height/.test(node.getAttribute('style') ?? '') && !/width/.test(node.getAttribute('style') ?? '') ? 'column' : 'bar');
      });
      root.querySelectorAll('.district-map-stage svg, .or-map svg, svg:has(.presenter-map-district)').forEach((svg) => { if (unseen(svg) && svg.querySelector(MAP_PATHS)) watch(svg, 'map'); });
      root.querySelectorAll(LINE_PATHS).forEach((path) => { if (unseen(path)) watch(path, 'line'); });
    };
    let pending = 0;
    const mutations = new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => scan(false), 140);
    });
    // A page shown before hydration has already been seen: nothing on screen is hidden and
    // replayed; only what is below the fold waits for its first sight.
    let initialEarly = revealedEarly();
    scan(!initialEarly);
    initialEarly = false;
    mutations.observe(root, {childList: true, subtree: true});
    const frame = 0;
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(pending);
      mutations.disconnect();
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      root.querySelectorAll('.screen-reveal-armed, .screen-reveal-in').forEach((node) => node.classList.remove('screen-reveal-armed', 'screen-reveal-in'));
    };
  }, [rootId, key]);
}

/**
 * A pill that slides to whichever tab is selected, so a change of tab reads as movement from
 * one place to the next. Put `<i className="tab-indicator" aria-hidden="true" />` inside the
 * tab list and attach the returned ref to it; the selected tab is the one with aria-selected.
 */
export function useTabIndicator<T extends HTMLElement>(activeKey: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const place = () => {
      const active = node.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active || active.offsetWidth === 0) { node.classList.remove('has-indicator'); return; }
      node.style.setProperty('--ti-x', `${active.offsetLeft}px`);
      node.style.setProperty('--ti-y', `${active.offsetTop}px`);
      node.style.setProperty('--ti-w', `${active.offsetWidth}px`);
      node.style.setProperty('--ti-h', `${active.offsetHeight}px`);
      node.classList.add('has-indicator');
    };
    place();
    const ready = requestAnimationFrame(() => node.classList.add('indicator-ready'));
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    observer?.observe(node);
    return () => { cancelAnimationFrame(ready); observer?.disconnect(); };
  }, [activeKey]);
  return ref;
}

/**
 * Phone header that steps out of the way: it slides up while the reader scrolls down and comes
 * back as soon as they scroll up, so content gets the whole screen and navigation is one flick
 * away. Only below the phone breakpoint; desktop keeps its fixed sidebar.
 */
export function useAutoHideHeader(shellRef: React.RefObject<HTMLElement | null>, breakpoint = 760) {
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const phone = window.matchMedia(`(max-width: ${breakpoint}px)`);
    let last = window.scrollY, frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (!phone.matches || y < 90) shell.classList.remove('header-hidden');
      else if (y > last + 6) shell.classList.add('header-hidden');
      else if (y < last - 6) shell.classList.remove('header-hidden');
      last = y;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, {passive: true});
    // The active page's tab is brought into view in the swipeable nav row.
    if (phone.matches) shell.querySelector<HTMLElement>('.sidebar nav a.active')?.scrollIntoView?.({block: 'nearest', inline: 'center'});
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); shell.classList.remove('header-hidden'); };
  }, [shellRef, breakpoint]);
}
