'use client';

import Image from 'next/image';
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { DataMode, GapAssessment, GapState, MetricRow } from '@/lib/domain';
import { createProvider, datasets, diagnosticsKeyFor, reasonLabels, stateLabels } from '@/lib/domain';
import type { Coverage } from '@/lib/coverage';
import { getNamedFindings } from '@/lib/findings';
import { coverageNote, coverageRatio, coverageTier, formatCoverage, notReturned } from '@/lib/coverage';
import {
  getCollectionProcurementSummary,
  getCommunityProgrammeHistory,
  getDataQualityIssues,
  getDatasetPeriodAvailability,
  getDatasetUsageAudit,
  getDistrictCollectionAssetSummary,
  getEntityEvidenceBreadth,
  getEntityCoverageMatrix,
  getEvidenceCoverageGrid,
  getFacilityStatusReviewQueue,
  getReviewInbox,
  readTriage,
  serverTriage,
  subscribeTriage,
  writeTriage,
  type InboxItem,
  type TriageState,
  getIHHLFunnel,
  getLegacyWasteSummary,
  getProcessingRegistry,
  getSourceReconciliationIssues,
  getSupportingProgrammePortfolio,
  getSwachhOutcomeSummary,
  type CoverageState,
  getDisputedValues,
  getClearanceRankContrast,
  getDistrictCoverage,
} from '@/lib/analytics';
import { disputedSumImpact } from '@/lib/disputes';
import type { CollectionProcurementSummary, ContrastPoint, IhhlFunnel, LegacyWasteSummary } from '@/lib/analytics';
import { governedSnapshotStats, operationalPeriodOptions } from '@/lib/snapshots';
import { readinessCatalogueStats } from '@/lib/catalogue';
import { distributionOf, ordinal, peerContext, type Distribution } from '@/lib/comparison';
import { datasetVintages, formatPeriodLabel, formatRetrievalDate, vintageSummary } from '@/lib/vintage';
import {
  anchorByDistrict,
  approvedAliases,
  sameDistrict,
  crosswalkQueue,
  crosswalkStats,
  readDecisions,
  parseDecisionArtifact,
  serializeDecisions,
  serverDecisions,
  subscribeDecisions,
  writeDecisions,
  type Decision,
  type ImportOutcome,
  type DecisionState,
  type ProposalTier,
  type QueueItem,
} from '@/lib/crosswalk';
import { glossaryCategories, glossaryEntries } from '@/lib/glossary';

type Page = 'overview' | 'operational-analytics' | 'gap-radar' | 'diagnostics' | 'data-readiness';
type ColorTheme = 'light' | 'dark';
type AnalyticsTab = 'collection' | 'sanitation' | 'processing' | 'outcomes';

const navItems: { page: Page; label: string; href: string; icon: IconName }[] = [
  { page: 'overview', label: 'Overview', href: '/', icon: 'home' },
  { page: 'operational-analytics', label: 'Operational Analytics', href: '/operational-analytics', icon: 'chart' },
  { page: 'gap-radar', label: 'Gap Radar', href: '/gap-radar', icon: 'target' },
  { page: 'diagnostics', label: 'ULB Diagnostics', href: '/diagnostics/demo-delta', icon: 'building' },
  { page: 'data-readiness', label: 'Data Readiness', href: '/data-readiness', icon: 'database' },
];

const glossaryLookup = new Map(
  glossaryEntries.flatMap((entry) => [entry.term, ...(entry.aliases ?? [])].map((term) => [term.toLowerCase(), entry] as const)),
);
const glossaryMatcher = new RegExp(
  `(?<![A-Za-z0-9])(${[...glossaryLookup.keys()].sort((a, b) => b.length - a.length).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z0-9])`,
  'gi',
);

function GlossaryText({ text }: { text: string }) {
  return <>{text.split(glossaryMatcher).map((part, index) => {
    const entry = glossaryLookup.get(part.toLowerCase());
    if (!entry) return part;
    return <abbr key={`${part}-${index}`} className="glossary-term" title={`${entry.term}: ${entry.definition}`} aria-description={entry.definition} tabIndex={0}>{part}</abbr>;
  })}</>;
}

type IconName = 'home' | 'chart' | 'target' | 'building' | 'database' | 'shield' | 'search' | 'calendar' | 'link' | 'info' | 'check' | 'alert' | 'clock' | 'arrow' | 'moon' | 'sun';

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>
      {name === 'home' && <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>}
      {name === 'chart' && <><path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M3 20h18"/></>}
      {name === 'target' && <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12 21 3M16 3h5v5"/></>}
      {name === 'building' && <><path d="M4 21h16M6 21V8l6-4 6 4v13"/><path d="M9 11h1m4 0h1m-6 4h1m4 0h1m-4 6v-3h2v3"/></>}
      {name === 'database' && <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>}
      {name === 'shield' && <><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>}
      {name === 'search' && <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>}
      {name === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></>}
      {name === 'link' && <><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/></>}
      {name === 'info' && <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>}
      {name === 'check' && <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>}
      {name === 'alert' && <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5m0 3h.01"/></>}
      {name === 'clock' && <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
      {name === 'arrow' && <><path d="M5 12h14m-5-5 5 5-5 5"/></>}
      {name === 'moon' && <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>}
      {name === 'sun' && <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>}
    </svg>
  );
}

/**
 * The SAMPLE mode runs on real, authenticated government data (retained Data Lake
 * snapshots), so it is presented as "Governed data" and its URL reads ?mode=governed —
 * "sample" wrongly implied mock/example figures in a link people would share. The
 * internal enum stays SAMPLE to avoid churning keys, tests and the crosswalk seed.
 */
const MODE_URL: Record<DataMode, string> = { DEMO: 'demo', SAMPLE: 'governed', LIVE: 'live' };
const MODE_LABEL: Record<DataMode, string> = { DEMO: 'Demo', SAMPLE: 'Governed data', LIVE: 'Live' };

/** Resolve a URL mode value to the enum. Legacy 'sample' still maps to SAMPLE so any
 *  already-shared ?mode=sample link keeps working. */
function modeFromUrl(value: string | null | undefined): DataMode | null {
  switch ((value ?? '').toLowerCase()) {
    case 'governed':
    case 'sample':
      return 'SAMPLE';
    case 'live':
      return 'LIVE';
    case 'demo':
      return 'DEMO';
    default:
      return null;
  }
}

function withMode(href: string, mode: DataMode, colorTheme: ColorTheme = 'light') {
  const params = new URLSearchParams({ mode: MODE_URL[mode] });
  if (colorTheme === 'dark') params.set('theme', 'dark');
  return `${href}?${params.toString()}`;
}

export function LabApp({ page, initialUlbKey, initialMode = 'DEMO', initialColorTheme = 'light', initialAnalyticsTab = 'collection' }: { page: Page; initialUlbKey?: string; initialMode?: DataMode; initialColorTheme?: ColorTheme; initialAnalyticsTab?: AnalyticsTab }) {
  const [mode, setMode] = useState<DataMode>(initialMode);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(initialColorTheme);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Set when a reviewer arrived from a table row, so the page can offer a way back.
  const cameFrom = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('from'),
    () => null,
  );
  const provider = useMemo(() => createProvider(mode), [mode]);

  // Static hosting carries no server, so the initial HTML is always the default
  // (DEMO · light). On mount, resolve the real mode and theme from the URL — an
  // explicit ?mode / ?theme wins, otherwise the ULB key prefix on a diagnostics
  // deep link implies the mode. This keeps every existing deep link working.
  useEffect(() => {
    // A one-time sync of client-only state from the URL on mount. Deliberately not a
    // lazy initialiser: the server/prerender render has no window and must produce the
    // default, so reading the URL during render would mismatch hydration. Setting it
    // here after mount is the hydration-safe pattern, and runs once.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const params = new URLSearchParams(window.location.search);
      const urlMode = modeFromUrl(params.get('mode'));
      if (urlMode) setMode(urlMode);
      else if (initialUlbKey?.startsWith('sample-')) setMode('SAMPLE');
      else if (initialUlbKey?.startsWith('live-')) setMode('LIVE');
      if (params.get('theme') === 'dark') setColorTheme('dark');
    } catch {
      // A malformed URL should never take the app down; defaults stay in place.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialUlbKey]);

  function changeMode(next: DataMode) {
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set('mode', MODE_URL[next]);
    window.history.replaceState({}, '', url);
  }

  function toggleColorTheme() {
    setColorTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      try {
        const url = new URL(window.location.href);
        if (next === 'dark') url.searchParams.set('theme', 'dark');
        else url.searchParams.delete('theme');
        window.history.replaceState({}, '', url);
      } catch {
        // Theme persistence is optional; keep the current session functional.
      }
      return next;
    });
  }

  const diagnosticDefault = mode === 'SAMPLE' ? 'sample-narsipatnam' : mode === 'LIVE' ? 'live-pending' : 'demo-delta';
  const currentUlbKey = initialUlbKey && datasets[mode].diagnostics.some((item) => item.ulbKey === initialUlbKey) ? initialUlbKey : diagnosticDefault;

  return (
    <div className={`app-shell theme-${colorTheme}`} suppressHydrationWarning>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Sidebar page={page} mode={mode} colorTheme={colorTheme} diagnosticKey={diagnosticDefault} />
      <div className="app-main">
        <Header mode={mode} onModeChange={changeMode} colorTheme={colorTheme} onThemeToggle={toggleColorTheme} onAbout={() => setAboutOpen(true)} aboutOpen={aboutOpen} />
        <main id="main-content" className={`content page-${page}`}>
          {page === 'overview' && <Overview mode={mode} colorTheme={colorTheme} metrics={provider.getOverview()} radar={provider.getGapAssessments()} />}
          {page === 'operational-analytics' && <OperationalAnalytics mode={mode} initialTab={initialAnalyticsTab} />}
          {page === 'gap-radar' && <GapRadar mode={mode} colorTheme={colorTheme} radar={provider.getGapAssessments()} />}
          {page === 'diagnostics' && <Diagnostics mode={mode} colorTheme={colorTheme} cameFrom={cameFrom} diagnostic={provider.getDiagnostic(currentUlbKey)} allKeys={datasets[mode].diagnostics.map((d) => ({ key: d.ulbKey, name: mode === 'SAMPLE' ? `${d.name} — ${d.district}` : d.name }))} />}
          {page === 'data-readiness' && <DataReadiness mode={mode} readiness={provider.getReadiness()} />}
        </main>
        <ProductFooter mode={mode}/>
      </div>
      <AboutPanel open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}

function ProductFooter({ mode }: { mode: DataMode }) {
  return <footer className="product-footer" aria-label="SASA Intelligence Lab product statement"><div className="footer-brand"><Image src="/assets/sasa/brand-primary.png" alt="" width={44} height={42}/><span><b><GlossaryText text="SASA Intelligence Lab"/></b><small>Governed evidence into explainable review signals</small></span></div><div className="footer-principles"><span><Icon name="database" size={16}/>Source-backed</span><span><Icon name="shield" size={16}/>Evidence-gated</span><span><Icon name="search" size={16}/>Review-oriented</span></div><span className={`footer-mode footer-${mode.toLowerCase()}`}>{MODE_LABEL[mode]} · {mode === 'SAMPLE' ? 'retained governed evidence' : mode === 'DEMO' ? 'synthetic capability story' : 'on-demand connector · on the roadmap'}</span></footer>;
}

function Sidebar({ page, mode, colorTheme, diagnosticKey }: { page: Page; mode: DataMode; colorTheme: ColorTheme; diagnosticKey: string }) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <a className="brand" href={withMode('/', mode, colorTheme)} aria-label="SASA Intelligence Lab overview">
        <Image src="/assets/sasa/brand-primary.png" alt="" width={165} height={160} priority />
        <span><b>SASA</b><small>Intelligence Lab</small></span>
      </a>
      <nav>
        {navItems.map((item) => {
          const href = item.page === 'diagnostics' ? `/diagnostics/${diagnosticKey}` : item.href;
          return <a key={item.page} className={page === item.page ? 'active' : ''} href={withMode(href, mode, colorTheme)} aria-label={item.label} aria-current={page === item.page ? 'page' : undefined}><Icon name={item.icon}/><span><GlossaryText text={item.label}/></span></a>;
        })}
      </nav>
      <div className="sidebar-art"><Image src="/assets/sasa/hero-collection.png" alt="Illustration of a sanitation collection vehicle" width={353} height={128} /></div>
      <div className="profile"><span className="avatar">AP</span><span><b>Prototype review</b><small>Evidence-first mode</small></span></div>
    </aside>
  );
}

function Header({ mode, onModeChange, colorTheme, onThemeToggle, onAbout, aboutOpen }: { mode: DataMode; onModeChange: (mode: DataMode) => void; colorTheme: 'light' | 'dark'; onThemeToggle: () => void; onAbout: () => void; aboutOpen: boolean }) {
  return (
    <header className="topbar">
      <div className="header-brand"><b><GlossaryText text="SASA Intelligence Lab"/></b><span className="lab-tag"><span>◇</span> Decision-intelligence concept</span><span className={`mode-disclosure mode-${mode.toLowerCase()}`} role="status"><Icon name="shield" size={17}/>{datasets[mode].banner}</span></div>
      <div className="header-actions">
        <label className="mode-control"><span className="sr-only">Data mode</span><select aria-label="Data mode" value={mode} onChange={(event) => onModeChange(event.target.value as DataMode)}><option value="DEMO">{MODE_LABEL.DEMO}</option><option value="SAMPLE">{MODE_LABEL.SAMPLE}</option><option value="LIVE">{MODE_LABEL.LIVE}</option></select></label>
        <button className="icon-button theme-button" aria-label={colorTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} aria-pressed={colorTheme === 'dark'} onClick={onThemeToggle}><Icon name={colorTheme === 'dark' ? 'sun' : 'moon'} size={19}/></button>
        <button className="icon-button" aria-label="About SASA Intelligence Lab and glossary" aria-haspopup="dialog" aria-expanded={aboutOpen} onClick={onAbout}><Icon name="info" size={20}/></button>
        <span className="header-avatar">AP</span>
      </div>
    </header>
  );
}

function AboutPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return <div className="about-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="about-panel" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <header>
        <div className="about-mark"><Image src="/assets/sasa/ai-radar.png" alt="" width={62} height={62}/></div>
        <div><span className="eyebrow">About this prototype</span><h2 id="about-title"><GlossaryText text="SASA Intelligence Lab"/></h2><p>Turns governed sanitation evidence into a small number of review signals, then preserves the source context behind every interpretation.</p></div>
        <button className="about-close" onClick={onClose} aria-label="Close About panel">×</button>
      </header>
      <div className="about-principles" aria-label="Product interpretation principles">
        <article><Icon name="database" size={20}/><div><b>Source-backed</b><small>Values trace to authenticated retained snapshots.</small></div></article>
        <article><Icon name="shield" size={20}/><div><b>Evidence-gated</b><small><GlossaryText text="Not enough evidence means exactly that. It is not a judgement about performance."/></small></div></article>
        <article><Icon name="search" size={20}/><div><b>Review-oriented</b><small>No causal, predictive, or utilization claims without supporting fields.</small></div></article>
      </div>
      <div className="about-glossary-head"><div><span className="eyebrow">Plain-language glossary</span><h3>Abbreviations and evidence terms</h3></div><span>Hover underlined terms anywhere in the interface for the same definitions.</span></div>
      <div className="about-glossary">
        {[0, 1].map((column) => <div className="about-glossary-column" key={column}>{glossaryCategories.filter((_, index) => index % 2 === column).map((category) => <section key={category}><h4>{category}</h4><dl>{glossaryEntries.filter((entry) => entry.category === category).map((entry) => <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.definition}</dd></div>)}</dl></section>)}</div>)}
      </div>
      <footer><span><Icon name="info" size={16}/>This glossary is maintained with every newly activated dataset or API.</span><b>Authenticated JSON is the canonical SAMPLE evidence</b></footer>
    </section>
  </div>;
}

function PageIntro({ eyebrow, title, description, visual, art, children }: { eyebrow?: string; title: string; description: string; visual: Page; art?: string; children?: React.ReactNode }) {
  const resolvedArt = art ?? (visual === 'overview' ? '/assets/sasa/hero-swachh.png' : visual === 'operational-analytics' ? '/assets/sasa/hero-collection.png' : visual === 'gap-radar' ? '/assets/sasa/ai-radar.png' : visual === 'diagnostics' ? '/assets/sasa/hero-collection.png' : '/assets/sasa/hero-iswm.png');
  return <div className={`page-intro intro-${visual}`}><div>{eyebrow && <span className="eyebrow"><GlossaryText text={eyebrow}/></span>}<h1><GlossaryText text={title}/></h1><p><GlossaryText text={description}/></p></div>{children && <div className="intro-context">{children}</div>}<Image className="intro-art" src={resolvedArt} alt="" width={353} height={128} /><span className="intro-circuit" aria-hidden="true" /><Image className="circuit" src="/assets/sasa/circuit-lines.png" alt="" width={195} height={108} /></div>;
}

function StatusPill({ state, compact = false }: { state: GapState; compact?: boolean }) {
  const icon: IconName = state === 'DOING_WELL' ? 'check' : state === 'UNSCORED' ? 'clock' : 'target';
  return <span className={`status-pill status-${state.toLowerCase()} ${compact ? 'compact' : ''}`}><Icon name={icon} size={compact ? 14 : 16}/><GlossaryText text={stateLabels[state]}/></span>;
}

/**
 * The denominator that travels with a rate. Rendered wherever a metric carries
 * coverage, so a reader never sees a percentage without knowing how many
 * entities stood behind it and how many stayed silent.
 */
function CoverageLine({ coverage }: { coverage: Coverage }) {
  const ratio = coverageRatio(coverage);
  const filled = ratio === null ? 0 : Math.round(ratio * 1000) / 10;
  // The meter is S1 and S2 in one mark: the solid part is what reported, and the
  // remainder carries the house absence hatch rather than empty track, so the
  // shortfall is visible rather than merely stated.
  return (
    <span className={`coverage-line tier-${coverageTier(coverage)}`} title={coverage.basis}>
      <span className="coverage-head">
        <b>{formatCoverage(coverage)}</b>
        <i className="coverage-meter" aria-hidden="true"><span style={{ width: `${filled}%` }}/></i>
      </span>
      <em>{coverageNote(coverage)}</em>
    </span>
  );
}

function MetricCard({ metric, icon }: { metric: MetricRow; icon?: string }) {
  return <article className={`metric-card tone-${metric.tone}`}>{icon && <div className="domain-icon"><Image src={icon} alt="" width={125} height={115} /></div>}<div><span><GlossaryText text={metric.label}/></span><strong><GlossaryText text={metric.value}/></strong>{metric.coverage && <CoverageLine coverage={metric.coverage}/>}<small><GlossaryText text={metric.detail}/></small></div></article>;
}

const domainIcons = ['/assets/sasa/domain-eauto.png', '/assets/sasa/domain-iswm.png', '/assets/sasa/domain-ihhl.png', '/assets/sasa/domain-swachh.png'];

function Overview({ mode, colorTheme, metrics, radar }: { mode: DataMode; colorTheme: ColorTheme; metrics: MetricRow[]; radar: GapAssessment[] }) {
  if (mode === 'SAMPLE') return <SampleOverview colorTheme={colorTheme}/>;
  const counts = radar.reduce<Record<GapState, number>>((acc, item) => ({ ...acc, [item.state]: acc[item.state] + 1 }), { DOING_WELL: 0, LEARN_FROM: 0, INFRASTRUCTURE_GAP: 0, INVESTIGATE: 0, UNSCORED: 0 });
  return <>
    <PageIntro visual="overview" eyebrow="Executive snapshot" title="What SASA data can tell us today" description="Review current operational evidence now, then activate higher-order intelligence only when its evidence gates are met."><span className="catalogue-context"><Icon name="database" size={15}/>{mode === 'SAMPLE' ? `29 complete governed full exports · ${governedSnapshotStats.records.toLocaleString('en-IN')} rows · 30 authorized endpoints` : 'Evidence-gated sanitation intelligence'}</span></PageIntro>
    <section className="metric-grid" aria-label="Core KPI categories">{metrics.map((metric, index) => <MetricCard key={metric.label} metric={metric} icon={domainIcons[index]} />)}</section>
    <section className="overview-grid">
      <article className="panel pulse-panel">
        <PanelTitle icon="chart" title={mode === 'SAMPLE' ? 'Operational Snapshot' : 'Operational Pulse'} subtitle={mode === 'DEMO' ? 'Illustrative fixture trend' : mode === 'SAMPLE' ? 'Current retained evidence · not a trend' : 'Waiting for governed source access'} />
        {mode === 'DEMO' ? <PulseChart /> : <EmptyChart mode={mode} />}
      </article>
      <article className="panel gap-summary">
        <PanelTitle icon="target" title="Performance Gap Summary" subtitle={mode === 'DEMO' ? 'Synthetic fixture distribution' : 'Current scoring eligibility'} />
        <div className="summary-list">{(['INVESTIGATE', 'DOING_WELL', 'LEARN_FROM', 'INFRASTRUCTURE_GAP', 'UNSCORED'] as GapState[]).map((state) => <div key={state}><StatusPill state={state} compact/><strong>{counts[state]}</strong></div>)}</div>
        <a className="text-link" href={withMode('/gap-radar', mode, colorTheme)}>View gap radar <Icon name="arrow" size={16}/></a>
      </article>
      <article className="panel why-panel">
        <PanelTitle icon="shield" title="Why this matters" />
        <WhyItem icon="target" title="Spot mismatches" text="Compare reported implementation with aligned outcomes." />
        <WhyItem icon="search" title="Explain evidence" text="Trace every displayed value to its source context." />
        <WhyItem icon="shield" title="Activate carefully" text="Score only when identity, periods, and values qualify." />
      </article>
    </section>
    <section className="integration-strip"><WhyItem icon="database" title="Governed connector" text="Reserved server-side boundary"/><WhyItem icon="shield" title="Audit-ready evidence" text="Raw fields and formulas visible"/><WhyItem icon="link" title="Reviewed crosswalk" text="No silent fuzzy joins"/><WhyItem icon="check" title="Data quality first" text="Missing evidence stays unscored"/></section>
    <EvidenceLabel mode={mode}/>
  </>;
}

function UnscoredReasons({ radar, href }: { radar: GapAssessment[]; href: string }) {
  const counts = new Map<string, number>();
  radar.forEach((item) => (item.reasons ?? []).forEach((reason) => counts.set(reason, (counts.get(reason) ?? 0) + 1)));
  const ranked = [...counts.entries()].sort(([, left], [, right]) => right - left);
  const total = radar.length;
  return <>
    <div className="unscored-headline"><strong>{total}</strong><span>entities, none scoreable yet</span></div>
    <ul className="unscored-reasons">{ranked.map(([reason, count]) => <li key={reason}>
      <span className="ur-label">{reasonLabels[reason as keyof typeof reasonLabels] ?? reason}</span>
      <span className="ur-bar"><i style={{ width: `${Math.max(3, count / total * 100)}%` }}/></span>
      <b>{count}</b>
    </li>)}</ul>
    <p className="unscored-note">An entity can be blocked by more than one condition, so these do not sum to {total}.</p>
    <a className="text-link" href={href}>View gap radar <Icon name="arrow" size={16}/></a>
  </>;
}

/**
 * S6, the evidence label. Fixed slots, same order on every screen, generated
 * from the retained snapshots rather than written by hand.
 *
 * The datasheet idea is well established on paper and almost never rendered into
 * the interface where the numbers are actually read. The last three rows are the
 * ones that stop a figure being misquoted, so they are always shown even when
 * the answer is an uncomfortable "no".
 */
function EvidenceLabel({ mode = 'SAMPLE' }: { mode?: DataMode }) {
  // Only SAMPLE rests on retained government evidence. Saying nothing on the
  // other modes would be worse than saying what they actually are.
  if (mode === 'DEMO') {
    return <section className="evidence-label" aria-label="Evidence label for this screen">
      <header><span className="eyebrow">Evidence label</span><b>What this screen rests on</b></header>
      <dl>
        <div className="el-stop"><dt>Source</dt><dd>Synthetic fixtures</dd></div>
        <div><dt>Entities</dt><dd>6 demo ULBs</dd></div>
        <div className="el-stop"><dt>Safe to quote</dt><dd>No · illustrative only</dd></div>
        <div className="el-stop"><dt>Scoring eligible</dt><dd>Not applicable</dd></div>
      </dl>
    </section>;
  }
  if (mode === 'LIVE') {
    return <section className="evidence-label" aria-label="Evidence label for this screen">
      <header><span className="eyebrow">Evidence label</span><b>What this screen rests on</b></header>
      <dl>
        <div className="el-stop"><dt>Source</dt><dd>No connector request made</dd></div>
        <div className="el-stop"><dt>Rows retained</dt><dd>0</dd></div>
        <div className="el-stop"><dt>Safe to quote</dt><dd>No · access pending</dd></div>
        <div className="el-stop"><dt>Scoring eligible</dt><dd>Not applicable</dd></div>
      </dl>
    </section>;
  }
  const disputed = getDisputedValues();
  const rows: Array<{ label: string; value: string; state?: 'ok' | 'warn' | 'stop' }> = [
    { label: 'Datasets retained', value: `${governedSnapshotStats.completeDatasets} / ${governedSnapshotStats.authorizedDatasets} authorized`, state: 'warn' },
    { label: 'Rows retained', value: governedSnapshotStats.records.toLocaleString('en-IN') },
    { label: 'Entities observed', value: `${governedSnapshotStats.baselineUlbCandidates} ULB candidates` },
    { label: 'Source grain', value: 'Mixed · ULB and district' },
    { label: 'Disputed values', value: `${disputed.total} across ${disputed.datasets} datasets`, state: disputed.total ? 'stop' : 'ok' },
    { label: 'Zero separable from blank', value: 'No', state: 'stop' },
    { label: 'Safe to compare across months', value: 'No · single-period snapshots', state: 'stop' },
    { label: 'Scoring eligible', value: '0 entities · gates unmet', state: 'warn' },
  ];
  return <section className="evidence-label" aria-label="Evidence label for this screen">
    <header><span className="eyebrow">Evidence label</span><b>What this screen rests on</b></header>
    <dl>{rows.map((row) => <div key={row.label} className={row.state ? `el-${row.state}` : undefined}>
      <dt>{row.label}</dt><dd>{row.value}</dd>
    </div>)}</dl>
  </section>;
}

/**
 * One pill per unmet evidence gate, read from the gate list rather than
 * hardcoded, so unblocking a gate is visible here instead of silently wrong.
 */
function GateDots() {
  const blocked = createProvider('SAMPLE').getReadiness().gates.filter((gate) => gate.state === 'blocked');
  return <div className="gate-dots" aria-label={`${blocked.length} unmet evidence gates`}>
    {blocked.map((gate) => <i key={gate.title} title={gate.title}/>)}
  </div>;
}

/**
 * Who is carrying the shortfall.
 *
 * Every other panel on this screen reports a statewide quantity. A statewide
 * quantity cannot be acted on: "0.2% completion" tells an officer that something
 * is wrong everywhere, which is the same as telling them nothing. The retained
 * rows are at ULB grain, so the product can name the places instead, and that is
 * the difference between a status report and a review list.
 *
 * The ranking basis is stated on the panel rather than assumed, because the two
 * are not interchangeable — one list is ordered by the size of the shortfall, the
 * other by the share of that ULB's own target still outstanding, and a reader who
 * mistakes the second for the first will draw the wrong conclusion about scale.
 */
function NamedFindings({ colorTheme }: { colorTheme: ColorTheme }) {
  const findings = useMemo(() => getNamedFindings(), []);
  const [activeId, setActiveId] = useState(findings[0]?.id ?? '');
  const active = findings.find((finding) => finding.id === activeId) ?? findings[0];
  if (!active) return null;

  const peak = Math.max(...active.entities.map((entity) => entity.value), 1);
  const [amount, ...rest] = active.headline.split(' ');

  return <section className={`panel named-findings tone-${active.tone}`} aria-label="Where the shortfall sits">
    <header className="nf-head">
      <div>
        <span className="eyebrow">Where the shortfall sits</span>
        <h2>Named entities behind each current signal</h2>
      </div>
      <div className="nf-tabs" role="tablist" aria-label="Current shortfalls">
        {findings.map((finding) => <button key={finding.id} role="tab" type="button"
          aria-selected={finding.id === active.id}
          className={`nf-tab tone-${finding.tone} ${finding.id === active.id ? 'active' : ''}`}
          onClick={() => setActiveId(finding.id)}>
          <b>{finding.stalled}</b><span>{`ULB${finding.stalled === 1 ? '' : 's'} ${shortfallLabels[finding.id] ?? finding.unit}`}</span>
        </button>)}
      </div>
    </header>

    <div className="nf-body">
      <div className="nf-summary">
        <strong className="nf-total">{amount}</strong>
        <span className="nf-total-unit">{rest.join(' ')}</span>
        <p className="nf-statement">{active.statement}</p>
        <dl className="nf-facts">
          {active.concentration && <div><dt>Top {active.concentration.count} hold</dt><dd>{Math.round(active.concentration.share * 100)}% of the total</dd></div>}
          <div><dt>Returned a value</dt><dd>{formatCoverage(active.coverage)} {active.coverage.unit}</dd></div>
          <div><dt>Reported period</dt><dd>{active.period}</dd></div>
        </dl>
        <a className="primary-link" href={`${withMode('/operational-analytics', 'SAMPLE', colorTheme)}&tab=${active.tab}`}>
          See all {active.affected} <Icon name="arrow" size={15}/>
        </a>
      </div>

      <ol className="nf-list">
        {active.entities.map((entity, index) => <li key={`${entity.ulb}-${entity.district}`} className={entity.stalled ? 'is-stalled' : ''}>
          <span className="nf-rank">{index + 1}</span>
          <span className="nf-name"><b>{entity.ulb}</b><small>{entity.district}</small></span>
          <span className="nf-bar" aria-hidden="true"><i style={{ width: `${Math.max((entity.value / peak) * 100, 4)}%` }}/></span>
          <span className="nf-value">
            <b>{entity.display}</b>
            <small>{entity.detail}</small>
          </span>
          {entity.stalled
            ? <span className="nf-flag" title="This ULB reports no progress at all, not merely less than target">Not started</span>
            : entity.note
              ? <span className="nf-flag is-progress">{entity.note}</span>
              : <span className="nf-flag is-empty" aria-hidden="true"/>}
          <DrillLink ulb={entity.ulb} district={entity.district} from="Where the shortfall sits"/>
        </li>)}
      </ol>
    </div>

    <footer className="nf-foot">
      <span><Icon name="shield" size={15}/>
        Ranked by {active.rankedBy === 'volume' ? 'the size of the shortfall' : "the share of each ULB's own target still outstanding"}.
        Descriptive of what sources reported; not a score, and not a judgement of cause.
      </span>
      <b>ULBs that did not return a value are absent from this list, never ranked last</b>
    </footer>
  </section>;
}

/** Tab labels: what the count above each one is counting. Pluralised at render. */
const shortfallLabels: Record<string, string> = {
  'stalled-approvals': 'not started',
  'undelivered-orders': 'received none',
  'legacy-balance': 'cleared none',
};

function SampleOverview({ colorTheme }: { colorTheme: ColorTheme }) {
  const collection = getCollectionProcurementSummary();
  const ihhl = getIHHLFunnel();
  const processing = getProcessingRegistry();
  const legacyWaste = getLegacyWasteSummary();
  const outcomes = getSwachhOutcomeSummary();
  const analyticsHref = (tab: AnalyticsTab) => `${withMode('/operational-analytics', 'SAMPLE', colorTheme)}&tab=${tab}`;

  /**
   * The four domain cards, built from retained evidence rather than composites.
   *
   * DEMO shows four matching percentages because its fixtures are synthetic
   * readiness indices. SAMPLE cannot show four percentages without inventing
   * composites, which is precisely what the evidence gates exist to prevent, so
   * these carry the measured quantity instead. The ratios those quantities
   * produce stay on the gauges in the rail, which keeps the two complementary
   * rather than duplicated.
   */
  const domainCards: MetricRow[] = [
    {
      label: 'Collection & Machinery',
      value: `${collection.supplied.toLocaleString('en-IN')} supplied`,
      detail: `of ${collection.target.toLocaleString('en-IN')} reported target · ${collection.workOrders.toLocaleString('en-IN')} work orders issued`,
      tone: 'teal',
      coverage: collection.coverage,
    },
    {
      label: 'Processing & Facilities',
      value: `${processing.configuredTpd.toLocaleString('en-IN')} TPD`,
      detail: `configured across ${processing.facilityRecords} facility records · configured capacity, not treated volume`,
      tone: 'blue',
    },
    {
      label: 'Sanitation Delivery',
      value: `${ihhl.completed.toLocaleString('en-IN')} completed`,
      detail: `of ${ihhl.approved.toLocaleString('en-IN')} reported approvals · ${ihhl.underConstruction.toLocaleString('en-IN')} under construction`,
      tone: 'violet',
      coverage: ihhl.coverage,
    },
    {
      label: 'Swachh Outcomes',
      value: `${outcomes.rows.length} ULBs rated`,
      detail: `ODF ${outcomes.odfRecords} · GFC ${outcomes.gfcRecords} · rank ${outcomes.rankRecords}`,
      tone: 'orange',
      coverage: {
        reported: outcomes.rows.length,
        expected: 123,
        unit: 'ULBs',
        basis: `Source year ${outcomes.reportingYear}. Not comparable with 2026 operations.`,
      },
    },
  ];

  return <>
    <PageIntro visual="overview" eyebrow="Operational intelligence · current governed evidence" title="What needs attention?" description="Three source-backed signals show what stands out now, where officers should review, and what the evidence cannot yet establish."></PageIntro>
    <section className="metric-grid" aria-label="Core KPI categories">{domainCards.map((metric, index) => <MetricCard key={metric.label} metric={metric} icon={domainIcons[index]} />)}</section>
    <NamedFindings colorTheme={colorTheme}/>
    <DistrictEvidenceMap/>
    <section className="overview-intelligence-layout" aria-label="Current operational review signals">
      <article className="panel operational-signal-board">
        <header className="signal-board-head"><div><span className="eyebrow">Operational signal board</span><h2>Three review signals from current SASA evidence</h2><p>Each lane is descriptive, deterministic, and linked to its retained source records.</p></div><span className="signal-count"><b>03</b> signals</span></header>
        <div className="signal-lanes">
      <SignalRow tone="teal"
        gap={(collection.target - collection.supplied).toLocaleString('en-IN')}
        gapLabel="vehicles short of target"
        title="Reported vehicle delivery is substantially behind procurement target"
        stages={`${collection.target.toLocaleString('en-IN')} target → ${collection.workOrders.toLocaleString('en-IN')} work orders → ${collection.supplied.toLocaleString('en-IN')} supplied`}
        ratio={collection.deliveryRatio} ratioLabel="delivery ratio"
        href={analyticsHref('collection')}/>

      <SignalRow tone="violet"
        gap={Math.max(ihhl.approved - ihhl.completed, 0).toLocaleString('en-IN')}
        gapLabel="approvals not completed"
        title="Reported IHHL completion is very low relative to approvals"
        stages={`${ihhl.approved.toLocaleString('en-IN')} approved → ${ihhl.underConstruction.toLocaleString('en-IN')} under construction → ${ihhl.completed.toLocaleString('en-IN')} completed`}
        ratio={ihhl.completionRatio} ratioLabel="completion ratio"
        href={analyticsHref('sanitation')}/>

      <SignalRow tone="blue"
        gap={compactMetric(legacyWaste.balance)}
        gapLabel="reported balance remaining"
        title="Reported legacy-waste clearance is 91%; 1.35 million remains"
        stages={`${compactMetric(legacyWaste.target)} target → ${compactMetric(legacyWaste.achievement)} reported cleared`}
        ratio={legacyWaste.clearanceRatio} ratioLabel="clearance ratio"
        href={analyticsHref('processing')}/>
        </div>
        <footer className="signal-board-foot"><span><Icon name="shield" size={16}/>Current evidence supports review signals—not a composite sanitation score.</span><b>{processing.configuredTpd.toLocaleString('en-IN')} TPD configured capacity is supporting context only</b></footer>
      </article>
      <aside className="overview-focus-rail">
        <SignalRatios collection={collection} ihhl={ihhl} legacy={legacyWaste} href={withMode('/operational-analytics', 'SAMPLE', colorTheme)}/>
        <article className="panel radar-activation-card radar-gate-spotlight"><span className="eyebrow">Next intelligence layer</span><b>Gap Radar: 0 eligible entities</b><p>Reviewed identity, aligned periods, current outcomes, and an approved scoring policy are still required.</p><GateDots/><a href={withMode('/gap-radar', 'SAMPLE', colorTheme)}>See evidence gates <Icon name="arrow" size={15}/></a></article>
      </aside>
    </section>
    <EvidenceCompleteness colorTheme={colorTheme}/>
    <ReportedOperationsMonitor series={getCommunityProgrammeHistory()}/>
    <section className="overview-grid sample-overview-grid">
      <article className="panel gap-summary">
        <PanelTitle icon="target" title="Performance Gap Summary" subtitle="Why nothing is scoreable yet"/>
        <UnscoredReasons radar={createProvider('SAMPLE').getGapAssessments()} href={withMode('/gap-radar', 'SAMPLE', colorTheme)}/>
      </article>
      <article className="panel why-panel">
        <PanelTitle icon="shield" title="Why this matters" />
        <WhyItem icon="target" title="Spot mismatches" text="Compare reported implementation with aligned outcomes." />
        <WhyItem icon="search" title="Explain evidence" text="Trace every displayed value to its source context." />
        <WhyItem icon="shield" title="Activate carefully" text="Score only when identity, periods, and values qualify." />
      </article>
    </section>
    <section className="overview-context-row">
      <article className="panel outcome-context-card"><span><Icon name="calendar" size={20}/></span><div><b>2024 Swachh outcomes are available as historical context.</b><p>{outcomes.odfRecords} ODF · {outcomes.rankRecords} rank · {outcomes.gfcRecords} GFC records. Not compared directly with 2026 operations.</p></div><a href={analyticsHref('outcomes')}>View 2024 outcomes <Icon name="arrow" size={15}/></a></article>
      <article className="panel processing-context-card"><Image src="/assets/sasa/domain-iswm.png" alt="" width={70} height={64}/><div><span className="eyebrow">Processing context</span><b>Infrastructure is documented; operational utilization is not.</b><p>{processing.configuredTpd.toLocaleString('en-IN')} configured TPD is available as inventory evidence.</p></div><a href={analyticsHref('processing')}>Explore infrastructure <Icon name="arrow" size={15}/></a></article>
    </section>
    <EvidenceLabel/>
  </>;
}

/**
 * How much of the possible evidence actually exists. This was buried in a Data Readiness
 * sub-tab, but it is the single most honest thing the product says, so it belongs where
 * everyone sees it.
 */
function EvidenceCompleteness({ colorTheme }: { colorTheme: ColorTheme }) {
  const decisions = useSyncExternalStore(subscribeDecisions, readDecisions, serverDecisions);
  const aliases = useMemo(() => approvedAliases(decisions), [decisions]);
  const grid = useMemo(() => getEvidenceCoverageGrid(aliases), [aliases]);
  const have = grid.totals.returned + grid.totals.flagged + grid.totals.recovered;
  const havePct = Math.round((have / grid.totals.cells) * 100);
  return <a className="completeness-strip" href={withMode('/data-readiness', 'SAMPLE', colorTheme)}>
    <span className="comp-figure"><b>{havePct}%</b><small>of the evidence we could have</small></span>
    <span className="comp-bar" role="img" aria-label={`${have} of ${grid.totals.cells} possible observations were returned`}>
      <i className="comp-have" style={{ width: `${havePct}%` }}/>
      <i className="comp-missing" style={{ width: `${100 - havePct}%` }}/>
    </span>
    <span className="comp-copy">
      <b>{grid.totals.cells.toLocaleString('en-IN')}</b> possible observations across {grid.rows.length} ULBs and {grid.sources.length} sources.
      <b> {grid.totals.absent.toLocaleString('en-IN')}</b> were never returned by any source.
      <em>A blank is not a zero. See the full picture in Data Readiness.</em>
    </span>
    <span className="comp-go"><Icon name="arrow" size={16}/></span>
  </a>;
}

/**
 * Copies a plain-text evidence summary for the entity on screen, with its provenance.
 * Nothing left the application before this, which quietly capped how useful it was:
 * an officer could read a finding but not take it into a meeting.
 */
function EvidencePack({ diagnostic }: { diagnostic: ReturnType<ReturnType<typeof createProvider>['getDiagnostic']> }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const lines = [
      `${diagnostic.name}, ${diagnostic.district}`,
      `Status: ${stateLabels[diagnostic.state]}`,
      diagnostic.reportingContext,
      diagnostic.summary,
      '',
      'Reported values',
      ...diagnostic.metrics.map((metric) => `  ${metric.label}: ${metric.value} (${metric.detail})`),
      '',
      'Quality conditions',
      ...(diagnostic.qualityFlags.length ? diagnostic.qualityFlags.map((flag) => `  - ${flag}`) : ['  none recorded']),
      '',
      `Copied from SASA Intelligence Lab on ${new Date().toLocaleString('en-IN')}.`,
      'Values are source-reported. Nothing here is a performance score.',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }
  return <button className="evidence-pack" onClick={copy}>
    <Icon name="database" size={15}/>{copied ? 'Copied' : 'Copy evidence summary'}
  </button>;
}

function ReportedOperationsMonitor({ series }: { series: ReturnType<typeof getCommunityProgrammeHistory> }) {
  const [active, setActive] = useState<string>('');
  const allValues = series.flatMap((item) => item.points.map((point) => point.coverage ?? 0));
  const ceiling = Math.max(Math.ceil(Math.max(...allValues, .01) * 100 / 5) * 5, 5);
  const width = 960;
  const height = 300;
  const left = 56;
  const right = 26;
  const top = 30;
  const bottom = 52;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const baseline = top + plotHeight;
  const months = series[0]?.points.map((point) => point.period.split(' ')[0]) ?? [];
  const tones = ['teal', 'blue', 'violet'];
  const conflictCount = series.reduce((total, item) => total + item.percentageConflicts, 0);

  const groupWidth = plotWidth / Math.max(months.length, 1);
  const barWidth = Math.min(26, (groupWidth * 0.62) / Math.max(series.length, 1));
  const groupInner = barWidth * series.length + 6 * (series.length - 1);
  const latestIndex = months.length - 1;

  return <article className="panel reported-operations-monitor">
    <header><PanelTitle icon="chart" title="Reported Operations Monitor" subtitle="Five retained reporting periods · one column per reported value · hover any column for its source figures"/><div className="monitor-state"><span className="live-dot"/>REAL RETAINED HISTORY</div></header>
    <div className="monitor-layout">
      <div className="history-chart-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Reported target coverage from March through July 2026 for three community programmes" onMouseLeave={() => setActive('')}>
          <defs>
            {[['teal', '#19c6bd', '#0d8f97'], ['blue', '#5aa2fb', '#2563eb'], ['violet', '#a78bfa', '#7136e8']].map(([tone, from, to]) => (
              <linearGradient key={tone} id={`bar-${tone}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={from}/><stop offset="1" stopColor={to}/>
              </linearGradient>
            ))}
          </defs>

          <rect className="latest-band" x={left + latestIndex * groupWidth + 3} y={top - 8} width={groupWidth - 6} height={plotHeight + 16} rx="12"/>

          {[0, .25, .5, .75, 1].map((fraction) => {
            const y = top + plotHeight * (1 - fraction);
            return <g key={fraction}>
              <line className="history-grid" x1={left} x2={width - right} y1={y} y2={y}/>
              <text className="history-axis" x={left - 14} y={y + 4} textAnchor="end">{Math.round(ceiling * fraction)}%</text>
            </g>;
          })}

          {months.map((month, index) => <text key={month} className={`history-axis month${index === latestIndex ? ' is-latest' : ''}`} x={left + index * groupWidth + groupWidth / 2} y={height - 18} textAnchor="middle">{month}</text>)}

          {months.map((_, periodIndex) => series.map((item, seriesIndex) => {
            const point = item.points[periodIndex];
            if (!point) return null;
            const value = point.coverage ?? 0;
            const barHeight = Math.max(3, (value * 100 / ceiling) * plotHeight);
            const x = left + periodIndex * groupWidth + (groupWidth - groupInner) / 2 + seriesIndex * (barWidth + 6);
            const y = baseline - barHeight;
            const key = `${item.tableKey}-${point.period}`;
            const label = `${item.label}: ${formatPercent(point.coverage)} in ${point.period} (${point.achievement.toLocaleString('en-IN')} of ${point.target.toLocaleString('en-IN')})`;
            return <g key={key} className={`bar-group bar-${tones[seriesIndex]}${active && active !== key ? ' is-dimmed' : ''}`} onMouseEnter={() => setActive(key)}>
              <rect className="bar-hit" x={x - 3} y={top} width={barWidth + 6} height={plotHeight} role="img" aria-label={label}/>
              <rect className="bar" x={x} y={y} width={barWidth} height={barHeight} rx={Math.min(5, barWidth / 2)} fill={`url(#bar-${tones[seriesIndex]})`}/>
              {active === key && <text className="bar-value" x={x + barWidth / 2} y={y - 8} textAnchor="middle">{formatPercent(point.coverage)}</text>}
            </g>;
          }))}

          <line className="history-baseline" x1={left} x2={width - right} y1={baseline} y2={baseline}/>
        </svg>
      </div>
      <aside className="history-track-list">{series.map((item, index) => { const latest = item.points[item.points.length - 1]; return <div className={`history-track track-${tones[index]}`} key={item.tableKey}><i/><span><b>{item.shortLabel}</b><small>{latest.achievement.toLocaleString('en-IN')} of {latest.target.toLocaleString('en-IN')} reported in July</small></span><strong>{formatPercent(latest.coverage)}</strong></div>; })}<div className="history-quality"><Icon name="alert" size={17}/><span><b>{conflictCount} row-period percentage conflicts</b><small>Each column is raw achievement ÷ target for that period; conflicting source percentage fields remain flagged.</small></span></div></aside>
    </div>
    <footer><span><Icon name="calendar" size={15}/>March–July 2026 reported period history</span><b>Not a composite score, trajectory, forecast, or cross-programme ranking.</b></footer>
  </article>;
}

/**
 * One line per signal, led by the figure that matters: the shortfall, not the ratio.
 * `gap` is the headline, `stages` shows the progression it came from, and the track
 * encodes the ratio so the row reads at a glance without needing to parse numbers.
 */
function SignalRow({ tone, gap, gapLabel, title, stages, ratio, ratioLabel, href }: {
  tone: string;
  gap: string;
  gapLabel: string;
  title: string;
  stages: string;
  ratio: number | null;
  ratioLabel: string;
  href: string;
}) {
  const fill = Math.max(0.6, Math.min(100, (ratio ?? 0) * 100));
  return <a className={`signal-row tone-${tone}`} href={href}>
    <span className="row-gap">
      <b>{gap}</b>
      <small>{gapLabel}</small>
    </span>
    <span className="row-main">
      <span className="row-title">{title}</span>
      <span className="row-stages">{stages}</span>
      <span className="row-track"><i style={{ width: `${fill}%` }}/></span>
    </span>
    <span className="row-ratio">
      <b>{formatPercent(ratio)}</b>
      <small>{ratioLabel}</small>
    </span>
    <span className="row-go" aria-hidden="true"><Icon name="arrow" size={15}/></span>
  </a>;
}

function SignalGauge({ value, label, denominator, tone, coverage }: { value: number | null; label: string; denominator: string; tone: string; coverage: Coverage }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, value ?? 0));
  // The gauge already names its quantity denominator. This adds the entity one:
  // a ratio built from 34 of 123 ULBs is a different claim from one built on all
  // of them, and the arc alone cannot tell them apart.
  const shortfall = notReturned(coverage);
  return <div className={`signal-gauge gauge-${tone}`}>
    <svg viewBox="0 0 64 64" role="img" aria-label={`${label} ${formatPercent(value)}, ${denominator}, from ${coverageNote(coverage)}`}>
      <circle className="gauge-track" cx="32" cy="32" r={radius}/>
      <circle className="gauge-arc" cx="32" cy="32" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)} transform="rotate(-90 32 32)"/>
      <text className="gauge-figure" x="32" y="36" textAnchor="middle">{formatPercent(value)}</text>
    </svg>
    <b>{label}</b>
    <small>{denominator}</small>
    <span className={`gauge-coverage tier-${coverageTier(coverage)}`} title={coverageNote(coverage)}>
      {formatCoverage(coverage)} {coverage.unit}{shortfall > 0 && <i className="gauge-absence" aria-hidden="true"/>}
    </span>
  </div>;
}

/** The three ratios live here and nowhere else, so the cards below can carry evidence instead. */
function SignalRatios({ collection, ihhl, legacy, href }: { collection: CollectionProcurementSummary; ihhl: IhhlFunnel; legacy: LegacyWasteSummary; href: string }) {
  return <article className="panel signal-ratios-card">
    <span className="eyebrow">Operational contrast</span>
    <b className="ratios-title">Three source ratios, measured separately</b>
    <div className="signal-gauges">
      <SignalGauge value={collection.deliveryRatio} coverage={collection.coverage} label="Collection supply" denominator="supplied / target" tone="teal"/>
      <SignalGauge value={ihhl.completionRatio} coverage={ihhl.coverage} label="IHHL completion" denominator="completed / approved" tone="blue"/>
      <SignalGauge value={legacy.clearanceRatio} coverage={legacy.coverage} label="Legacy clearance" denominator="cleared / target" tone="violet"/>
    </div>
    <p>Each has its own denominator and its own source. Shown side by side for contrast, never combined. The count under each is how many ULBs returned a value, against the 123 in the source registry.</p>
    <a href={href}>Open operational analytics <Icon name="arrow" size={15}/></a>
  </article>;
}

function PanelTitle({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  return <div className="panel-title"><span className="panel-icon"><Icon name={icon}/></span><div><h2><GlossaryText text={title}/></h2>{subtitle && <p><GlossaryText text={subtitle}/></p>}</div></div>;
}

function PulseChart() {
  return <div className="pulse-chart" aria-label="Synthetic operational pulse rising from 38 to 76"><svg viewBox="0 0 640 210" role="img"><title>Synthetic operational pulse trend</title><defs><linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6b45e8" stopOpacity=".23"/><stop offset="1" stopColor="#6b45e8" stopOpacity="0"/></linearGradient></defs><path className="gridline" d="M45 35H610M45 85H610M45 135H610M45 185H610"/><path className="fill" d="M45 166 112 154 180 135 247 126 315 110 382 104 450 75 518 65 585 43 585 185 45 185Z"/><path className="line" d="M45 166 112 154 180 135 247 126 315 110 382 104 450 75 518 65 585 43"/><g className="points"><circle cx="45" cy="166" r="4"/><circle cx="180" cy="135" r="4"/><circle cx="315" cy="110" r="4"/><circle cx="450" cy="75" r="4"/><circle cx="585" cy="43" r="5"/></g></svg><div className="chart-note"><strong>76%</strong><span>Illustrative fixture</span></div></div>;
}

function EmptyChart({ mode }: { mode: DataMode }) {
  return <div className="empty-chart"><span className="empty-icon"><Icon name={mode === 'LIVE' ? 'link' : 'clock'} size={30}/></span><strong>{mode === 'SAMPLE' ? 'Trend intentionally unavailable' : 'Live connector — on the roadmap'}</strong><p>{mode === 'SAMPLE' ? 'Complete current-period snapshots do not establish a verified multi-month trend.' : 'The planned next step: a on-demand authenticated pull from the AI Living Labs Data Lake. Governed data mode shows the same sources today, retained as snapshots.'}</p></div>;
}

function WhyItem({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return <div className="why-item"><span><Icon name={icon}/></span><div><strong><GlossaryText text={title}/></strong><small><GlossaryText text={text}/></small></div></div>;
}

const analyticsTabs: Array<{ id: AnalyticsTab; label: string }> = [
  { id: 'collection', label: 'Collection' },
  { id: 'sanitation', label: 'Sanitation Delivery' },
  { id: 'processing', label: 'Processing Infrastructure' },
  { id: 'outcomes', label: 'Swachh Outcomes' },
];

function formatPercent(value: number | null) {
  if (value === null) return 'Not computable';
  const percent = value * 100;
  return `${percent > 0 && percent < 10 ? percent.toFixed(1) : Math.round(percent)}%`;
}

function formatValue(value: number | null) {
  return value === null ? '—' : value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function compactNumber(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} million`;
  if (Math.abs(value) >= 100_000) return `${(value / 100_000).toFixed(2)} lakh`;
  return value.toLocaleString('en-IN');
}

function compactMetric(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return value.toLocaleString('en-IN');
}

function OperationalAnalytics({ mode, initialTab }: { mode: DataMode; initialTab: AnalyticsTab }) {
  const [tab, setTab] = useState<AnalyticsTab>(initialTab);
  // Static hosting: resolve ?tab on mount so the named-findings "See all" deep
  // links land on the right tab without a server to read the query.
  useEffect(() => {
    // One-time mount sync from the URL; hydration-safe for the same reason as the
    // mode/theme effect above, so the rule is disabled for this single assignment.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab === 'sanitation' || urlTab === 'processing' || urlTab === 'outcomes' || urlTab === 'collection') setTab(urlTab);
    } catch {
      // Fall back to the default tab.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  // `null` keeps the long-standing behaviour of using each dataset's own latest returned
  // period. Picking an explicit period pins every view to that month instead.
  const [period, setPeriod] = useState<string | null>(null);
  const tabArt = tab === 'sanitation' ? '/assets/sasa/hero-ihhl.png' : tab === 'processing' ? '/assets/sasa/hero-iswm.png' : tab === 'outcomes' ? '/assets/sasa/hero-swachh.png' : '/assets/sasa/hero-collection.png';
  return <>
    <PageIntro visual="operational-analytics" art={tabArt} eyebrow={tab === 'outcomes' && mode === 'SAMPLE' ? 'Source year 2024' : 'Available now'} title={tab === 'outcomes' && mode === 'SAMPLE' ? '2024 Swachh Outcomes' : 'Operational Analytics'} description={tab === 'outcomes' && mode === 'SAMPLE' ? 'Descriptive outcome evidence, intentionally separated from 2026 operational snapshots.' : 'Source-backed operational views from retained governed responses, with grain, periods, and quality conditions kept visible.'}><span className="catalogue-context"><Icon name="shield" size={15}/>{mode === 'SAMPLE' ? 'Authenticated snapshot analytics · scoring remains gated' : mode === 'DEMO' ? 'Synthetic story mode' : 'No live request is made'}</span></PageIntro>
    <div className="analytics-tabs" role="tablist" aria-label="Operational analytics domains">{analyticsTabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); const url = new URL(window.location.href); url.searchParams.set('tab', item.id); window.history.replaceState({}, '', url); }}>{item.label}{item.id === 'outcomes' && mode === 'SAMPLE' ? ' (2024)' : ''}</button>)}</div>
    {mode === 'SAMPLE' && <PeriodScrubber period={period} onChange={setPeriod}/>}
    {mode === 'SAMPLE' && <ReportedPeriods tab={tab}/>} 
    {mode === 'SAMPLE' && <AnalyticsInsightBrief tab={tab} period={period}/>} 
    {mode !== 'SAMPLE' ? <ModeAnalyticsPlaceholder mode={mode} tab={tab}/> : <>
      {tab === 'collection' && <CollectionAnalytics period={period}/>}
      {tab === 'sanitation' && <SanitationAnalytics period={period}/>}
      {tab === 'processing' && <ProcessingAnalytics period={period}/>}
      {tab === 'outcomes' && <OutcomeAnalytics/>}
    </>}
    <EvidenceLabel mode={mode}/>
  </>;
}

function PeriodScrubber({ period, onChange }: { period: string | null; onChange: (value: string | null) => void }) {
  const options = useMemo(() => operationalPeriodOptions(), []);
  const selected = options.find((option) => option.id === period);
  // A single control rather than a row of buttons: most reviewers never change this, and
  // it should not compete with the finding underneath it.
  return <div className="period-picker">
    <label>
      <Icon name="calendar" size={15}/>
      <span>Reported period</span>
      <select value={period ?? ''} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">Latest per dataset</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.datasets} sources</option>)}
      </select>
    </label>
    <p>{selected
      ? <>Pinned to <b>{selected.label}</b>. {selected.datasets} of {governedSnapshotStats.retrievedDatasets} datasets reported this month; the rest show nothing rather than an older figure.</>
      : <>Each panel is showing its own dataset&rsquo;s latest month, so the months may differ between panels.</>}</p>
  </div>;
}

function ReportedPeriods({ tab }: { tab: AnalyticsTab }) {
  if (tab === 'outcomes') return null;
  const match = tab === 'collection' ? /e-auto service model/i : tab === 'sanitation' ? /ihhl/i : tab === 'processing' ? /iswm|fstp|cbg|c&d|plastic waste/i : /odf|gfc|national rank/i;
  const matched = getDatasetPeriodAvailability().filter((row) => row.retrieved && match.test(row.dataset));
  const periods = [...new Set(matched.map((row) => row.period).filter(Boolean))];
  if (periods.length < 2) return null;
  const compact = matched.filter((row) => row.months.length > 1).slice(0, 3).map((row) => {
    const label = /ISWM/i.test(row.dataset) ? 'ISWM'
      : /FSTP/i.test(row.dataset) ? 'FSTP'
        : /plastic waste/i.test(row.dataset) ? 'Plastic waste'
          : /C&D/i.test(row.dataset) ? 'C&D'
            : row.dataset.split(/[—-]/)[0].trim();
    return `${label}: ${row.period}`;
  });
  if (compact.length === 0) return null;
  return <div className="reported-periods"><Icon name="calendar" size={14}/><span>Reporting periods available</span><b>{compact.join(' · ')}</b><small>Reported period history—not a trend.</small></div>;
}

function ModeAnalyticsPlaceholder({ mode, tab }: { mode: DataMode; tab: AnalyticsTab }) {
  const label = analyticsTabs.find((item) => item.id === tab)?.label;
  if (mode === 'LIVE') return <article className="panel analytics-placeholder"><Icon name="link" size={34}/><h2>Live connector — on the roadmap</h2><p>The planned on-demand authenticated pull is not yet enabled. Switch to Governed data to work with the same sources today, retained as snapshots.</p></article>;
  const demoValues = tab === 'collection' ? ['1,200 target', '720 work orders', '510 supplied']
    : tab === 'sanitation' ? ['4,900 identified', '3,200 approved', '1,440 completed']
      : tab === 'processing' ? ['24 facility fixtures', '310 TPD configured', '4 review flags']
        : ['88 ODF fixtures', '12 GFC fixtures', '76 rank fixtures'];
  return <article className="panel analytics-placeholder"><span className="eyebrow">Synthetic fixture</span><h2>{label}</h2><div className="placeholder-values">{demoValues.map((value) => <b key={value}>{value}</b>)}</div><p>Illustrative values demonstrate the interaction only and are isolated from authenticated SAMPLE evidence.</p></article>;
}

function AnalyticsInsightBrief({ tab, period }: { tab: AnalyticsTab; period: string | null }) {
  const collection = getCollectionProcurementSummary(period);
  const sanitation = getIHHLFunnel(period);
  const processing = getProcessingRegistry(period);
  const outcomes = getSwachhOutcomeSummary();
  const content = tab === 'collection' ? {
    headline: 'Reported delivery is far behind procurement intent',
    evidence: `${collection.target.toLocaleString('en-IN')} target → ${collection.workOrders.toLocaleString('en-IN')} work orders → ${collection.supplied.toLocaleString('en-IN')} supplied`,
    meaning: `Work orders cover ${formatPercent(collection.workOrderRatio)} of target, while reported supply covers ${formatPercent(collection.deliveryRatio)}.`,
    review: 'Validate pending supply and inspect the ULB candidates with the largest reported delivery gaps.',
    limit: 'This measures procurement and delivery status—not fleet utilization or service quality.',
  } : tab === 'sanitation' ? {
    headline: 'Approvals are not converting into reported completions',
    evidence: `${sanitation.approved.toLocaleString('en-IN')} approved → ${sanitation.underConstruction.toLocaleString('en-IN')} under construction → ${sanitation.completed.toLocaleString('en-IN')} completed`,
    meaning: `The reported completion ratio is ${formatPercent(sanitation.completionRatio)}; ${sanitation.zeroApprovalRows} latest-period rows have zero approvals.`,
    review: 'Check whether completion reporting is incomplete and review where open approvals are concentrated.',
    limit: 'The records show a conversion gap; they do not identify its cause or prescribe an intervention.',
  } : tab === 'processing' ? {
    headline: 'Legacy-waste balance and facility-status exceptions are ready for review',
    evidence: `${formatPercent(getLegacyWasteSummary().clearanceRatio)} reported legacy-waste clearance · ${compactNumber(getLegacyWasteSummary().balance)} source-reported balance`,
    meaning: `The evidence supports a clearance-and-balance view plus a ${processing.configuredTpd.toLocaleString('en-IN')} configured TPD inventory.`,
    review: `${getFacilityStatusReviewQueue().length} ISWM source-status exceptions and ${processing.periodConflicts} FSTP period conflicts require review.`,
    limit: 'Reported clearance and configured capacity are not throughput, uptime, utilization, or verified environmental impact.',
  } : {
    headline: '2024 outcomes are a historical baseline—not current performance',
    evidence: `${outcomes.odfRecords} ODF records · ${outcomes.rankRecords} rank records · only ${outcomes.gfcRecords} GFC records`,
    meaning: 'ODF and rank distributions can be described, but GFC coverage is too limited for a broad outcome view.',
    review: 'Improve outcome coverage and obtain same-year operational and outcome evidence.',
    limit: 'These outcomes cannot be attributed to, or compared directly with, 2026 operations.',
  };
  return <article className={`panel insight-brief insight-${tab}`}>
    <div className="insight-lead"><span className="eyebrow">Headline finding</span><h2>{content.headline}</h2></div>
    <div className="insight-grid"><InsightCell icon="database" label="Evidence" text={content.evidence}/><InsightCell icon="search" label="Why it matters" text={content.meaning}/><InsightCell icon="target" label="Where to review" text={content.review}/><InsightCell icon="shield" label="What this does not mean" text={content.limit}/></div>
  </article>;
}

function InsightCell({ icon, label, text }: { icon: IconName; label: string; text: string }) {
  return <div className="insight-cell"><span><Icon name={icon} size={17}/></span><div><b>{label}</b><p>{text}</p></div></div>;
}

function CollectionAnalytics({ period }: { period: string | null }) {
  const [view, setView] = useState<'procurement' | 'district-assets'>('procurement');
  const data = getCollectionProcurementSummary(period);
  // Peers are the ULBs that reported a comparable ratio in the same period from this source.
  const deliveryPeers = useMemo(() => distributionOf(data.rows.map((row) => row.deliveryRatio)), [data]);
  const districtAssets = getDistrictCollectionAssetSummary();
  const topRows = [...data.rows].sort((a, b) => (b.deliveryGap ?? -1) - (a.deliveryGap ?? -1)).slice(0, 5);
  return <section className="analytics-view collection-view">
    <InternalViewSwitch label="Collection evidence view" value={view} onChange={setView} items={[['procurement', 'ULB procurement'], ['district-assets', 'District collection assets']]}/>
    {view === 'procurement' ? <>
      <article className="panel analytical-hero funnel-panel primary-visual conversion-hero"><PanelTitle icon="chart" title="Collection procurement funnel" subtitle="E-Auto Service Model · ULB grain · latest period July 2026 from 166-row full export"/><ConversionJourney stages={[["Target", data.target, "teal"], ["Work orders issued", data.workOrders, "blue"], ["Vehicles supplied", data.supplied, "violet"]]}/><div className="funnel-foot"><span>Across returned ULB records</span><b>Reported gap: {data.deliveryGap.toLocaleString('en-IN')} vehicles</b></div></article>
      <div className="analytics-kpis"><MiniKpi icon="chart" label="Delivery ratio" value={formatPercent(data.deliveryRatio)} detail="supplied / target" tone="teal" coverage={data.coverage}/><MiniKpi icon="database" label="Work-order ratio" value={formatPercent(data.workOrderRatio)} detail="work orders / target" tone="blue" coverage={data.coverage}/><MiniKpi icon="alert" label="Reported shortfall" value={data.deliveryGap.toLocaleString('en-IN')} detail="target minus supplied" tone="violet"/></div>
      <CollectionSourceContrast procurement={data} districts={districtAssets}/>
      <article className="panel analytics-table-panel primary-review-table"><PanelTitle icon="target" title="Where to review" subtitle="Largest deterministic reported delivery gaps · not a performance score"/><div className="table-scroll"><table><thead><tr><th>ULB / District</th><th>Target</th><th>Work orders</th><th>Supplied</th><th>Delivery ratio</th><th>Against peers</th><th>Reported gap</th><th></th></tr></thead><tbody>{topRows.map((row) => <tr key={`${row.district}-${row.ulb}`}><td><b>{row.ulb}</b><small className="cell-sub">{row.district}</small></td><td>{formatValue(row.target)}</td><td>{formatValue(row.workOrders)}</td><td>{formatValue(row.supplied)}</td><td><RatioBar value={row.deliveryRatio}/></td><td><PeerStrip value={row.deliveryRatio} distribution={deliveryPeers}/></td><td><b className="gap-value">{formatValue(row.deliveryGap)}</b></td><td><DrillLink ulb={row.ulb ?? ''} district={row.district} from="Collection"/></td></tr>)}</tbody></table></div></article>
      <MeaningFooter>Measures procurement and reported delivery, not fleet utilization. Null or zero targets remain “Not computable.”</MeaningFooter>
    </> : <DistrictCollectionAssets data={districtAssets}/>} 
  </section>;
}

function CollectionSourceContrast({ procurement, districts }: { procurement: ReturnType<typeof getCollectionProcurementSummary>; districts: ReturnType<typeof getDistrictCollectionAssetSummary> }) {
  return <article className="panel source-contrast-flow">
    <header><PanelTitle icon="link" title="Source Contrast" subtitle="Two governed collection stories · preserved at their original grain"/><ReviewChip tone="review" label="Definition review"/></header>
    <div className="contrast-lanes">
      <section className="contrast-lane procurement-lane"><div className="lane-label"><span>ULB GRAIN</span><b>E-Auto procurement</b><small>Target → work orders → reported supply</small></div><div className="stream stages"><span style={{ '--stream-width': '100%' } as React.CSSProperties}><b>{procurement.target.toLocaleString('en-IN')}</b><small>target</small></span><i/><span style={{ '--stream-width': `${(procurement.workOrderRatio ?? 0)*100}%` } as React.CSSProperties}><b>{procurement.workOrders.toLocaleString('en-IN')}</b><small>work orders</small></span><i/><span style={{ '--stream-width': `${Math.max((procurement.deliveryRatio ?? 0)*100,5)}%` } as React.CSSProperties}><b>{procurement.supplied.toLocaleString('en-IN')}</b><small>supplied</small></span></div></section>
      <div className="contrast-divider"><span><Icon name="alert" size={18}/></span><b>Do not merge</b><small>Different grain and apparently different source definitions</small></div>
      <section className="contrast-lane district-lane"><div className="lane-label"><span>DISTRICT GRAIN</span><b>Collection asset programmes</b><small>Latest source-reported target and achievement</small></div><div className="district-streams">{districts.assets.map((asset) => <div key={asset.tableKey}><span><b>{asset.asset}</b><small>{asset.districts} districts</small></span><i><em style={{ width: `${Math.min(100,(asset.achievementRatio ?? 0)*100)}%` }}/></i><strong>{formatPercent(asset.achievementRatio)}</strong></div>)}</div></section>
    </div>
    <footer><Icon name="shield" size={15}/>The contrast is the intelligence: both sources are retained, neither overrides the other, and neither measures utilization.</footer>
  </article>;
}

function DistrictCollectionAssets({ data }: { data: ReturnType<typeof getDistrictCollectionAssetSummary> }) {
  return <>
    <article className="panel district-assets-hero primary-visual">
      <div><span className="eyebrow">Separate district-grain source</span><h2>Three collection asset programmes report target achievement in full.</h2><p>These are source-reported district measures. They are not merged with the ULB procurement funnel because definitions and grain differ.</p></div>
      <div className="asset-programme-grid">{data.assets.map((asset) => <article key={asset.asset}><span>{asset.asset}</span><strong>{asset.achievement.toLocaleString('en-IN')} <small>/ {asset.target.toLocaleString('en-IN')}</small></strong><RatioBar value={asset.achievementRatio}/><small>{asset.districts} district rows · {asset.returnedPeriods.join(' · ')}</small></article>)}</div>
    </article>
    <div className="analytics-kpis"><MiniKpi icon="building" label="District programmes" value="3" detail={`${data.period} latest evidence`} tone="teal"/><MiniKpi icon="database" label="Compactors reported" value={data.compactors.toLocaleString('en-IN')} detail="ULB-grain inventory" tone="blue"/><MiniKpi icon="chart" label="Sweeping machines" value={data.sweepingMachines.toLocaleString('en-IN')} detail={`${data.sweepingAmbiguities} ambiguous entity-period cases`} tone="violet"/></div>
    <article className="panel source-reconciliation-callout"><span><Icon name="link" size={23}/></span><div><small>Where to review</small><h3>Resolve the source-definition difference before comparison.</h3><p>District collection sources report target achievement, while the separate ULB E-Auto procurement source reports {formatPercent(getCollectionProcurementSummary().deliveryRatio)} supplied against target. Both are retained; neither overrides the other.</p></div><ReviewChip tone="review" label="Definition review"/></article>
    <article className="panel analytics-table-panel primary-review-table"><PanelTitle icon="database" title="Returned district programme evidence" subtitle="Latest governed period · one compact source summary"/><div className="table-scroll"><table><thead><tr><th>Programme</th><th>Grain</th><th>District rows</th><th>Target</th><th>Achievement</th><th>Reported coverage</th><th>Period history</th></tr></thead><tbody>{data.assets.map((asset) => <tr key={asset.tableKey}><td><b>{asset.asset}</b></td><td><ReadinessBadge value="District"/></td><td>{asset.districts}</td><td>{asset.target.toLocaleString('en-IN')}</td><td>{asset.achievement.toLocaleString('en-IN')}</td><td><RatioBar value={asset.achievementRatio}/></td><td>{asset.returnedPeriods.join(' · ')} <small className="cell-sub">{asset.unchangedAcrossReturnedPeriods} unchanged candidates</small></td></tr>)}</tbody></table></div></article>
    <MeaningFooter>District achievement, ULB procurement, and reported inventory are distinct measures. None shows whether an asset is operational or utilized.</MeaningFooter>
  </>;
}

function InternalViewSwitch<T extends string>({ label, value, items, onChange }: { label: string; value: T; items: Array<[T, string]>; onChange: (value: T) => void }) {
  return <div className="internal-view-switch" aria-label={label}>{items.map(([id, text]) => <button key={id} type="button" className={value === id ? 'active' : ''} aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>)}</div>;
}

function SanitationAnalytics({ period }: { period: string | null }) {
  const data = getIHHLFunnel(period);
  const completionPeers = useMemo(() => distributionOf(data.rows.map((row) => row.completionRatio)), [data]);
  const topRows = [...data.rows].sort((a, b) => (b.openApprovals ?? -1) - (a.openApprovals ?? -1)).slice(0, 5);
  return <section className="analytics-view sanitation-view">
    <article className="panel analytical-hero funnel-panel primary-visual conversion-hero sanitation-conversion"><PanelTitle icon="chart" title="IHHL delivery funnel" subtitle="Four-stage sanitation pipeline · exact duplicates excluded and retained as quality evidence"/><ConversionJourney stages={[["Identified", data.identified, "teal"], ["Approved", data.approved, "blue"], ["Under construction", data.underConstruction, "violet"], ["Completed", data.completed, "teal"]]}/></article>
    <div className="analytics-kpis"><MiniKpi icon="check" label="Completion ratio" value={formatPercent(data.completionRatio)} detail="completed / approved" tone="teal" coverage={data.coverage}/><MiniKpi icon="target" label="Identified coverage" value={formatPercent(data.identifiedCoverage)} detail="completed / identified" tone="blue" coverage={data.coverage}/><MiniKpi icon="clock" label="Open approvals" value={data.openApprovals.toLocaleString('en-IN')} detail="approved minus completed" tone="violet"/></div>
    <article className="panel pipeline-dropoff-compact"><PanelTitle icon="chart" title="Pipeline drop-off" subtitle="Reported reduction from each previous stage"/><PipelineDropoff values={[['Identified', data.identified], ['Approved', data.approved], ['Under construction', data.underConstruction], ['Completed', data.completed]]}/></article>
    <article className="panel analytics-table-panel primary-review-table"><PanelTitle icon="target" title="Where to review" subtitle="Largest approval-to-completion reported gaps · flag rule: open approvals ≥ 100"/><div className="table-scroll"><table><thead><tr><th>ULB / District</th><th>Approved</th><th>Under construction</th><th>Completed</th><th>Completion ratio</th><th>Against peers</th><th>Open approvals</th><th></th></tr></thead><tbody>{topRows.map((row) => <tr key={`${row.district}-${row.ulb}`}><td><b>{row.ulb}</b><small className="cell-sub">{row.district}</small></td><td>{formatValue(row.approved)}</td><td>{formatValue(row.underConstruction)}</td><td>{formatValue(row.completed)}</td><td><RatioBar value={row.completionRatio}/></td><td><PeerStrip value={row.completionRatio} distribution={completionPeers}/></td><td><b className="gap-value">{formatValue(row.openApprovals)}</b></td><td><DrillLink ulb={row.ulb} district={row.district} from="Sanitation delivery"/></td></tr>)}</tbody></table></div></article>
    <MeaningFooter>This is a reporting and delivery conversion signal; it does not establish why completion is low.</MeaningFooter>
  </section>;
}

function ProcessingAnalytics({ period }: { period: string | null }) {
  const [view, setView] = useState<'legacy' | 'facilities'>('legacy');
  const data = getProcessingRegistry(period);
  const legacy = getLegacyWasteSummary(period);
  const statusQueue = getFacilityStatusReviewQueue();
  const statusQueueKeys = new Set(statusQueue.map((row) => `${row.tableKey}|${row.district}|${row.ulb}|${row.sourceStatus}`));
  const rows = view === 'facilities' ? [...statusQueue, ...data.rows.filter((row) => !statusQueueKeys.has(`${row.tableKey}|${row.district}|${row.ulb}|${row.sourceStatus}`))].slice(0, 10) : [];
  const capacityByType = Object.entries(data.rows.filter((row) => row.unit === 'TPD' && row.configuredCapacity !== null).reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.facilityType]: (acc[row.facilityType] ?? 0) + (row.configuredCapacity ?? 0) }), {})).map(([label, value]) => ({ label, value }));
  const statusDistribution = Object.entries(data.rows.reduce<Record<string, number>>((acc, row) => { const status = row.sourceStatus || 'Not reported'; return { ...acc, [status]: (acc[status] ?? 0) + 1 }; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));
  return <section className="analytics-view processing-view">
    <InternalViewSwitch label="Processing evidence view" value={view} onChange={setView} items={[["legacy", "Legacy waste"], ["facilities", "Facility registry"]]}/>
    {view === 'legacy' ? <LegacyWasteAnalytics data={legacy}/> : <>
      <div className="analytics-kpis four processing-kpis"><MiniKpi icon="chart" label="Configured TPD capacity" value={`${data.configuredTpd.toLocaleString('en-IN')} TPD`} detail="ISWM + CBG + C&D" tone="teal"/><MiniKpi icon="database" label="FSTP KLD capacity" value={`${data.configuredKld.toLocaleString('en-IN')} KLD`} detail="configured, not treated" tone="blue"/><MiniKpi icon="building" label="Facility records" value={String(data.facilityRecords)} detail="five retained source types" tone="violet"/><MiniKpi icon="alert" label="Status review queue" value={String(statusQueue.length)} detail="exact ISWM source statuses" tone="orange"/></div>
      <div className="processing-visuals"><article className="panel"><PanelTitle icon="chart" title="Configured capacity by facility type" subtitle="TPD only · KLD remains separate"/><HorizontalBarChart items={capacityByType} unit="TPD"/></article><article className="panel"><PanelTitle icon="database" title="Source status distribution" subtitle="Exact status categories returned by the source"/><HorizontalBarChart items={statusDistribution}/></article></div>
      <article className="panel status-review-banner"><span><Icon name="alert" size={21}/></span><div><small>Where to review</small><b>{statusQueue.length} ISWM records carry source-status exceptions.</b><p>Site Not Available, Not Commenced, Local Issue, and Approach Road are shown exactly as returned—not inferred causes.</p></div></article>
      <article className="panel analytics-table-panel facility-registry primary-review-table"><PanelTitle icon="database" title="Facility registry" subtitle="Review-queue records first · configured capacity and exact source status"/><div className="table-scroll"><table><thead><tr><th>Location</th><th>Type</th><th>Configured capacity</th><th>Source status</th><th>Period</th><th>Grain</th><th>Quality flag</th></tr></thead><tbody>{rows.map((row, index) => { const flagged = row.periodConflict || row.splitCheck === 'conflict' || statusQueueKeys.has(`${row.tableKey}|${row.district}|${row.ulb}|${row.sourceStatus}`); return <tr key={`${row.tableKey}-${row.district}-${row.ulb}-${index}`}><td><b>{row.ulb ?? row.district}</b><small className="cell-sub">{row.ulb ? row.district : 'District record'}</small></td><td><ReadinessBadge value={row.facilityType}/></td><td>{formatValue(row.configuredCapacity)} {row.configuredCapacity === null ? '' : row.unit}</td><td><span className="raw-status" title={row.sourceStatus}>{row.sourceStatus || 'Not reported'}</span></td><td>{row.periodConflict ? <span className="conflict-text">7 / JUNE conflict</span> : row.period}</td><td><ReadinessBadge value={row.grain}/></td><td><ReadinessBadge value={flagged ? 'Review' : 'No issue'}/></td></tr>; })}</tbody></table></div></article>
      <MeaningFooter>Configured capacity is not actual throughput or utilization. TPD and KLD remain separate; source period conflicts are not corrected.</MeaningFooter>
    </>}
  </section>;
}

function LegacyWasteAnalytics({ data }: { data: ReturnType<typeof getLegacyWasteSummary> }) {
  const clearancePeers = useMemo(() => distributionOf(data.rows.map((row) => row.clearanceRatio)), [data]);
  const reviewRows = [...data.rows].filter((row) => (row.balance ?? 0) > 0).sort((left, right) => (right.balance ?? 0) - (left.balance ?? 0)).slice(0, 8);
  return <>
    <div className="legacy-visual-grid"><article className="panel legacy-hero primary-visual">
      <div className="legacy-head"><div><span className="eyebrow">What stands out · {data.period}</span><h2>{formatPercent(data.clearanceRatio)} reported clearance, with {compactNumber(data.balance)} remaining.</h2><p>Reported target, achievement, and balance from the retained ULB-grain source.</p></div><div className="legacy-ratio"><strong>{formatPercent(data.clearanceRatio)}</strong><span>reported clearance</span></div></div>
      <div className="legacy-flow"><span><small>Target quantity</small><b>{data.target.toLocaleString('en-IN')}</b></span><Icon name="arrow" size={22}/><span><small>Reported cleared</small><b>{data.achievement.toLocaleString('en-IN')}</b></span><Icon name="arrow" size={22}/><span className="balance"><small>Reported balance</small><b>{data.balance.toLocaleString('en-IN')}</b></span></div>
    </article><LegacyBalancePareto rows={reviewRows} total={data.balance}/></div>
    <div className="analytics-kpis four"><MiniKpi icon="alert" label="Positive balances" value={String(data.positiveBalanceCandidates)} detail="observed ULB-name candidates" tone="orange"/><MiniKpi icon="check" label="Zero balances" value={String(data.zeroBalanceCandidates)} detail="source-reported balance = 0" tone="teal"/><MiniKpi icon="chart" label="Higher than June" value={String(data.increasedSincePreviousPeriod)} detail={`${data.unchangedSincePreviousPeriod} unchanged values`} tone="blue"/><MiniKpi icon="shield" label="Balance conflicts" value={String(data.balanceConflicts)} detail="target − cleared ≠ balance" tone="violet"/></div>
    <article className="panel analytics-table-panel primary-review-table"><PanelTitle icon="target" title="Where to review" subtitle="Largest source-reported remaining balances · deterministic ordering only"/><div className="table-scroll"><table><thead><tr><th>ULB name as reported</th><th>District</th><th>Target</th><th>Reported cleared</th><th>Clearance ratio</th><th>Against peers</th><th>Reported balance</th><th></th></tr></thead><tbody>{reviewRows.map((row) => <tr key={row.tableKey + row.district + row.ulb}><td><b>{row.ulb}</b></td><td>{row.district}</td><td>{formatValue(row.target)}</td><td>{formatValue(row.achievement)}</td><td><RatioBar value={row.clearanceRatio}/></td><td><PeerStrip value={row.clearanceRatio} distribution={clearancePeers}/></td><td><b className="gap-value">{formatValue(row.balance)}</b></td><td><DrillLink ulb={row.ulb} district={row.district} from="Legacy waste"/></td></tr>)}</tbody></table></div></article>
    <MeaningFooter>Reported clearance is not daily processing, facility throughput, utilization, or verified remediation impact. A zero balance is preserved as a reported source value.</MeaningFooter>
  </>;
}

function LegacyBalancePareto({ rows, total }: { rows: ReturnType<typeof getLegacyWasteSummary>['rows']; total: number }) {
  const values = rows.slice(0, 8);
  const max = Math.max(...values.map((row) => row.balance ?? 0), 1);
  const cumulative = values.map((_, index) => total > 0
    ? values.slice(0, index + 1).reduce((sum, row) => sum + (row.balance ?? 0), 0) / total
    : 0);
  const width = 560;
  const height = 245;
  const left = 28;
  const right = 26;
  const top = 24;
  const bottom = 52;
  const innerWidth = width-left-right;
  const innerHeight = height-top-bottom;
  const step = innerWidth / Math.max(values.length,1);
  const points = cumulative.map((value,index) => `${left+step*(index+.5)},${top+innerHeight*(1-value)}`).join(' ');
  return <article className="panel legacy-pareto-panel"><PanelTitle icon="chart" title="Reported balance Pareto" subtitle="Largest candidate balances with cumulative share of the statewide returned total"/><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pareto chart of the eight largest source-reported legacy-waste balances"><line className="pareto-grid" x1={left} x2={width-right} y1={top+innerHeight/2} y2={top+innerHeight/2}/><line className="pareto-grid" x1={left} x2={width-right} y1={top+innerHeight} y2={top+innerHeight}/>{values.map((row,index) => { const barHeight = ((row.balance ?? 0)/max)*innerHeight*.78; const x = left+step*index+step*.18; return <g key={`${row.tableKey}-${row.ulb}`}><rect className="pareto-bar" x={x} y={top+innerHeight-barHeight} width={step*.54} height={barHeight} rx="4"/><text className="pareto-value" x={x+step*.27} y={top+innerHeight-barHeight-7} textAnchor="middle">{compactMetric(row.balance ?? 0)}</text><text className="pareto-label" x={x+step*.27} y={height-29} textAnchor="middle">{row.ulb.length > 9 ? `${row.ulb.slice(0,8)}…` : row.ulb}</text></g>; })}<polyline className="pareto-line" points={points}/>{cumulative.map((value,index) => <circle key={index} className="pareto-point" cx={left+step*(index+.5)} cy={top+innerHeight*(1-value)} r="4" role="img" aria-label={`Cumulative share through ${values[index].ulb}: ${formatPercent(value)}`}/>)}</svg><footer><span><i/>Candidate balance</span><span><i className="line"/>Cumulative share</span><b>{formatPercent(cumulative[cumulative.length-1] ?? 0)} in the top {values.length}</b></footer></article>;
}

function OutcomeAnalytics() {
  const data = getSwachhOutcomeSummary();
  const rows = data.rows.slice(0, 8);
  return <>
    <section className="analytics-view outcome-view">
      <div className="outcome-visual-grid">
        <article className="panel outcome-distribution-panel"><PanelTitle icon="chart" title="ODF distribution" subtitle={`${data.odfRecords} source records · reporting year 2024`}/><DistributionSection title="ODF category" items={data.odfDistribution}/></article>
        <article className="panel rank-panel"><PanelTitle icon="chart" title="National rank distribution" subtitle="Parsed 2024 ranks only"/><HorizontalBarChart items={data.rankDistribution.map((item) => ({ label: item.label, value: item.count }))}/><p className="chart-scope"><Icon name="info" size={14}/>Buckets appear only where parsed rank records were returned.</p></article>
      </div>
      <aside className="gfc-limited-note"><Icon name="info" size={17}/><b>Limited GFC evidence</b><span>Only {data.gfcRecords} GFC records are available, so GFC is not emphasized in the visual summary.</span></aside>
      <article className="panel analytics-table-panel primary-review-table"><PanelTitle icon="database" title="Outcome record explorer" subtitle="Observed normalized-name candidates · crosswalk review pending"/><div className="table-scroll"><table><thead><tr><th>Observed name candidate</th><th>District</th><th>ODF</th><th>GFC</th><th>National rank</th><th>Year</th><th>Match state</th></tr></thead><tbody>{rows.map((row) => <tr key={row.candidateKey}><td><b>{row.ulb}</b></td><td>{row.district}</td><td>{row.odfStatus ?? 'Not returned'}</td><td>{row.gfcStatus ?? 'Not returned'}</td><td>{row.nationalRank ?? 'Not returned'}</td><td>2024</td><td><ReadinessBadge value="Candidate only"/></td></tr>)}</tbody></table></div></article>
      <MeaningFooter>These outcomes are not attributed to or directly compared with 2026 operations.</MeaningFooter>
    </section>
  </>;
}

function ConversionJourney({ stages }: { stages: Array<[string, number, string]> }) {
  const base = Math.max(stages[0]?.[1] ?? 0, 1);
  return <div className={`conversion-journey stages-${stages.length}`}>
    {stages.map(([label, value, tone], index) => {
      const previous = stages[index - 1]?.[1];
      const reduction = previous === undefined ? null : Math.max(previous - value, 0);
      const share = Math.max(1.2, Math.min(100, value / base * 100));
      return <div className="journey-segment" key={label}>
        {reduction !== null && <div className="journey-loss"><span>{reduction.toLocaleString('en-IN')}</span><small>not represented in next reported stage</small><Icon name="arrow" size={20}/></div>}
        <article className={`journey-stage stage-${tone}`}><span className="journey-order">{String(index + 1).padStart(2, '0')}</span><small>{label}</small><b className="journey-value">{value.toLocaleString('en-IN')}</b><i><b style={{ width: `${share}%` }}/></i><em>{Math.round(value / base * 1000) / 10}% of target</em></article>
      </div>;
    })}
  </div>;
}

function PipelineDropoff({ values }: { values: Array<[string, number]> }) {
  const max = Math.max(...values.map(([, value]) => value), 1);
  return <div className="pipeline-dropoff-row">{values.map(([label, value], index) => { const previous = values[index - 1]?.[1]; const drop = previous === undefined ? null : Math.max(previous - value, 0); return <div key={label}><span><b>{label}</b><strong>{value.toLocaleString('en-IN')}</strong></span><i><b style={{ width: `${Math.max(1, value / max * 100)}%` }}/></i><small>{drop === null ? 'Starting point' : `${drop.toLocaleString('en-IN')} fewer reported`}</small></div>; })}</div>;
}

function MeaningFooter({ children }: { children: React.ReactNode }) {
  return <p className="meaning-footer"><Icon name="shield" size={16}/><b>What this does not mean</b><span>{children}</span></p>;
}

function MiniKpi({ icon, label, value, detail, tone, coverage }: { icon?: IconName; label: string; value: string; detail: string; tone: string; coverage?: Coverage }) {
  return <article className={`mini-kpi tone-${tone}`}>{icon && <span className="mini-kpi-icon"><Icon name={icon} size={21}/></span>}<span><GlossaryText text={label}/></span><strong><GlossaryText text={value}/></strong>{coverage && <CoverageLine coverage={coverage}/>}<small><GlossaryText text={detail}/></small></article>;
}

/**
 * Places one reported ratio inside the distribution of its peers. Without this a figure
 * like "7%" is unreadable: a reviewer cannot tell whether it is unusual or typical.
 *
 * The wording deliberately avoids performance language. A ULB sits high in this strip
 * because the source reported a higher value for it, which can mean better delivery or
 * simply better reporting.
 */
function PeerStrip({ value, distribution, format = formatPercent }: {
  value: number | null;
  distribution: Distribution | null;
  format?: (value: number | null) => string;
}) {
  const context = peerContext(value, distribution);
  if (!context || !distribution) return <span className="peer-strip peer-none">Not comparable</span>;
  // The median sits at the midpoint by definition once the scale is rank-based.
  const medianPos = 0.5;
  return <span className="peer-strip">
    <span className="peer-track" role="img" aria-label={`${format(value)}. ${ordinal(context.rank)} highest of ${context.of} ULBs that reported this figure. Median ${format(distribution.median)}.`}>
      <i className="peer-median" style={{ left: `${medianPos * 100}%` }}/>
      <i className={`peer-dot ${context.aboveMedian ? 'above' : 'below'}`} style={{ left: `${context.position * 100}%` }}/>
    </span>
    <span className="peer-label">
      <b>{ordinal(context.rank)}</b> of {context.of} reporting
      <em>median {format(distribution.median)}</em>
    </span>
  </span>;
}

/**
 * Sends a reviewer from a table row to that entity's evidence, carrying enough context
 * that the diagnostics page can say where they came from. Without this the tables were
 * dead ends: a reviewer could see which ULB stood out but not open it.
 */
function DrillLink({ ulb, district, from }: { ulb: string; district: string; from: string }) {
  const key = diagnosticsKeyFor(ulb, district);
  const exists = datasets.SAMPLE.diagnostics.some((entry) => entry.ulbKey === key);
  if (!exists) return <span className="drill-none" title="No diagnostics page for this observed name yet">Name not matched</span>;
  return <a className="drill-link" href={`/diagnostics/${key}?mode=sample&from=${encodeURIComponent(from)}`}>
    Open evidence <Icon name="arrow" size={14}/>
  </a>;
}

function RatioBar({ value }: { value: number | null }) {
  // Absence gets the house hatch across the full track, never an empty or short
  // bar, so a non-return is visually distinct from a genuine zero.
  if (value === null) return <span className="ratio-cell is-absent"><b>&mdash;</b><i className="absent-track" role="img" aria-label="Not returned"/></span>;
  const width = Math.max(2, Math.min(value * 100, 100));
  return <span className="ratio-cell"><b>{formatPercent(value)}</b><i><span style={{ width: `${width}%` }}/></i></span>;
}

function ReviewChip({ label, tone }: { label: string; tone: 'review' | 'info' | 'neutral' }) {
  return <span className={`review-chip ${tone}`}>{label}</span>;
}

/**
 * Bars are coloured by what a value means, not by its position in a list. `review` marks a
 * source status or condition that routes a record for review; `reported` is a plain reported
 * value. Assigning a hue by index made colour decorative and unreadable.
 */
const reviewPattern = /not commenced|site not available|local issue|approach road|pending|conflict|missing|duplicate|above target|zero target|unavailable|not returned/i;

function barTone(label: string): string {
  return reviewPattern.test(label) ? 'var(--orange)' : 'var(--teal)';
}

/**
 * A value of `null` means the entity did not return, which is not the same as
 * returning zero. Those rows are drawn as a full-width hatch across the track
 * rather than a short bar, so absence can never be read as a low magnitude.
 */
function HorizontalBarChart({ items, unit }: { items: Array<{ label: string; value: number | null }>; unit?: string }) {
  const max = Math.max(0, ...items.map((item) => item.value ?? 0));
  return <div className="horizontal-chart">{items.map((item) => item.value === null
    ? <div className="horizontal-bar is-absent" key={item.label}><span title={item.label}><GlossaryText text={item.label}/></span><i className="absent-track" role="img" aria-label={`${item.label}: not returned`}/><strong>Not returned</strong></div>
    : <div className="horizontal-bar" key={item.label}><span title={item.label}><GlossaryText text={item.label}/></span><i><b style={{ width: `${max ? Math.max(3, item.value / max * 100) : 0}%`, background: barTone(item.label) }}/></i><strong><GlossaryText text={`${item.value.toLocaleString('en-IN')}${unit ? ` ${unit}` : ''}`}/></strong></div>)}</div>;
}

function DistributionSection({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return <section><h3>{title}</h3><HorizontalBarChart items={items.map((item) => ({ label: item.label, value: item.count }))}/></section>;
}

function GapRadar({ mode, colorTheme, radar }: { mode: DataMode; colorTheme: ColorTheme; radar: GapAssessment[] }) {
  if (mode === 'SAMPLE') return <SampleGapRadar colorTheme={colorTheme}/>;
  const selected = radar.find((item) => item.state === 'INVESTIGATE') ?? radar[0];
  return <>
    <PageIntro visual="gap-radar" eyebrow="Evidence-gated assessment" title="Performance Gap Radar" description="Find where reported implementation and reported outcomes appear misaligned."><FilterBar mode={mode}/></PageIntro>
    <ModeKey mode={mode}/>
    <section className="radar-layout">
      <article className="panel radar-panel"><GapQuadrant mode={mode} colorTheme={colorTheme} items={radar} selectedKey={selected.ulbKey}/></article>
      <aside className="panel quadrant-guide"><h2>Understanding the states</h2><Guide state="DOING_WELL" text="Eligible aligned evidence would place stronger implementation and outcomes here."/><Guide state="LEARN_FROM" text="Eligible aligned evidence would place stronger outcomes with lower implementation here."/><Guide state="INFRASTRUCTURE_GAP" text="Eligible aligned evidence below both policy thresholds would appear here."/><Guide state="INVESTIGATE" text="Eligible aligned evidence with higher implementation and weaker outcomes would appear here."/><Guide state="UNSCORED" text="Something is missing: the name match, the period, the full response, or a required value."/></aside>
    </section>
    <section className="selected-ulb panel"><div className="selected-identity"><span className="municipal-icon"><Icon name="building" size={30}/></span><div><small>Highlighted entity</small><h2>{selected.name}</h2><p>{selected.district}</p></div></div><div className="selected-summary"><StatusPill state={selected.state}/><p>{selected.summary}</p></div><a className="primary-link" href={withMode(`/diagnostics/${selected.ulbKey}`, mode, colorTheme)}>Inspect evidence <Icon name="arrow" size={16}/></a></section>
    <EvidenceLabel mode={mode}/>
  </>;
}

interface DistrictShape { d: string; path: string }

/**
 * Evidence density across Andhra Pradesh.
 *
 * Colour is how many independent retained sources carry a row for each district,
 * not a performance measure. That choice is deliberate: ULB reporting coverage is
 * 123 of 123, so a coverage map would be a single flat colour, while source
 * density ranges from 3 to 28 and shows where the evidence is genuinely thin.
 *
 * A district with no retained row is filled with the house absence hatch rather
 * than the palest step of the ramp, so "nothing came back" can never be misread
 * as "a low value".
 *
 * The bundled boundaries are the 2022 reorganisation, 26 districts. Markapuram
 * and Polavaram were created on 31 December 2025 and have no boundary in any
 * public source yet; they appear in the data, so they are listed beside the map
 * rather than silently dropped.
 */
function DistrictEvidenceMap() {
  const [shapes, setShapes] = useState<DistrictShape[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const coverage = useMemo(() => getDistrictCoverage(), []);

  useEffect(() => {
    let live = true;
    fetch('/ap-districts.geojson')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('boundaries unavailable')))
      .then((collection: { features: Array<{ properties: { d: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }> }) => {
        if (!live) return;
        // Equirectangular, with longitude scaled by cos(mean latitude) so the
        // state is not stretched sideways at 16 degrees north.
        const LON0 = 76.761, LON1 = 84.761, LAT0 = 12.624, LAT1 = 19.166;
        const k = Math.cos((LAT0 + LAT1) / 2 * Math.PI / 180);
        const W = 560, H = 560 * ((LAT1 - LAT0) / ((LON1 - LON0) * k));
        const px = (lon: number) => ((lon - LON0) * k) / ((LON1 - LON0) * k) * W;
        const py = (lat: number) => (LAT1 - lat) / (LAT1 - LAT0) * H;
        const ring = (coords: number[][]) => coords.map((point, index) =>
          `${index ? 'L' : 'M'}${px(point[0]).toFixed(1)} ${py(point[1]).toFixed(1)}`).join('') + 'Z';
        setShapes(collection.features.map((feature) => ({
          d: feature.properties.d,
          path: feature.geometry.type === 'Polygon'
            ? (feature.geometry.coordinates as number[][][]).map(ring).join('')
            : (feature.geometry.coordinates as number[][][][]).flatMap((polygon) => polygon.map(ring)).join(''),
        })));
      })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  // The registry and the boundary file spell districts differently — "YSR" against
  // "YSR KADAPA", "SPSR NELLORE" against "SRI POTTI SRIRAMULU NELLORE". Matching on
  // an exact key hatched five districts that hold plenty of evidence, which is the
  // opposite of what the hatch is for, so the join goes through the same
  // same-district matcher the crosswalk uses.
  // Two spellings the fuzzy matcher cannot reach, because an initialism shares
  // almost no characters with the name it stands for.
  const ALIASES: Record<string, string> = {
    SPSRNELLORE: 'SRI POTTI SRIRAMULU NELLORE',
  };
  const expand = (name: string) => ALIASES[name.toUpperCase().replace(/[^A-Z]/g, '')] ?? name;
  const matchDistrict = (name: string) =>
    coverage.districts.find((entry) => sameDistrict(expand(entry.district), expand(name))) ?? null;
  const peak = Math.max(1, ...coverage.districts.map((entry) => entry.sources));
  const active = hover ? matchDistrict(hover) : null;
  const offMap = shapes
    ? coverage.districts.filter((entry) => !shapes.some((shape) => sameDistrict(expand(shape.d), expand(entry.district))))
    : [];
  // Vijayawada Municipal Corporation is a ULB the source files carry in the
  // district column. It has no boundary because it is not a district, which is a
  // different problem from Markapuram having been created too recently to appear.
  const miscoded = offMap.filter((entry) => /^VMC$/i.test(entry.district.trim()));
  const tooNew = offMap.filter((entry) => !miscoded.includes(entry));

  return <article className="panel map-panel">
    <div className="catalogue-heading">
      <PanelTitle icon="building" title="Where the evidence actually is"
        subtitle="Independent retained sources per district · not a performance measure"/>
      <span className="map-scale-note">3 to {peak} sources</span>
    </div>
    <div className="map-body">
      <div className="map-plot">
        {failed && <p className="map-fallback">District boundaries could not be loaded. The counts beside the map are unaffected.</p>}
        {!failed && !shapes && <p className="map-fallback">Loading district boundaries…</p>}
        {shapes && <svg viewBox="0 0 560 470" role="img"
          aria-label={`Map of Andhra Pradesh districts shaded by how many retained sources cover each, from 3 to ${peak}`}>
          <defs>
            <pattern id="map-absent" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--absence-ink)" strokeWidth="2.2"/>
            </pattern>
          </defs>
          {shapes.map((shape) => {
            const entry = matchDistrict(shape.d);
            const ratio = entry ? entry.sources / peak : null;
            return <path key={shape.d} d={shape.path}
              className={`map-district${hover === shape.d ? ' is-hover' : ''}${entry ? '' : ' is-absent'}`}
              fill={entry ? `color-mix(in oklab, var(--teal) ${Math.round(18 + (ratio ?? 0) * 82)}%, var(--surface))` : 'url(#map-absent)'}
              onMouseEnter={() => setHover(shape.d)} onMouseLeave={() => setHover(null)}/>;
          })}
        </svg>}
        {shapes && <div className="map-legend">
          <span className="ml-title">Sources per district</span>
          <div className="ml-ramp"><i/><i/><i/><i/><i/></div>
          <div className="ml-ends"><span>3</span><span>{peak}</span></div>
          <span className="ml-absent"><i/>No retained row</span>
        </div>}
        {active && <div className="map-tip"><b>{active.district}</b>
          <em>{active.sources} sources</em>
          <span>{active.reported} of {active.expected} ULBs reported</span></div>}
      </div>
      <div className="map-side">
        <div className="map-thin">
          <span className="ml-title">Thinnest evidence · sources per district</span>
          {[...coverage.districts].sort((left, right) => left.sources - right.sources).slice(0, 7).map((entry) =>
            <div key={entry.district} className={entry.sources < 10 ? 'is-thin' : undefined}>
              <b>{entry.district}</b>
              <span className="mt-ulbs">{entry.reported}/{entry.expected} ULBs</span>
              <em>{entry.sources}</em>
            </div>)}
          <p className="mt-note">
            {coverage.districts.filter((entry) => entry.sources >= 20).length} of {coverage.districts.length} districts
            are covered by 20 or more sources. These are the thin end of that distribution.
          </p>
        </div>
        {(tooNew.length > 0 || miscoded.length > 0) && <div className="map-offmap">
          {tooNew.length > 0 && <p>
            <b>{tooNew.map((entry) => entry.district).join(', ')}</b> {tooNew.length === 1 ? 'holds' : 'hold'} data but {tooNew.length === 1 ? 'has' : 'have'} no boundary.
            The bundled file is the 2022 reorganisation; Markapuram and Polavaram were created on 31 December 2025 and no public boundary carries them yet.
          </p>}
          {miscoded.length > 0 && <p className="map-miscoded">
            <b>{miscoded.map((entry) => entry.district).join(', ')}</b> has no boundary because it is not a district.
            Vijayawada Municipal Corporation is a ULB, and the source files carry it in the district column.
          </p>}
        </div>}
      </div>
    </div>
  </article>;
}

/**
 * The clearance-against-rank contrast.
 *
 * Named for exactly what it is. It is not the Gap Radar: the axes are two years
 * apart, so no quadrant, classification or causal reading is offered. The period
 * gap is printed on the panel and on both axes rather than buried in a footnote.
 */
function ClearanceRankContrast() {
  const data = getClearanceRankContrast();
  const [hover, setHover] = useState<ContrastPoint | null>(null);
  if (!data.points.length) return null;

  const W = 720, H = 340, padL = 62, padR = 22, padT = 18, padB = 46;
  const worstRank = Math.max(...data.points.map((point) => point.rank));
  const rankTop = Math.ceil(worstRank / 100) * 100;
  const x = (clearance: number) => padL + Math.min(1, clearance) * (W - padL - padR);
  // Rank 1 is best, so it sits at the top of the plot.
  const y = (rank: number) => padT + (rank / rankTop) * (H - padT - padB);

  return <article className="panel contrast-panel">
    <div className="catalogue-heading">
      <PanelTitle icon="target" title="Waste clearance against national rank"
        subtitle={`${data.points.length} ULBs holding both figures · not a performance score`}/>
      <span className="contrast-gap">{data.clearancePeriod} vs {data.rankYear} rank · {monthsApart(data.clearancePeriod, data.rankYear)}</span>
    </div>
    <p className="contrast-lede">
      The only pairing the retained evidence can populate. Every other axis is empty:
      IHHL completion is zero for 58 of 59 ULBs and collection delivery for 80 of 83.
      <b> The two axes here are two years apart, so position shows contrast, never cause.</b>
    </p>
    <div className="contrast-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Scatter of reported legacy waste clearance against 2024 national rank for ${data.points.length} ULBs`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => <g key={tick}>
          <line className="cp-grid" x1={x(tick)} y1={padT} x2={x(tick)} y2={H - padB}/>
          <text className="cp-axis" x={x(tick)} y={H - padB + 15} textAnchor="middle">{Math.round(tick * 100)}%</text>
        </g>)}
        {[1, rankTop / 2, rankTop].map((tick) => <g key={tick}>
          <line className="cp-grid" x1={padL} y1={y(tick)} x2={W - padR} y2={y(tick)}/>
          <text className="cp-axis" x={padL - 8} y={y(tick) + 3} textAnchor="end">{Math.round(tick)}</text>
        </g>)}
        {data.points.map((point) => <circle key={point.ulb + point.rank}
          className={`cp-dot${hover?.ulb === point.ulb ? ' is-hover' : ''}${point.clearance >= 1 ? ' at-ceiling' : ''}`}
          cx={x(point.clearance)} cy={y(point.rank)} r={4}
          onMouseEnter={() => setHover(point)} onMouseLeave={() => setHover(null)}/>)}
        <text className="cp-label" x={padL} y={H - 6}>Reported legacy-waste clearance · {data.clearancePeriod}</text>
        <text className="cp-label cp-rot" x={-(H / 2)} y={14} transform="rotate(-90)" textAnchor="middle">National rank · {data.rankYear} · 1 is best</text>
      </svg>
      {hover && <div className="cp-tip"><b>{hover.ulb}</b><span>{hover.district}</span>
        <em>{formatPercent(hover.clearance)} cleared · rank {hover.rank}</em></div>}
    </div>
    <footer className="contrast-foot">
      <span><b>{data.atCeiling}</b> sit at exactly 100% cleared, which is worth questioning before it is read as success.</span>
      <span><b>{data.excludedZeroRank}</b> excluded: rank returned as 0, which means unranked, not first.</span>
      <span><b>{data.excludedNoRank}</b> excluded: a clearance figure but no rank record at all.</span>
    </footer>
  </article>;
}

/** Rough distance between the operational period and the survey year, for the header chip. */
function monthsApart(period: string, rankYear: number): string {
  const year = Number(period.match(/\d{4}/)?.[0]);
  if (!Number.isFinite(year)) return 'period gap';
  const gap = year - rankYear;
  return gap <= 0 ? 'same year' : `${gap} year${gap === 1 ? '' : 's'} apart`;
}

function SampleGapRadar({ colorTheme }: { colorTheme: ColorTheme }) {
  const stats = useMemo(() => crosswalkStats(), []);
  const queue = useMemo(() => crosswalkQueue(), []);
  const decisions = useSyncExternalStore(subscribeDecisions, readDecisions, serverDecisions);

  function decide(item: QueueItem, state: DecisionState, ulbId: string | null) {
    writeDecisions({ ...decisions, [item.id]: { itemId: item.id, state, ulbId, decidedAt: new Date().toISOString() } });
  }

  function clearDecision(item: QueueItem) {
    const next = { ...decisions };
    delete next[item.id];
    writeDecisions(next);
  }

  /** Bulk-approve same-district proposals at or above a similarity floor. */
  function approveBulk(items: QueueItem[]) {
    const decidedAt = new Date().toISOString();
    const next = { ...decisions };
    for (const item of items) {
      const candidate = item.candidates[0];
      if (!candidate) continue;
      next[item.id] = { itemId: item.id, state: 'approved', ulbId: candidate.ulbId, decidedAt };
    }
    writeDecisions(next);
  }

  const decided = Object.values(decisions);
  const approved = decided.filter((decision) => decision.state === 'approved').length;
  const reviewed = decided.filter((decision) => decision.state !== 'deferred').length;
  const remaining = stats.residualNames - reviewed;

  const blockers: Array<[IconName, string, string, boolean]> = [
    ['link', 'ULB identity not reviewed', `${stats.residualNames - reviewed} of ${stats.residualNames} observed names still need a review decision.`, reviewed >= stats.residualNames],
    ['calendar', 'Periods not aligned', 'Operations and outcomes are from different months, so they cannot be compared.', false],
    ['clock', 'Outcome data is older', 'The only outcome data we have is from 2024. Operations are from 2026.', false],
    ['shield', 'Scoring policy not approved', 'Nobody has agreed the thresholds yet, so there is nothing to score against.', false],
  ];

  return <>
    <PageIntro visual="gap-radar" eyebrow="What the evidence supports today" title="Scoring starts once the operational and outcome data line up." description="The layout below shows what this becomes. Real entities are not scored yet because the evidence is not there."/>
    <ModeKey mode="SAMPLE"/>
    <section className="panel sample-radar-state">
      <div className="radar-zero"><span><Icon name="target" size={30}/></span><small>Current state</small><strong>0</strong><b>entities eligible for scoring</b><p>Real entities stay unscored until there is enough evidence to score them.</p></div>
      <div className="radar-blockers"><h2>What is blocking activation?</h2>{blockers.map(([icon, title, detail, done]) => <div key={title} className={done ? 'blocker-cleared' : undefined}><span><Icon name={done ? 'check' : icon} size={18}/></span><p><b>{title}</b><small>{detail}</small></p></div>)}</div>
      <div className="radar-next"><span className="eyebrow">Next</span><b>Reviewed identity + aligned current outcomes</b><p>Gate one is workable now. The remaining three require source-owner action.</p><a href={withMode('/data-readiness', 'SAMPLE', colorTheme)}>Inspect readiness evidence <Icon name="arrow" size={15}/></a></div>
    </section>
    <CrosswalkWorkbench stats={stats} queue={queue} decisions={decisions} approved={approved} reviewed={reviewed} remaining={remaining} onDecide={decide} onClear={clearDecision} onApproveBulk={approveBulk}/>
    <ClearanceRankContrast/>
    <EvidenceLabel/>
  </>;
}

/**
 * When no proposal fits, the reviewer still knows the answer — Rajamahendravaram is
 * Rajahmundry, GVMC is Visakhapatnam. Without this the queue simply stalls on the
 * cases a person is best placed to decide.
 */
function ManualAssign({ item, onDecide }: { item: QueueItem; onDecide: (item: QueueItem, state: DecisionState, ulbId: string | null) => void }) {
  const groups = useMemo(() => anchorByDistrict(), []);
  const [open, setOpen] = useState(false);
  if (!open) return <button className="manual-open" onClick={() => setOpen(true)}>Pick from registry manually</button>;
  return <label className="manual-assign">
    <span>Assign <b>{item.sourceName}</b> to</span>
    <select defaultValue="" onChange={(event) => { if (event.target.value) onDecide(item, 'approved', event.target.value); }}>
      <option value="" disabled>Search the 123 registry entities…</option>
      {groups.map((group) => <optgroup key={group.district} label={group.district}>
        {group.entities.map((entity) => <option key={entity.ulbId} value={entity.ulbId}>{entity.name}</option>)}
      </optgroup>)}
    </select>
  </label>;
}

function CrosswalkPayoff({ decisions }: { decisions: Record<string, Decision> }) {
  const aliases = useMemo(() => approvedAliases(decisions), [decisions]);
  const grid = useMemo(() => getEvidenceCoverageGrid(aliases), [aliases]);
  if (grid.totals.recovered === 0) return null;
  const absentPercent = Math.round((grid.totals.absent / grid.totals.cells) * 100);
  return <div className="crosswalk-payoff">
    <div className="payoff-head"><Icon name="check" size={18}/><b>What your approvals unlocked</b></div>
    <div className="payoff-stats">
      <div><b>{grid.totals.recovered}</b><small>observations now reachable that were blank before</small></div>
      <div><b>{absentPercent}%</b><small>of the coverage grid still absent, down from 48%</small></div>
    </div>
    <p>Each approval connects one source&rsquo;s spelling to the registry, so rows that were previously invisible to every cross-source view become joinable. <a href={withMode('/data-readiness', 'SAMPLE', 'light')}>See them in the coverage grid</a> — recovered cells are marked.</p>
    <div className="payoff-next">
      <span className="eyebrow">Still required before scoring</span>
      <ol>
        <li><b>Sign-off on this crosswalk.</b> Copy the working file above and put it through your approval process. Until then it stays a reviewer working copy.</li>
        <li><b>Same-year outcome evidence.</b> Operations are 2026; the only outcomes retained are 2024. No approval fixes that — it needs a source request.</li>
        <li><b>An approved scoring policy.</b> Thresholds and weights are a policy decision, not a data one.</li>
      </ol>
    </div>
  </div>;
}

function BulkApprove({ queue, decisions, onApproveBulk }: {
  queue: QueueItem[];
  decisions: Record<string, Decision>;
  onApproveBulk: (items: QueueItem[]) => void;
}) {
  const [floor, setFloor] = useState(0.8);
  // Only same-district single-candidate proposals are ever eligible for a bulk decision.
  const eligible = queue.filter((item) => item.tier === 'single-candidate'
    && !decisions[item.id]
    && (item.candidates[0]?.score ?? 0) >= floor);
  const heldBack = queue.filter((item) => item.tier !== 'single-candidate' && !decisions[item.id]).length;

  return <div className="bulk-approve">
    <div className="bulk-copy">
      <b>Approve the obvious ones in bulk</b>
      <p>Same-district proposals where the observed name and the registry name differ only by spelling. Cross-district and no-candidate names are never included — those are the ones where &ldquo;almost the same&rdquo; is actively wrong.</p>
    </div>
    <label className="bulk-floor">
      <span>Similarity floor</span>
      <select value={floor} onChange={(event) => setFloor(Number(event.target.value))}>
        <option value={0.95}>0.95 — near identical</option>
        <option value={0.9}>0.90 — very close</option>
        <option value={0.85}>0.85 — close</option>
        <option value={0.8}>0.80 — recommended</option>
        <option value={0.62}>0.62 — every same-district match</option>
      </select>
    </label>
    <button className="bulk-button" onClick={() => onApproveBulk(eligible)} disabled={eligible.length === 0}>
      Approve {eligible.length} match{eligible.length === 1 ? '' : 'es'}
    </button>
    <span className="bulk-held">{heldBack} held for individual review</span>
  </div>;
}

const tierLabels: Record<ProposalTier, string> = {
  exact: 'Resolved',
  'single-candidate': 'One same-district candidate',
  ambiguous: 'Several same-district candidates',
  'cross-district': 'Only cross-district candidates',
  unmatched: 'No candidate above threshold',
};

function CrosswalkWorkbench({ stats, queue, decisions, approved, reviewed, remaining, onDecide, onClear, onApproveBulk }: {
  stats: ReturnType<typeof crosswalkStats>;
  queue: QueueItem[];
  decisions: Record<string, Decision>;
  approved: number;
  reviewed: number;
  remaining: number;
  onDecide: (item: QueueItem, state: DecisionState, ulbId: string | null) => void;
  onClear: (item: QueueItem) => void;
  onApproveBulk: (items: QueueItem[]) => void;
}) {
  const [tier, setTier] = useState<'ALL' | ProposalTier>('ALL');
  const [hideDecided, setHideDecided] = useState(true);
  const [copied, setCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<ImportOutcome | null>(null);

  const visible = queue.filter((item) => (tier === 'ALL' || item.tier === tier) && !(hideDecided && decisions[item.id]));

  function applyImport() {
    const { decisions: incoming, outcome } = parseDecisionArtifact(importText);
    setImportResult(outcome);
    if (outcome.applied > 0) {
      // Merge rather than replace, so importing a partial correction does not
      // silently discard decisions the file does not mention.
      writeDecisions({ ...decisions, ...incoming });
      setImportText('');
    }
  }

  async function copyArtifact() {
    try {
      await navigator.clipboard.writeText(serializeDecisions(Object.values(decisions), stats));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return <section className="panel crosswalk-workbench" aria-label="Candidate ULB crosswalk workbench">
    <div className="catalogue-heading">
      <PanelTitle icon="link" title="Crosswalk workbench" subtitle="Propose, review and record candidate ULB matches against the source-provided anchor registry"/>
      <span className="catalogue-count">{stats.anchorSize} anchor IDs · {stats.anchorConflicts} conflicts</span>
    </div>

    <div className="crosswalk-progress">
      <div className="progress-ring" role="img" aria-label={`${reviewed} of ${stats.residualNames} residual names reviewed`}>
        <svg viewBox="0 0 88 88">
          <circle className="ring-track" cx="44" cy="44" r="38"/>
          <circle className="ring-arc" cx="44" cy="44" r="38"
            strokeDasharray={2 * Math.PI * 38}
            strokeDashoffset={2 * Math.PI * 38 * (1 - reviewed / Math.max(stats.residualNames, 1))}
            transform="rotate(-90 44 44)"/>
        </svg>
        <span><b>{Math.round((reviewed / Math.max(stats.residualNames, 1)) * 100)}%</b><small>reviewed</small></span>
      </div>
      <div className="progress-figures">
        <div className="fig fig-done"><b>{stats.resolvedPairs.toLocaleString('en-IN')}</b><small>resolved automatically<i>exact match to the registry</i></small></div>
        <div className="fig fig-approved"><b>{approved}</b><small>approved by you<i>recorded with evidence</i></small></div>
        <div className="fig fig-open"><b>{remaining}</b><small>awaiting a decision<i>{remaining === 0 ? 'queue complete' : 'of ' + stats.residualNames + ' residual names'}</i></small></div>
      </div>
    </div>

    <p className="crosswalk-caution"><Icon name="shield" size={15}/><span><b>Similarity ranks, it never decides.</b> Candidates are district-scoped — <code>Atmakur K</code> in Kurnool scores 0.86 against <code>ATMAKUR-N</code> in Nellore, and is held back rather than matched. Decisions are a local working copy, <GlossaryText text="not an approved crosswalk"/>.</span></p>

    <BulkApprove queue={queue} decisions={decisions} onApproveBulk={onApproveBulk}/>

    <div className="crosswalk-controls">
      <InternalViewSwitch label="Queue filter" value={tier} onChange={setTier} items={[
        ['ALL', `All ${stats.residualNames}`],
        ['single-candidate', `One candidate ${stats.singleCandidate}`],
        ['cross-district', `Cross-district ${stats.crossDistrictOnly}`],
        ['unmatched', `No candidate ${stats.unmatched}`],
      ] as Array<['ALL' | ProposalTier, string]>}/>
      <label className="crosswalk-toggle"><input type="checkbox" checked={hideDecided} onChange={(event) => setHideDecided(event.target.checked)}/> Hide decided</label>
      <button className="crosswalk-export" onClick={copyArtifact} disabled={reviewed === 0}>{copied ? 'Copied' : `Copy working crosswalk (${approved} approved)`}</button>
      <button className="crosswalk-import-open" onClick={() => setImportOpen((open) => !open)}>{importOpen ? 'Cancel import' : 'Paste reviewed crosswalk'}</button>
    </div>

    {importOpen && <div className="crosswalk-import">
      <label htmlFor="crosswalk-paste">Paste a working crosswalk file. Decisions in it replace matching entries; anything it does not mention is left alone.</label>
      <textarea id="crosswalk-paste" value={importText} rows={5} spellCheck={false}
        placeholder='{ "decisions": [ … ] }'
        onChange={(event) => { setImportText(event.target.value); setImportResult(null); }}/>
      <div className="ci-actions">
        <button onClick={applyImport} disabled={!importText.trim()}>Apply</button>
        {importResult && <span className={importResult.applied ? 'ci-ok' : 'ci-bad'}>
          {importResult.applied} applied{importResult.skipped ? `, ${importResult.skipped} rejected` : ''}
        </span>}
      </div>
      {importResult && importResult.problems.length > 0 && <ul className="ci-problems">
        {importResult.problems.map((problem) => <li key={problem}>{problem}</li>)}
      </ul>}
    </div>}

    <CrosswalkPayoff decisions={decisions}/>

    {visible.length === 0
      ? <p className="crosswalk-empty">{queue.length === 0 ? 'Every observed name resolves to the anchor registry.' : 'No queue items match this filter.'}</p>
      : <ul className="crosswalk-queue">{visible.map((item) => {
        const decision = decisions[item.id];
        return <li key={item.id} className={`crosswalk-item tier-${item.tier}${decision ? ` decided-${decision.state}` : ''}`}>
          <div className="item-observed">
            <b>{item.sourceName}</b>
            <small>{item.sourceDistrict || 'District not reported'}</small>
            <span className="item-meta">{item.occurrences} record{item.occurrences === 1 ? '' : 's'} · {item.sources.length} source{item.sources.length === 1 ? '' : 's'}</span>
            <details className="item-sources"><summary>Sources</summary><ul>{item.sources.map((source) => <li key={source}><code>{source}</code></li>)}</ul></details>
          </div>
          <div className="item-proposals">
            <span className={`tier-chip tier-${item.tier}`}>{tierLabels[item.tier]}</span>
            {item.candidates.length === 0
              ? <p className="no-candidate">No anchor entry scores above the threshold. This name needs a source-owner decision, not a match.</p>
              : <div className="candidate-list">{item.candidates.map((candidate) => <div className="candidate" key={candidate.ulbId}>
                <div><b>{candidate.name}</b><small>{candidate.district} · <code>ulb_id {candidate.ulbId}</code>{candidate.sameDistrict ? '' : ' · different district'}</small></div>
                <span className="candidate-score">{candidate.score.toFixed(2)}</span>
                <button onClick={() => onDecide(item, 'approved', candidate.ulbId)} disabled={decision?.state === 'approved' && decision.ulbId === candidate.ulbId}>Approve</button>
              </div>)}</div>}
            <ManualAssign item={item} onDecide={onDecide}/>
            <div className="item-actions">
              <button onClick={() => onDecide(item, 'rejected', null)}>No match</button>
              <button onClick={() => onDecide(item, 'deferred', null)}>Defer</button>
              {decision && <button className="undo" onClick={() => onClear(item)}>Undo</button>}
              {decision && <span className={`decision-state state-${decision.state}`}>{decision.state === 'approved' ? `Approved → ulb_id ${decision.ulbId}` : decision.state === 'rejected' ? 'Recorded: no match' : 'Deferred'}</span>}
            </div>
          </div>
        </li>;
      })}</ul>}
  </section>;
}

function ModeKey({ mode }: { mode: DataMode }) {
  return <div className="mode-key"><span className={mode === 'DEMO' ? 'active' : ''}><b>DEMO</b> shows future capability</span><span className={mode === 'SAMPLE' ? 'active' : ''}><b>SAMPLE</b> shows what today&rsquo;s evidence supports</span></div>;
}

function FilterBar({ mode }: { mode: DataMode }) {
  return <div className="filter-bar" aria-label="Current filters"><span><Icon name="building" size={16}/>{mode === 'DEMO' ? 'All demo districts' : mode === 'SAMPLE' ? `${governedSnapshotStats.baselineUlbCandidates} observed ULB-name candidates · ${governedSnapshotStats.baselineUlbRows} latest-period IHHL rows` : 'Source pending'}</span><span><Icon name="calendar" size={16}/>{mode === 'DEMO' ? 'Illustrative period' : mode === 'SAMPLE' ? '2024 outcomes + Mar–Aug 2026 operations' : 'No period'}</span></div>;
}

function GapQuadrant({ items, mode, colorTheme, selectedKey }: { items: GapAssessment[]; mode: DataMode; colorTheme: ColorTheme; selectedKey: string }) {
  const plotted = items.filter((item) => item.x !== null && item.y !== null);
  const unscored = items.filter((item) => item.state === 'UNSCORED');
  return <div className="quadrant-wrap"><div className="axis-label y-axis"><b>Outcome performance</b><span>Weak</span><span>Strong</span></div><div className="quadrant" aria-label="Two by two performance gap matrix"><div className="quadrant-label q-learn"><b><Icon name="target" size={15}/>Learn From</b><span>Lower implementation · stronger outcome</span></div><div className="quadrant-label q-well"><b><Icon name="check" size={15}/>Doing Well</b><span>Higher implementation · stronger outcome</span></div><div className="quadrant-label q-infra"><b><Icon name="alert" size={15}/>Infrastructure Gap</b><span>Lower implementation · weaker outcome</span></div><div className="quadrant-label q-investigate"><b><Icon name="search" size={15}/>Investigate</b><span>Higher implementation · weaker outcome</span></div>{plotted.map((item) => <a aria-label={`${item.name}: ${stateLabels[item.state]}`} title={`${item.name} — ${stateLabels[item.state]}`} className={`radar-marker marker-${item.state.toLowerCase()} ${item.ulbKey === selectedKey ? 'is-selected' : ''}`} key={item.ulbKey} href={withMode(`/diagnostics/${item.ulbKey}`, mode, colorTheme)} style={{ left: `${10 + item.x! * 80}%`, bottom: `${10 + item.y! * 80}%` }}><span/>{item.name.replace('Demo ULB ', '')}</a>)}</div><div className="x-axis"><span>Low</span><b>Reported implementation progress</b><span>High</span></div><div className="radar-legend"><span><i className="legend-dot scored"/>{mode === 'DEMO' ? 'Scored demo fixture' : 'No scored source entities'}</span><span><i className="legend-dot selected"/>Highlighted entity</span><span><i className="legend-dot unscored"/>Unscored</span><span><Icon name="info" size={15}/>{mode === 'DEMO' ? 'Thresholds exist only in illustrative policy v0-demo' : 'Scoring remains gated by identity and period alignment'}</span></div>{unscored.length > 0 && <div className="unscored-rail"><b>Unscored</b>{unscored.map((item) => <a key={item.ulbKey} href={withMode(`/diagnostics/${item.ulbKey}`, mode, colorTheme)}>{item.name}<small>{item.reasons.map((reason) => reasonLabels[reason]).join(' · ')}</small></a>)}</div>}</div>;
}

function Guide({ state, text }: { state: GapState; text: string }) {
  const icon: IconName = state === 'DOING_WELL' ? 'check' : state === 'UNSCORED' ? 'clock' : state === 'INFRASTRUCTURE_GAP' ? 'alert' : state === 'INVESTIGATE' ? 'search' : 'target';
  return <div className={`guide-item guide-${state.toLowerCase()}`}><span className="guide-icon"><Icon name={icon} size={20}/></span><div><b>{stateLabels[state]}</b><p>{text}</p></div></div>;
}

function Diagnostics({ mode, colorTheme, cameFrom, diagnostic, allKeys }: { mode: DataMode; colorTheme: ColorTheme; cameFrom?: string | null; diagnostic: ReturnType<ReturnType<typeof createProvider>['getDiagnostic']>; allKeys: { key: string; name: string }[] }) {
  const [evidenceIndex, setEvidenceIndex] = useState(0);
  const evidence = diagnostic.evidence[evidenceIndex] ?? diagnostic.evidence[0];
  const sourceFamilies = new Set(diagnostic.evidence.map((item) => item.tableKey)).size;
  const returnedPeriods = new Set(diagnostic.evidence.map((item) => item.period)).size;
  const additionalSources = diagnostic.evidence.filter((item) => !/identification_of_new_ihhls|machinery_e_autos_service_model|iswm_facilities|odf_status|gfc_status|national_rank/.test(item.tableKey));
  const backTab = cameFrom === 'Sanitation delivery' ? 'sanitation' : cameFrom === 'Legacy waste' ? 'processing' : 'collection';
  return <>
    {cameFrom && <nav className="drill-crumb" aria-label="Where you came from">
      <a href={`${withMode('/operational-analytics', mode, colorTheme)}&tab=${backTab}`}><Icon name="arrow" size={14}/>Back to {cameFrom}</a>
      <span>You opened this from the {cameFrom.toLowerCase()} review table.</span>
    </nav>}
    <PageIntro visual="diagnostics" eyebrow="Audit-friendly diagnostics" title="ULB Diagnostics & Evidence Inspector" description="What was reported for this ULB, which sources it came from, and what is missing."><label className="entity-select"><span className="sr-only">Selected entity</span><select aria-label="Selected entity" value={diagnostic.ulbKey} onChange={(event) => { window.location.href = withMode(`/diagnostics/${event.target.value}`, mode, colorTheme); }}>{allKeys.map((item) => <option value={item.key} key={item.key}>{item.name}</option>)}</select></label>{mode === 'SAMPLE' && <EvidencePack diagnostic={diagnostic}/>}</PageIntro>
    <section className="diagnostics-layout">
      <article className="panel diagnostic-main">
        <div className="diagnostic-heading"><span className="municipal-icon"><Icon name="building" size={28}/></span><div><h2>{diagnostic.name}</h2><p>{diagnostic.district} · {diagnostic.reportingContext}</p>{mode === 'SAMPLE' && <span className="candidate-identity-label">Candidate cross-source identity — not yet reviewed</span>}</div><StatusPill state={diagnostic.state}/></div>
        {mode === 'SAMPLE' && <div className="evidence-breadth-strip"><span><Icon name="database" size={18}/><b>{sourceFamilies}</b><small>source families returned</small></span><span><Icon name="calendar" size={18}/><b>{returnedPeriods}</b><small>reported period labels</small></span><span><Icon name="link" size={18}/><b>{diagnostic.evidence.length}</b><small>retained matching rows</small></span><span><Icon name="shield" size={18}/><b>UNSCORED</b><small>candidate identity only</small></span></div>}
        <section className="case-section"><span className="eyebrow">What is reported</span><h3>Current matched records</h3><div className="diagnostic-metrics">{diagnostic.metrics.slice(0, 4).map((metric) => <MetricRowView key={metric.label} metric={metric} onEvidence={() => { const index = diagnostic.evidence.findIndex((item) => item.id === metric.evidenceId); if (index >= 0) setEvidenceIndex(index); }}/>)}</div>{mode === 'SAMPLE' && additionalSources.length > 0 && <details className="additional-evidence"><summary>Show {additionalSources.length} additional exact-name source records</summary><div>{[...new Map(additionalSources.map((item) => [item.tableKey, { item, index: diagnostic.evidence.indexOf(item) }])).values()].map(({ item, index }) => <button type="button" key={item.tableKey} onClick={() => setEvidenceIndex(index)}><Icon name="database" size={15}/><span><b>{item.dataset}</b><small>{item.period} · {item.grain} grain</small></span><Icon name="arrow" size={14}/></button>)}</div></details>}</section>
        <section className="case-analysis-grid">
          <article className={`case-signal callout-${diagnostic.state.toLowerCase()}`}><span><Icon name={diagnostic.state === 'UNSCORED' ? 'alert' : 'target'} size={22}/></span><div><small>What stands out</small><h3>{diagnostic.title}</h3><b>Why</b><p>{diagnostic.summary}</p></div></article>
          <article className="case-limit"><span><Icon name="shield" size={20}/></span><div><small>What cannot be concluded</small><p>{mode === 'SAMPLE' ? 'These records do not establish utilization, an underlying cause, or current outcome impact. Identity and period review are still required.' : 'Illustrative demo values are not government findings.'}</p></div></article>
        </section>
      </article>
      <aside className="diagnostic-side">
        <article className="panel evidence-panel"><PanelTitle icon="search" title="Evidence Inspector" subtitle={mode === 'SAMPLE' ? `${diagnostic.evidence.length} matching source record${diagnostic.evidence.length === 1 ? '' : 's'} retained` : 'Select a metric row to inspect its source'}/>{diagnostic.evidence.length > 1 && <label className="evidence-select"><span>Source record</span><select aria-label="Evidence record" value={evidenceIndex} onChange={(event) => setEvidenceIndex(Number(event.target.value))}>{diagnostic.evidence.map((item, index) => <option value={index} key={item.id}>{item.dataset} · {item.period}</option>)}</select></label>}{evidence ? <EvidenceView evidence={evidence} scored={diagnostic.state !== 'UNSCORED'}/> : <div className="empty-evidence"><Icon name="database" size={30}/><b>No source record available</b><p>Evidence appears only after a qualified fixture or source record is selected.</p></div>}</article>
        <article className="panel quality-panel"><PanelTitle icon="shield" title={diagnostic.state === 'UNSCORED' ? 'Why this is unscored' : 'Evidence quality'} />
          <ul>{diagnostic.qualityFlags.map((flag) => <li key={flag}><Icon name={diagnostic.state === 'UNSCORED' ? 'alert' : 'check'} size={16}/>{flag}</li>)}</ul>
        </article>
      </aside>
    </section>
    <EvidenceLabel mode={mode}/>
  </>;
}

function MetricRowView({ metric, onEvidence }: { metric: MetricRow; onEvidence: () => void }) {
  const artwork = metric.label.includes('ISWM') || metric.label.includes('Processing') ? '/assets/sasa/domain-iswm.png' : metric.label.includes('IHHL') || metric.label.includes('Sanitation') ? '/assets/sasa/domain-ihhl.png' : metric.label.includes('ODF') || metric.label.includes('Outcome') ? '/assets/sasa/domain-swachh.png' : '/assets/sasa/domain-eauto.png';
  return <button className={`diagnostic-metric tone-${metric.tone}`} onClick={onEvidence}><span className="metric-symbol"><Image src={artwork} alt="" width={44} height={44}/></span><span><b><GlossaryText text={metric.label}/></b><small><GlossaryText text={metric.detail}/></small></span><strong><GlossaryText text={metric.value}/></strong><span className="view-evidence">Evidence <Icon name="arrow" size={14}/></span></button>;
}

function EvidenceView({ evidence, scored }: { evidence: NonNullable<ReturnType<ReturnType<typeof createProvider>['getDiagnostic']>['evidence'][number]>; scored: boolean }) {
  return <div className="evidence-rows"><EvidenceRow icon="database" label="Source dataset" value={evidence.dataset}/><EvidenceRow icon="calendar" label="Source period" value={evidence.period}/><EvidenceRow icon="database" label="Grain" value={evidence.grain}/><EvidenceRow icon="shield" label="Match status" value={evidence.matchStatus}/><EvidenceRow icon="chart" label="Formula / check" value={evidence.formula}/><EvidenceRow icon={scored ? 'check' : 'alert'} label="Scoring state" value={scored ? 'Demo eligible' : 'Unscored'}/><details className="evidence-details"><summary>Evidence details and raw fields</summary><EvidenceRow icon="link" label="Name candidate" value={evidence.normalizedCandidate}/><EvidenceRow icon="link" label="Join method" value={evidence.joinMethod}/><EvidenceRow icon="clock" label="Freshness" value={evidence.freshness}/><div className="raw-fields"><small>Raw source fields</small>{Object.entries(evidence.rawFields).map(([key, value]) => <code key={key}><span>{key}</span><b>{value}</b></code>)}</div><div className="provenance"><Icon name="info" size={16}/><span>{evidence.provenance}</span></div></details></div>;
}

function EvidenceRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return <div className="evidence-row"><Icon name={icon} size={18}/><span><GlossaryText text={label}/></span><b><GlossaryText text={value}/></b></div>;
}

function DataReadiness({ mode, readiness }: { mode: DataMode; readiness: ReturnType<ReturnType<typeof createProvider>['getReadiness']> }) {
  const [view, setView] = useState<'catalogue' | 'coverage' | 'periods' | 'quality'>('catalogue');
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('ALL');
  const [evidence, setEvidence] = useState('ALL');
  const [eligibility, setEligibility] = useState('ALL');
  const themes = [...new Set(readiness.rows.map((row) => row.theme))];
  const evidenceStates = [...new Set(readiness.rows.map((row) => row.payloadEvidence))];
  const eligibilityStates = [...new Set(readiness.rows.map((row) => row.eligibility))];
  const filteredRows = readiness.rows.filter((row) => {
    const haystack = `${row.dataset} ${row.tableKey} ${row.columns.join(' ')}`.toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (theme === 'ALL' || row.theme === theme)
      && (evidence === 'ALL' || row.payloadEvidence === evidence)
      && (eligibility === 'ALL' || row.eligibility === eligibility);
  });
  return <>
    <PageIntro visual="data-readiness" art={view === 'coverage' ? '/assets/sasa/hero-swachh.png' : undefined} eyebrow="Activation evidence" title={view === 'coverage' ? 'ULB Evidence Coverage Explorer' : 'Data Readiness'} description={view === 'coverage' ? 'See where governed dataset coverage overlaps and where evidence blind spots remain.' : 'Inspect catalogue coverage, returned periods, quality conditions, and the gates for higher-order intelligence.'}><FilterBar mode={mode}/></PageIntro>
    <ReadinessMaturitySummary/>
    <div className="analytics-tabs readiness-tabs" role="tablist" aria-label="Data readiness views">{(['catalogue', 'coverage', 'periods', 'quality'] as const).map((item) => <button key={item} role="tab" aria-selected={view === item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{sentenceCase(item)}</button>)}</div>
    {mode === 'SAMPLE' && <div className="readiness-count-footer"><span>Technical coverage</span><b>29 complete working exports</b><i/> <b>4,359 retained rows</b><i/> <b>30 authorized endpoints</b></div>}
    {view === 'catalogue' && <>{mode === 'SAMPLE' && <><DatasetUsageRegister/><SupportingProgrammePortfolio/></>}<section className="readiness-layout">
      <article className="panel readiness-table-panel">
        <div className="catalogue-heading"><PanelTitle icon="database" title={mode === 'SAMPLE' ? 'Governed and documented catalogue' : 'Dataset readiness'} subtitle={mode === 'SAMPLE' ? `${readinessCatalogueStats.platformAvailable} datasets granted on the platform (per API docs) · ${readinessCatalogueStats.notProvisioned} further documented keys not yet provisioned` : 'Mode-isolated readiness evidence'}/><span className="catalogue-count">{filteredRows.length} / {readiness.rows.length}</span></div>
        <div className="catalogue-filters" aria-label="Catalogue filters">
          <label className="catalogue-search"><span className="sr-only">Search catalogue</span><Icon name="search" size={16}/><input aria-label="Search catalogue" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dataset, key, or field"/></label>
          <label><span className="sr-only">Filter by theme</span><select aria-label="Filter by theme" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="ALL">All themes</option>{themes.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
          <label><span className="sr-only">Filter by evidence state</span><select aria-label="Filter by evidence state" value={evidence} onChange={(event) => setEvidence(event.target.value)}><option value="ALL">All evidence</option>{evidenceStates.map((value) => <option value={value} key={value}>{sentenceCase(value)}</option>)}</select></label>
          <label><span className="sr-only">Filter by eligibility</span><select aria-label="Filter by eligibility" value={eligibility} onChange={(event) => setEligibility(event.target.value)}><option value="ALL">All eligibility</option>{eligibilityStates.map((value) => <option value={value} key={value}>{sentenceCase(value)}</option>)}</select></label>
        </div>
        <div className="table-scroll catalogue-table"><table><thead><tr><th>Dataset</th><th>Theme</th><th>Fields</th><th>Schema</th><th>Snapshot</th><th>Join readiness</th><th>Intelligence eligibility</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.tableKey} className={row.snapshotComplete ? 'representative-row' : ''}><td><div className="dataset-name"><b>{row.dataset}</b><span>{row.programme} · {row.snapshotComplete ? 'Complete governed snapshot' : row.sourceState.includes('INGESTION PENDING') ? 'Documented · ingestion pending' : typeof row.liveRowCount === 'number' ? `Live · ${row.liveRowCount.toLocaleString('en-IN')} rows · complete pull pending` : 'Retrieval unavailable'}</span></div><code>{row.tableKey}</code></td><td>{row.theme}</td><td><details className="field-details"><summary>{row.fields} fields</summary><div>{row.columns.map((column) => <code key={column}>{column}</code>)}</div></details></td><td><ReadinessBadge value={row.publicSchema}/></td><td><div className="snapshot-cell"><ReadinessBadge value={row.payloadEvidence}/><small>{row.period}</small></div></td><td><ReadinessBadge value={row.joinReadiness}/></td><td><ReadinessBadge value={row.eligibility}/></td></tr>)}</tbody></table>{filteredRows.length === 0 && <div className="no-results">No catalogue entries match the selected filters.</div>}</div>
        <p className="table-note"><Icon name="info" size={16}/>A complete snapshot means pagination reconciled to the source total for the exported filter period. It does not by itself prove history, cross-dataset identity, or scoring eligibility.</p>
      </article>
      <aside className="panel gates-panel"><PanelTitle icon="target" title="Activation gates" subtitle="Requirements, not current capabilities"/><div className="gates-list">{readiness.gates.map((gate, index) => <div className={`gate gate-${gate.state}`} key={gate.title}><span className="gate-state"><Icon name={gate.state === 'met' ? 'check' : gate.state === 'blocked' ? 'alert' : 'clock'} size={18}/></span><span className="gate-index">{index + 1}</span><div><b>{gate.title}</b><small>{gate.detail}</small></div></div>)}</div></aside>
    </section>
    <section className="quality-strip"><WhyItem icon="database" title="Completeness" text="Pagination reconciled before use"/><WhyItem icon="clock" title="Timeliness" text="Source period, not ingestion date"/><WhyItem icon="shield" title="Schema validity" text="Strings parsed with quality flags"/><WhyItem icon="link" title="Evidence traceability" text="Every value retains provenance"/></section></>}
    {view === 'coverage' && <CoverageView mode={mode}/>} 
    {view === 'periods' && <PeriodsView mode={mode}/>} 
    {view === 'quality' && <QualityView mode={mode} gates={readiness.gates}/>} 
    <EvidenceLabel mode={mode}/>
  </>;
}

function DatasetUsageRegister() {
  const audit = getDatasetUsageAudit();
  const states: Array<{ id: 'primary' | 'supporting' | 'unavailable' | 'pending'; label: string; detail: string }> = [
    { id: 'primary', label: 'Core analytical use', detail: 'Drives a headline visual, funnel, registry, outcome view or review queue' },
    { id: 'supporting', label: 'Supporting analytical use', detail: 'Visible in reported history, programme portfolio or evidence coverage' },
    { id: 'unavailable', label: 'Authorized but unavailable', detail: 'No complete governed response retained' },
    { id: 'pending', label: 'Documented · ingestion pending', detail: 'Schema known; excluded from analytics until complete ingestion' },
  ];
  const counts = { primary: audit.primary, supporting: audit.supporting, unavailable: audit.unavailable, pending: audit.pending };
  const primaryDegrees = audit.primary/audit.total*360;
  const supportingDegrees = audit.supporting/audit.total*360;
  const unavailableDegrees = audit.unavailable/audit.total*360;
  return <article className="panel dataset-use-register">
    <header><PanelTitle icon="database" title="How the 33 documented datasets are used" subtitle="Every retained source now has a visible analytical or supporting role; sources without complete evidence remain gated"/><span className="usage-total"><b>{audit.used}</b> used <small>of {audit.total}</small></span></header>
    <div className="usage-register-overview">
      <div className="usage-orbit" style={{ background: `conic-gradient(#12a8a2 0 ${primaryDegrees}deg,#3478ed ${primaryDegrees}deg ${primaryDegrees+supportingDegrees}deg,#ef8f34 ${primaryDegrees+supportingDegrees}deg ${primaryDegrees+supportingDegrees+unavailableDegrees}deg,#8a65df ${primaryDegrees+supportingDegrees+unavailableDegrees}deg 360deg)` }}><span><b>33</b><small>documented datasets</small></span></div>
      <div className="usage-flow"><span><small>Documented</small><b>33</b></span><Icon name="arrow" size={18}/><span><small>Complete retained</small><b>29</b></span><Icon name="arrow" size={18}/><span className="used"><small>Visible use</small><b>29</b></span><div className="usage-branch"><em>16 core</em><em>13 supporting</em></div></div>
      <div className="usage-node-field" aria-label="33 dataset status nodes">{audit.rows.map((row) => <i key={row.tableKey} className={`node-${row.state}`} title={`${row.dataset}: ${row.usage}`}/>)}</div>
    </div>
    <div className="usage-groups">{states.map((state) => { const rows = audit.rows.filter((row) => row.state === state.id); return <details key={state.id} className={`usage-group usage-${state.id}`} open={state.id === 'primary'}><summary><span><i/><b>{state.label}</b><small>{state.detail}</small></span><strong>{counts[state.id]}</strong></summary><div>{rows.map((row) => <article key={row.tableKey}><span><b>{row.dataset}</b><small>{row.programme} · {row.theme}</small></span><p>{row.usage}</p><em>{row.records ? `${row.records.toLocaleString('en-IN')} rows · ${row.period}` : row.period}</em></article>)}</div></details>; })}</div>
    <footer><Icon name="info" size={15}/>“Used” means the retained source contributes to a visible deterministic analytical or evidence view. It does not mean the source is eligible for scoring.</footer>
  </article>;
}

function SupportingProgrammePortfolio() {
  const items = getSupportingProgrammePortfolio();
  return <article className="panel programme-portfolio">
    <header><PanelTitle icon="chart" title="Supporting Programme Portfolio" subtitle="Thirteen retained sources previously buried in the catalogue · latest governed period at original source grain"/><span className="portfolio-key"><i/>derived target coverage <em/>review condition</span></header>
    <div className="portfolio-matrix">{items.map((item) => { const issueCount = item.zeroTargets + item.aboveTargetRows + item.percentageConflicts; const width = Math.min(100, (item.coverage ?? 0)*100); return <article key={item.tableKey} className={issueCount ? 'has-review' : ''}><div><span><b>{item.label}</b><small>{item.grain} · {item.periodCount} period{item.periodCount === 1 ? '' : 's'}</small></span><strong>{formatPercent(item.coverage)}</strong></div><i><em style={{ width: `${Math.max(width,2)}%` }}/></i><footer><span>{compactMetric(item.achievement)} / {compactMetric(item.target)}</span>{issueCount ? <b><Icon name="alert" size={12}/>{issueCount} checks</b> : <b className="clear"><Icon name="check" size={12}/>reconciled</b>}</footer><details><summary>Evidence conditions</summary><p>{item.records} latest-period rows · {item.zeroTargets} zero targets · {item.aboveTargetRows} above target · {item.percentageConflicts} percentage conflicts</p></details></article>; })}</div>
    <p><Icon name="shield" size={15}/>Each bar is calculated within one source as aggregate achievement ÷ aggregate target and capped visually at 100%. It is not a composite or cross-programme score.</p>
  </article>;
}

function ReadinessMaturitySummary() {
  return <section className="readiness-maturity" aria-label="Product maturity path">
    <article className="ready"><span><Icon name="check" size={21}/></span><div><small>Ready now</small><h2>Operational review signals</h2><p>Authenticated access · 29 complete snapshots · descriptive operational analytics</p></div></article>
    <article className="review"><span><Icon name="alert" size={21}/></span><div><small>Needs review</small><h2>Gap Radar inputs</h2><p>Authoritative ULB crosswalk · aligned periods · schema inconsistencies</p></div></article>
    <article className="later"><span><Icon name="clock" size={21}/></span><div><small>Later</small><h2>Higher-order intelligence</h2><p>Real scoring · persistent bottlenecks · early warning · next-best-action</p></div></article>
  </section>;
}

function CoverageView({ mode }: { mode: DataMode }) {
  if (mode !== 'SAMPLE') return <ReadinessModeNotice mode={mode}/>;
  const data = getEntityCoverageMatrix();
  const breadth = getEntityEvidenceBreadth();
  const exactAll = data.rows.filter((row) => row.returnedCount === 6 && Object.values(row.states).every((state) => state === 'returned')).length;
  const qualityCandidates = data.rows.filter((row) => Object.values(row.states).some((state) => state === 'quality-issue')).length;
  const hasOperational = (row: (typeof data.rows)[number]) => (['eAuto', 'iswm', 'ihhl'] as const).some((key) => row.states[key] !== 'not-returned');
  const hasOutcome = (row: (typeof data.rows)[number]) => (['odf', 'gfc', 'rank'] as const).some((key) => row.states[key] !== 'not-returned');
  const outcomeCandidates = data.rows.filter(hasOutcome).length;
  const crossPeriodCandidates = data.rows.filter((row) => hasOperational(row) && hasOutcome(row)).length;
  const identityIssue = getDataQualityIssues().find((issue) => issue.id === 'identity');
  return <section className="coverage-view">
    <div className="analytics-kpis four coverage-kpis"><MiniKpi icon="building" label="Observed ULB-name candidates" value={data.candidateCount.toLocaleString('en-IN')} detail="not an official statewide count" tone="teal"/><MiniKpi icon="database" label="Datasets compared" value="6" detail="E-Auto, ISWM, IHHL, ODF, GFC, Rank" tone="blue"/><MiniKpi icon="target" label="Exact overlap candidates" value={exactAll.toLocaleString('en-IN')} detail="all six returned without a quality flag" tone="violet"/><MiniKpi icon="shield" label="Scoring eligible today" value="0" detail="evidence gates remain active" tone="orange"/></div>
    <div className="coverage-dashboard">
      <article className="panel coverage-panel"><div className="catalogue-heading"><PanelTitle icon="database" title="Evidence coverage matrix" subtitle="One row per observed ULB name. A blank means the source returned nothing, not a zero."/><span className="catalogue-count">Showing 12 of {data.candidateCount}</span></div><div className="table-scroll coverage-table"><table><thead><tr><th>ULB name as reported</th><th>District</th><th>E-Auto</th><th>ISWM</th><th>IHHL</th><th>ODF</th><th>GFC</th><th>Rank</th><th>Coverage</th></tr></thead><tbody>{data.rows.slice(0, 12).map((row) => <tr key={row.candidateKey}><td><b>{row.ulb}</b></td><td>{row.district}</td>{(['eAuto', 'iswm', 'ihhl', 'odf', 'gfc', 'rank'] as const).map((key) => <td key={key}><CoverageMark state={row.states[key]}/></td>)}<td><span className="coverage-score">{row.returnedCount} / 6</span></td></tr>)}</tbody></table></div><div className="coverage-legend"><span><CoverageMark state="returned"/> returned</span><span><CoverageMark state="not-returned"/> not returned</span><span><CoverageMark state="quality-issue"/> quality issue</span><small>These name matches have not been confirmed by anyone yet.</small></div></article>
      <aside className="coverage-side">
        <article className="panel overlap-panel"><PanelTitle icon="link" title="Overlap summaries" subtitle="Recomputed from retained records"/>{data.overlaps.map((item) => <div className="overlap-row" key={item.label}><span className="overlap-mark" style={{ '--overlap-tone': 'var(--teal)' } as React.CSSProperties}><i/><i/></span><span><b>{item.label}</b><small>{item.count} of {data.candidateCount} candidates</small></span><strong>{Math.round(item.count / data.candidateCount * 100)}%</strong><em><b style={{ width: `${item.count / data.candidateCount * 100}%` }}/></em></div>)}</article>
        <article className="panel blocker-panel"><PanelTitle icon="shield" title="Why not scored yet" subtitle="Current source-backed blockers"/><ScoringBlocker icon="link" label="Identity review missing" count={data.candidateCount} detail="candidate identities"/><ScoringBlocker icon="calendar" label="Periods not aligned" count={crossPeriodCandidates} detail="cross-period candidates"/><ScoringBlocker icon="building" label="Missing shared stable IDs" count={identityIssue?.count ?? 0} detail="retained snapshots"/><ScoringBlocker icon="clock" label="Outcome year mismatch" count={outcomeCandidates} detail="2024 outcome candidates"/><ScoringBlocker icon="alert" label="Quality issue" count={qualityCandidates} detail="candidate rows"/></article>
      </aside>
    </div>
    <EntityComparison/>
    <EvidenceCoverageGrid/>
    <EvidenceOverlapUpSet rows={data.rows}/>
    <article className="panel evidence-breadth-panel">
      <div className="catalogue-heading"><PanelTitle icon="database" title="Full operational evidence breadth" subtitle={`${breadth.sourceCount} ULB-grain operational sources · normalized district and name candidates only`}/><span className="catalogue-count">{breadth.candidateCount} candidates</span></div>
      <div className="breadth-layout"><div className="breadth-distribution"><h3>How many sources return each candidate?</h3><div>{breadth.distribution.map((item) => <span key={item.sourceCount}><b>{item.sourceCount}</b><i><em style={{ height: `${Math.max(8, item.candidates / Math.max(...breadth.distribution.map((entry) => entry.candidates)) * 100)}%` }}/></i><small>{item.candidates}</small></span>)}</div></div><div className="breadth-candidates"><h3>Evidence-rich candidates</h3>{breadth.topCandidates.slice(0, 6).map((candidate) => <details key={candidate.candidateKey}><summary><span><b>{candidate.ulb}</b><small>{candidate.district}</small></span><strong>{candidate.sourceCount} / {breadth.sourceCount}</strong></summary><p>{candidate.sources.join(' · ')}</p></details>)}</div></div>
      <p className="table-note"><Icon name="info" size={15}/>Breadth indicates where evidence was returned. It is not completeness, performance, official identity, or scoring eligibility.</p>
    </article>
  </section>;
}

/**
 * Pin a handful of registry entities and read them across every ULB-grain source at once.
 * Previously an entity could only be seen alone in Diagnostics, or lost in a statewide
 * table — there was nothing in between, which is the view a reviewer actually wants.
 */
function EntityComparison() {
  const decisions = useSyncExternalStore(subscribeDecisions, readDecisions, serverDecisions);
  const aliases = useMemo(() => approvedAliases(decisions), [decisions]);
  const grid = useMemo(() => getEvidenceCoverageGrid(aliases), [aliases]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(grid.rows.map((row) => [row.ulbId, row])), [grid]);
  const matches = query.trim().length === 0 ? [] : grid.rows
    .filter((row) => !pinned.includes(row.ulbId)
      && `${row.ulb} ${row.district}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 6);

  const rows = pinned.map((id) => byId.get(id)).filter(Boolean) as typeof grid.rows;
  const add = (id: string) => { if (pinned.length < 6) setPinned([...pinned, id]); setQuery(''); };

  return <article className="panel entity-comparison">
    <div className="catalogue-heading">
      <PanelTitle icon="building" title="Compare entities" subtitle="Pin up to six registry entities and read them across every ULB-grain source"/>
      <span className="catalogue-count">{pinned.length} / 6 pinned</span>
    </div>

    <div className="compare-search">
      <label>
        <span className="sr-only">Search registry entities</span>
        <input type="search" value={query} placeholder="Search a ULB or district…" onChange={(event) => setQuery(event.target.value)} disabled={pinned.length >= 6}/>
      </label>
      {matches.length > 0 && <div className="compare-matches">{matches.map((row) => <button key={row.ulbId} onClick={() => add(row.ulbId)}>
        <b>{row.ulb.toLowerCase()}</b><small>{row.district.toLowerCase()}</small>
      </button>)}</div>}
      {pinned.length >= 6 && <span className="compare-limit">Six is the limit; remove one to add another.</span>}
    </div>

    {rows.length === 0
      ? <p className="compare-empty">Search above to pin entities. Comparison shows which sources returned evidence for each — it is not a ranking, and the sources are not comparable to one another.</p>
      : <div className="table-scroll"><table className="compare-table">
        <thead><tr><th>Source</th>{rows.map((row) => <th key={row.ulbId} className="compare-entity">
          <b>{row.ulb.toLowerCase()}</b><small>{row.district.toLowerCase()}</small>
          <button onClick={() => setPinned(pinned.filter((id) => id !== row.ulbId))} aria-label={`Remove ${row.ulb}`}>×</button>
        </th>)}</tr></thead>
        <tbody>
          {grid.sources.map((source, index) => <tr key={source.tableKey}>
            <td className="compare-source">{source.label}</td>
            {rows.map((row) => <td key={row.ulbId} className="compare-cell">
              <CoverageMark state={row.cells[index] === 'recovered' ? 'returned' : row.cells[index]}/>
              {row.cells[index] === 'recovered' && <i className="recovered-dot" title="Recovered by an approved name match"/>}
            </td>)}
          </tr>)}
          <tr className="compare-total">
            <td>Sources returning evidence</td>
            {rows.map((row) => <td key={row.ulbId}><b>{row.returned}</b> / {grid.sources.length}</td>)}
          </tr>
        </tbody>
      </table></div>}
    <p className="table-note"><Icon name="info" size={15}/>A blank cell means that source returned no row for the entity. It is never a reported zero, and breadth is not performance.</p>
  </article>;
}

function EvidenceCoverageGrid() {
  const decisions = useSyncExternalStore(subscribeDecisions, readDecisions, serverDecisions);
  const aliases = useMemo(() => approvedAliases(decisions), [decisions]);
  const grid = useMemo(() => getEvidenceCoverageGrid(aliases), [aliases]);
  const [hovered, setHovered] = useState<string>('');
  const absentPercent = Math.round((grid.totals.absent / grid.totals.cells) * 100);
  return <article className="panel coverage-grid-panel">
    <div className="catalogue-heading">
      <PanelTitle icon="database" title="Anchored coverage grid" subtitle={`${grid.rows.length} registry entities × ${grid.sources.length} ULB-grain sources · every cell traces to a retained governed row`}/>
      <span className="catalogue-count">{grid.totals.cells.toLocaleString('en-IN')} observations</span>
    </div>
    <div className="grid-totals">
      <div><b>{grid.totals.returned.toLocaleString('en-IN')}</b><small>returned</small></div>
      <div><b>{grid.totals.flagged.toLocaleString('en-IN')}</b><small>returned with a quality condition</small></div>
      <div className="total-absent"><b>{grid.totals.absent.toLocaleString('en-IN')}</b><small>never returned — {absentPercent}% of the grid</small></div>
      <div className="total-recovered"><b>{grid.totals.recovered.toLocaleString('en-IN')}</b><small>{grid.totals.recovered === 0 ? 'recoverable by approving name matches' : 'recovered by your approved crosswalk'}</small></div>
    </div>
    {grid.totals.recovered === 0
      ? <p className="grid-prompt"><Icon name="link" size={16}/><span>These cells are blank because the source spells the entity differently, not because the evidence is missing. Approve name matches in the <a href={withMode('/gap-radar', 'SAMPLE', 'light')}>crosswalk workbench</a> and they fill in here.</span></p>
      : <p className="grid-prompt is-recovered"><Icon name="check" size={16}/><span><b>{grid.totals.recovered} observations recovered.</b> These were unreachable until you approved the name matches that connect them. They are marked below.</span></p>}
    <div className="grid-scroll">
      <div className="coverage-grid" style={{ gridTemplateColumns: `132px repeat(${grid.sources.length}, minmax(9px, 1fr))` }}>
        <span className="grid-corner"/>
        {grid.sources.map((source) => <span className="grid-head" key={source.tableKey} title={source.tableKey}>{source.label}</span>)}
        {grid.rows.map((row) => <Fragment key={row.ulbId}>
          <span className="grid-label" title={`${row.ulb} — ${row.district}`}>{row.ulb.toLowerCase()}</span>
          {row.cells.map((cell, index) => <i
            key={grid.sources[index].tableKey}
            className={`grid-cell cell-${cell}`}
            onMouseEnter={() => setHovered(`${row.ulb} · ${grid.sources[index].label} · ${cell === 'returned' ? 'returned' : cell === 'quality-issue' ? 'returned, quality condition' : cell === 'recovered' ? 'recovered by an approved name match' : 'not returned'}`)}
          />)}
        </Fragment>)}
      </div>
    </div>
    <div className="grid-legend">
      <span><i className="cell-returned"/>Returned</span>
      <span><i className="cell-quality-issue"/>Returned, quality condition</span>
      <span><i className="cell-recovered"/>Recovered by an approved match</span>
      <span><i className="cell-not-returned"/>Not returned — never zero</span>
      <b className="grid-readout">{hovered || '\u00a0'}</b>
    </div>
    <p className="table-note"><Icon name="info" size={15}/>An empty cell means the source returned no row for that registry entity. It is not a reported zero, and it is not evidence of absence in the world.</p>
  </article>;
}

function EvidenceOverlapUpSet({ rows }: { rows: ReturnType<typeof getEntityCoverageMatrix>['rows'] }) {
  const sources = [
    ['eAuto', 'E-Auto'], ['iswm', 'ISWM'], ['ihhl', 'IHHL'], ['odf', 'ODF'], ['gfc', 'GFC'], ['rank', 'Rank'],
  ] as const;
  const patterns = [...rows.reduce<Map<string, number>>((map, row) => {
    const signature = sources.map(([key]) => row.states[key] !== 'not-returned' ? '1' : '0').join('');
    map.set(signature, (map.get(signature) ?? 0) + 1);
    return map;
  }, new Map()).entries()].map(([signature, count]) => ({ signature, count })).sort((left,right) => right.count-left.count || right.signature.localeCompare(left.signature)).slice(0,8);
  const max = Math.max(...patterns.map((item) => item.count),1);
  return <article className="panel overlap-upset">
    <header><PanelTitle icon="link" title="Evidence Intersection Map" subtitle="The eight most common exact returned/not-returned combinations across six major sources"/><span><b>{patterns.length}</b> largest intersections</span></header>
    <div className="upset-layout">
      <div className="upset-source-labels">{sources.map(([,label]) => <span key={label}>{label}</span>)}</div>
      <div className="upset-columns">{patterns.map((pattern,index) => { const active = [...pattern.signature].map((value,sourceIndex) => value === '1' ? sourceIndex : -1).filter((value) => value >= 0); const first = active[0] ?? 0; const last = active[active.length-1] ?? first; return <div key={pattern.signature} className="upset-column"><div className="upset-bar"><b style={{ height: `${Math.max(8,pattern.count/max*100)}%` }}/><strong>{pattern.count}</strong></div><div className="upset-dots"><i className="upset-link" style={{ top: `${first*26+8}px`, height: `${Math.max(0,(last-first)*26)}px` }}/>{sources.map(([,label],sourceIndex) => <span key={label} className={pattern.signature[sourceIndex] === '1' ? 'active' : ''}/>)}</div><small>{index+1}</small></div>; })}</div>
    </div>
    <footer><Icon name="info" size={15}/>An intersection means the same normalized district/name candidate was returned by those sources. It is not a reviewed identity match, completeness score, or performance result.</footer>
  </article>;
}

function ScoringBlocker({ icon, label, count, detail }: { icon: IconName; label: string; count: number; detail: string }) {
  return <div className="scoring-blocker"><span><Icon name={icon} size={16}/></span><div><b>{label}</b><small>{detail}</small></div><strong>{count.toLocaleString('en-IN')}</strong></div>;
}

function CoverageMark({ state }: { state: CoverageState }) {
  return <span className={`coverage-mark ${state}`} aria-label={state === 'returned' ? 'Returned' : state === 'quality-issue' ? 'Quality issue' : 'Not returned'}>{state === 'returned' ? '✓' : state === 'quality-issue' ? '⚠' : '—'}</span>;
}

const monthInitials = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function PeriodsView({ mode }: { mode: DataMode }) {
  if (mode !== 'SAMPLE') return <ReadinessModeNotice mode={mode}/>;
  const rows = getDatasetPeriodAvailability();
  return <article className="panel period-panel"><div className="catalogue-heading"><PanelTitle icon="calendar" title="Period availability" subtitle="Marked only when a governed response for that filter period was retained"/><span className="catalogue-count">29 retrieved</span></div><div className="table-scroll period-table"><table><thead><tr><th>Dataset</th><th>2024</th><th>2025</th><th>2026</th>{monthInitials.map((month) => <th key={month}>{month}</th>)}<th>Quality</th></tr></thead><tbody>{rows.map((row) => <tr key={row.tableKey}><td><b>{row.dataset}</b><small className="cell-sub">{row.period}</small></td>{[2024, 2025, 2026].map((year) => <td key={year}>{row.years.includes(year) ? <CoverageMark state="returned"/> : <CoverageMark state="not-returned"/>}</td>)}{monthInitials.map((_, index) => <td key={index}>{row.months.includes(index + 1) ? <CoverageMark state={row.conflict ? 'quality-issue' : 'returned'}/> : <CoverageMark state="not-returned"/>}</td>)}<td><ReadinessBadge value={!row.retrieved ? 'Unavailable' : row.conflict ? 'Period conflict' : 'Retrieved'}/></td></tr>)}</tbody></table></div><p className="table-note"><Icon name="info" size={15}/>Catalogue frequency, snapshot-generation timestamps, and inserted dates do not create historical availability.</p></article>;
}

/**
 * S5, the disputed-value mark. Two hollow dots joined by a bar spanning the
 * contested range, with a solid tick where the aggregate currently sits.
 *
 * A filled point would assert a value the evidence does not support. The bar is
 * the finding: somewhere in that span is the real number, and nothing in the
 * data says where.
 */
function DisputeMark({ values, counted }: { values: number[]; counted: number }) {
  const low = Math.min(...values), high = Math.max(...values);
  const span = high - low || 1;
  const at = (value: number) => 6 + ((value - low) / span) * 88;
  const countedOff = counted > high;
  return <svg className="dispute-mark" viewBox="0 0 100 20" role="img"
    aria-label={`Reported as ${values.join(' or ')}; the total currently counts ${counted}`}>
    <line className="dm-span" x1={at(low)} y1="10" x2={at(high)} y2="10"/>
    <circle className="dm-end" cx={at(low)} cy="10" r="3.6"/>
    <circle className="dm-end" cx={at(high)} cy="10" r="3.6"/>
    {!countedOff && <line className="dm-counted" x1={at(counted)} y1="4" x2={at(counted)} y2="16"/>}
    {countedOff && <g className="dm-over"><line x1={at(high) + 4} y1="10" x2="96" y2="10"/><path d="M92 6 L97 10 L92 14"/></g>}
  </svg>;
}

/** The disputed-value workspace. Nothing here can be resolved from the data alone. */
function DisputedValues() {
  const { groups, datasets, total } = getDisputedValues();
  if (!total) return null;
  return <article className="panel disputed-panel">
    <div className="catalogue-heading">
      <PanelTitle icon="alert" title="Disputed values" subtitle="The same place and period reported twice, with different numbers"/>
      <span className="catalogue-count">{total} across {datasets} datasets</span>
    </div>
    <p className="disputed-lede">
      Both rows survive deduplication and both reach the total, so each of these entities is counted twice.
      With no record ID, submission date or revision number, neither row is newer or better sourced.
      <b> These need a person, not a rule.</b>
    </p>
    <ul className="disputed-list">{groups.map((group) => {
      const field = group.fields[0];
      const impact = disputedSumImpact(group, field.field);
      return <li key={`${group.tableKey}-${group.district}-${group.entity}-${group.period}`}>
        <div className="dv-who">
          <b>{group.entity || group.district}</b>
          <small>{group.dataset} · period {group.period}</small>
        </div>
        <code className="dv-field">{field.field}</code>
        <div className="dv-values">{field.values.map((value) => <span key={value}>{value}</span>)}</div>
        {impact && <DisputeMark values={[impact.low, impact.high]} counted={impact.counted}/>}
        {impact && <div className="dv-impact"><b>{impact.counted.toLocaleString('en-IN')}</b><small>counted, should be {impact.low.toLocaleString('en-IN')}–{impact.high.toLocaleString('en-IN')}</small></div>}
      </li>;
    })}</ul>
  </article>;
}

function QualityView({ mode, gates }: { mode: DataMode; gates: ReturnType<ReturnType<typeof createProvider>['getReadiness']>['gates'] }) {
  if (mode !== 'SAMPLE') return <ReadinessModeNotice mode={mode}/>;
  const issues = getDataQualityIssues();
  const reconciliation = getSourceReconciliationIssues();
  return <section className="quality-workspace">
    <ReviewInbox/>
    <DisputedValues/>
    <EvidenceVintagePanel/>
    <article className="panel reconciliation-panel"><div className="catalogue-heading"><PanelTitle icon="shield" title="Evidence reconciliation workspace" subtitle="Fixed rules that flag records for review. No model, nothing predicted."/><span className="catalogue-count">{reconciliation.reduce((total, issue) => total + issue.count, 0).toLocaleString('en-IN')} flags</span></div><div className="reconciliation-grid">{reconciliation.map((issue) => <article className={`reconciliation-card issue-${issue.severity}`} key={issue.id}><span><Icon name={issue.severity === 'info' ? 'info' : 'alert'} size={18}/></span><div><small>{issue.rule}</small><strong>{issue.count.toLocaleString('en-IN')}</strong><h3>{issue.title}</h3><p>{issue.detail}</p></div></article>)}</div></article>
    <div className="quality-view-grid"><article className="panel"><PanelTitle icon="database" title="All retained evidence conditions" subtitle="What is missing, what conflicts, and what needs a decision"/><details className="all-quality-details"><summary>View {issues.length} evidence-quality conditions</summary><div className="issue-grid">{issues.map((issue) => <div className={`issue-card issue-${issue.severity}`} key={issue.id}><span><Icon name={issue.severity === 'info' ? 'info' : 'alert'} size={18}/></span><div><b>{issue.title}</b><strong>{issue.count}</strong><small>{issue.detail}</small></div></div>)}</div></details></article><aside className="panel maturity-panel"><PanelTitle icon="target" title="Activation details" subtitle="Technical evidence requirements"/><details className="gate-details" open><summary>Review activation gates</summary>{gates.map((gate) => <p key={gate.title}><b>{gate.title}</b><span>{gate.detail}</span></p>)}</details></aside></div>
  </section>;
}

function ReviewInbox() {
  const items = useMemo(() => getReviewInbox(), []);
  const triage = useSyncExternalStore(subscribeTriage, readTriage, serverTriage);
  const [showDone, setShowDone] = useState(false);

  const state = (item: InboxItem): TriageState => triage[item.id] ?? 'open';
  const set = (item: InboxItem, next: TriageState) => {
    const updated = { ...triage };
    if (next === 'open') delete updated[item.id];
    else updated[item.id] = next;
    writeTriage(updated);
  };

  const open = items.filter((item) => state(item) === 'open');
  const visible = showDone ? items : open;
  const flagged = open.reduce((total, item) => total + item.count, 0);
  const blocked = open.filter((item) => item.severity === 'blocked').length;

  return <article className="panel review-inbox">
    <div className="catalogue-heading">
      <PanelTitle icon="alert" title="Review inbox" subtitle="Every check in one list, most serious first. Fixed rules only, nothing inferred."/>
      <span className="catalogue-count">{open.length} open</span>
    </div>
    <div className="inbox-summary">
      <div><b>{open.length}</b><small>conditions awaiting review</small></div>
      <div><b>{flagged.toLocaleString('en-IN')}</b><small>records flagged across them</small></div>
      <div className={blocked > 0 ? 'inbox-blocked' : ''}><b>{blocked}</b><small>block activation until resolved</small></div>
    </div>
    <label className="inbox-toggle"><input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)}/> Show acknowledged and resolved</label>
    {visible.length === 0
      ? <p className="inbox-empty">Every condition has been triaged. Nothing is outstanding.</p>
      : <ul className="inbox-list">{visible.map((item) => {
        const current = state(item);
        return <li key={item.id} className={`inbox-item sev-${item.severity} triage-${current}`}>
          <span className="inbox-count"><b>{item.count.toLocaleString('en-IN')}</b><small>{item.count === 1 ? 'record' : 'records'}</small></span>
          <div className="inbox-body">
            <div className="inbox-head"><b>{item.title}</b><span className={`sev-chip sev-${item.severity}`}>{item.severity}</span></div>
            <p>{item.detail}</p>
            <p className="inbox-rule"><Icon name="shield" size={13}/><span><b>What triggered this:</b> {item.rule}</span></p>
            <span className="inbox-where">Inspect in {item.screen}</span>
          </div>
          <div className="inbox-actions">
            {current !== 'open' && <span className={`triage-state triage-${current}`}>{current}</span>}
            {current === 'open' && <button onClick={() => set(item, 'acknowledged')}>Acknowledge</button>}
            {current !== 'resolved' && <button onClick={() => set(item, 'resolved')}>Resolved</button>}
            {current !== 'open' && <button className="undo" onClick={() => set(item, 'open')}>Reopen</button>}
          </div>
        </li>;
      })}</ul>}
    <p className="table-note"><Icon name="info" size={15}/>Marking something here is just a note to yourself. It does not change the data or unblock anything.</p>
  </article>;
}

function EvidenceVintagePanel() {
  const [open, setOpen] = useState(false);
  return <article className="panel vintage-panel">
    <div className="catalogue-heading">
      <PanelTitle icon="clock" title="Retained evidence vintage" subtitle="Every value on this screen describes the snapshots as retrieved, not the source as it stands now"/>
      <span className="catalogue-count">{formatRetrievalDate(vintageSummary.latestRetrieval)}</span>
    </div>
    <div className="vintage-stats">
      <div><b>{vintageSummary.datasets}</b><small>datasets fingerprinted</small></div>
      <div><b>{vintageSummary.periods}</b><small>reported periods hashed</small></div>
      <div><b>{vintageSummary.multiPeriodDatasets}</b><small>span more than one period</small></div>
      <div><b>{vintageSummary.rows.toLocaleString('en-IN')}</b><small>rows covered</small></div>
    </div>
    <p className="vintage-note"><Icon name="alert" size={16}/><span><b>Row-count reconciliation cannot detect a re-dated row.</b> A source revision that moves records between reported periods leaves <GlossaryText text="totalRecordCount"/>, pagination and local row counts identical. Each period is therefore hashed on its content and its entity set, and <code>npm run validate:data</code> fails if a later retrieval no longer matches this vintage.</span></p>
    <details className="vintage-details" open={open} onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
      <summary>Per-dataset period fingerprints</summary>
      <div className="vintage-table-wrap">
        <table className="vintage-table">
          <thead><tr><th>Dataset</th><th>Retrieved</th><th>Rows</th><th>Reported periods</th></tr></thead>
          <tbody>{datasetVintages.map((item) => <tr key={item.tableKey}>
            <td><code>{item.tableKey}</code></td>
            <td>{formatRetrievalDate(item.retrievedAt)}</td>
            <td className="vintage-num">{item.rows.toLocaleString('en-IN')}</td>
            <td><span className="vintage-periods">{item.periods.map((period) => <span key={period.period}><b>{formatPeriodLabel(period.period)}</b><i>{period.rows}</i><em>{period.content.slice(0, 8)}</em></span>)}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </article>;
}

function ReadinessModeNotice({ mode }: { mode: DataMode }) {
  return <article className="panel analytics-placeholder"><Icon name={mode === 'LIVE' ? 'link' : 'info'} size={30}/><h2>{mode === 'LIVE' ? 'Live connector — on the roadmap' : 'Coverage view is isolated to authenticated governed evidence'}</h2><p>{mode === 'LIVE' ? 'The planned on-demand pull is not yet enabled; Governed data shows the same sources today.' : 'Switch to Governed data to inspect the retained governed responses.'}</p></article>;
}

function sentenceCase(value: string) {
  return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function ReadinessBadge({ value }: { value: string }) {
  const tone = /demo|eligible|ready|verified|excerpt|complete/i.test(value) ? 'good' : /pending|required|mismatch|unscored|error|unavailable/i.test(value) ? 'warn' : 'neutral';
  return <span className={`readiness-badge ${tone}`}><GlossaryText text={sentenceCase(value)}/></span>;
}
