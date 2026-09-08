'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { getOverviewIssues, type ReviewIssueId } from '@/lib/overview';
import { getReportedMovements } from '@/lib/analytics';
import { anchorRegistry, sameDistrict } from '@/lib/crosswalk';
import { readinessCatalogueStats } from '@/lib/catalogue';
import { governedSnapshotStats } from '@/lib/snapshots';
import { datasets, diagnosticsKeyFor } from '@/lib/domain';
import './overview-review.css';

const format = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 1 });
const short = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : format(value);
const Arrow = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;
const expand = (name: string) => name.toUpperCase().replace(/[^A-Z]/g, '') === 'SPSRNELLORE' ? 'SRI POTTI SRIRAMULU NELLORE' : name;

export function OverviewReview({ shapes, failed, href, integrity, children }: {
  shapes: Array<{ d: string; path: string }> | null;
  failed: boolean;
  href: (path: string) => string;
  /** Evidence-about-evidence, shown in the main flow rather than the methods note. */
  integrity?: ReactNode;
  children?: ReactNode;
}) {
  const issues = useMemo(() => getOverviewIssues(), []);
  const movements = useMemo(() => getReportedMovements(), []);
  const [selected, setSelected] = useState<ReviewIssueId>('sanitation');
  const [district, setDistrict] = useState('');
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const active = issues.find((issue) => issue.id === selected)!;
  const movement = movements.find((item) => item.id === selected)!;
  const districts = [...new Set(active.rows.map((row) => row.district))].sort();
  const scope = district ? active.rows.filter((row) => row.district === district) : active.rows;
  const ranked = scope.filter((row) => row.value > 0);
  const visible = ranked.slice(0, showAll ? ranked.length : 5);
  const total = scope.reduce((sum, row) => sum + row.value, 0);
  const topTotal = ranked.slice(0, 5).reduce((sum, row) => sum + row.value, 0);
  const share = total > 0 ? topTotal / total : null;
  const districtValues = districts.map((name) => ({
    name, value: active.rows.filter((row) => row.district === name).reduce((sum, row) => sum + row.value, 0),
  }));
  const maxDistrict = Math.max(...districtValues.map((item) => item.value), 1);
  // A boundary attaches only when exactly one source district label matches.
  // Ambiguous or unrepresented labels stay available in the district picker.
  const match = (name: string) => {
    const matches = districtValues.filter((item) => sameDistrict(expand(item.name), expand(name)));
    return matches.length === 1 ? matches[0] : null;
  };
  const offMap = shapes ? districtValues.filter((item) => !shapes.some((shape) => match(shape.d)?.name === item.name)) : [];
  const chooseDistrict = (name: string) => { setDistrict(name); setShowAll(false); };
  const chooseOnMap = (name: string) => {
    chooseDistrict(name);
    if (window.innerWidth <= 760) listRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const changed = movement.increased + movement.decreased;
  const movementText = changed > 0
    ? `${movement.decreased} lower · ${movement.increased} higher · ${movement.unchanged} unchanged`
    : `All ${movement.matched} matched ULBs repeated the same reported value.`;
  const scopeName = district || 'All returned districts';

  return <div className="overview-review" data-issue={selected}>
    <header className="or-intro">
      <div><span className="or-kicker">SASA Intelligence Lab / Overview</span><h1>The operational picture.</h1></div>
      <a className="or-edition" href={href('/data-readiness')}><span>GOVERNED EVIDENCE</span><b>2026 operational review <Arrow/></b></a>
    </header>

    <section className="or-workspace" aria-label="Connected district and ULB review">
      <div className="or-stage">
        <div className="or-story" key={selected}>
          <div className="or-story-top"><span>0{issues.indexOf(active) + 1} / REVIEW FOCUS</span><span>{active.period}</span></div>
          <h2>{active.title}</h2>
          <div className="or-hero-value" title={format(total)}>{scope.length ? short(total) : 'Not returned'}</div>
          <p className="or-hero-unit">{active.quantity}</p>
          <div className="or-hero-scope"><i/>{scopeName}</div>
          <div className="or-hero-insight">
            <span>THE CONCENTRATION</span>
            <p>{share !== null ? <><b>{Math.round(share * 100)}%</b> of this reported shortfall sits with <b>{Math.min(5, ranked.length)} ULBs.</b></> : scope.length ? 'No positive shortfall in usable records.' : 'No usable evidence in this selection.'}</p>
            <small>{share !== null ? `${format(topTotal)} of ${format(total)} ${active.unit} · selected scope` : 'Absence is never counted as zero.'}</small>
          </div>
          <div className="or-hero-basis"><span>SOURCE-WIDE REPORTED PROGRESS</span><p>{format(active.completed)} {active.completedLabel}<b> / </b>{format(active.basis)} {active.basisLabel}</p><div aria-hidden="true"><i style={{ width: `${active.basis > 0 ? Math.min(100, active.completed / active.basis * 100) : 0}%` }}/></div><small>{active.rows.length} / {anchorRegistry.length} observed ULB-name candidates usable · {active.excluded} held out</small></div>
        </div>
        <div className="or-geography">
          <div className="or-map-heading"><div><span>Andhra Pradesh</span><b>Tap the map to focus the evidence</b></div><label><span className="sr-only">District</span><select aria-label="Review district" value={district} onChange={(event) => chooseDistrict(event.target.value)}><option value="">All returned districts</option>{districts.map((name) => <option key={name}>{name}</option>)}</select></label></div>
          <div className="or-map">
            {shapes ? <svg viewBox="0 0 560 470" role="group" aria-label={`District map: ${active.quantity}`}>
              <defs><pattern id="or-absent" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--absence-ink)" strokeWidth="1"/></pattern></defs>
              {shapes.map((shape) => {
                const entry = match(shape.d);
                return <path key={shape.d} d={shape.path} fill={entry ? `color-mix(in srgb, var(--stage-accent) ${16 + Math.sqrt(entry.value / maxDistrict) * 74}%, #123c42)` : 'url(#or-absent)'} className={entry?.name === district ? 'is-selected' : ''} role={entry ? 'button' : undefined} tabIndex={entry ? 0 : undefined} aria-pressed={entry ? entry.name === district : undefined} aria-label={entry ? `${entry.name}: ${format(entry.value)} ${active.unit}` : `${shape.d}: no uniquely matched usable district evidence`} onClick={() => { if (entry) chooseOnMap(district === entry.name ? '' : entry.name); }} onKeyDown={(event) => { if (entry && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); chooseOnMap(district === entry.name ? '' : entry.name); } }}><title>{entry ? `${entry.name}: ${format(entry.value)} ${active.unit}` : `${shape.d}: no uniquely matched usable evidence`}</title></path>;
              })}
            </svg> : <p className="or-map-fallback">{failed ? 'Map unavailable. Use the district picker to explore every retained label.' : 'Loading district boundaries…'}</p>}
          </div>
          <div className="or-map-legend"><span>0</span><i/><span>{short(maxDistrict)} {active.unit}</span></div>
          <p className="or-map-note">Volume · square-root colour scale. Hatching: no uniquely matched usable evidence. 2022 boundaries; source district labels require review.</p>
          {offMap.length > 0 && <details className="or-offmap"><summary>{offMap.length} source labels without a unique map match</summary>{offMap.map((item) => <button key={item.name} onClick={() => chooseDistrict(item.name)}>{item.name}<b>{format(item.value)}</b></button>)}</details>}
        </div>

      </div>
      <section className="or-issues" aria-label="Operational review issues" aria-describedby="or-selector-basis">
        <p id="or-selector-basis" className="or-selector-basis">Choose a review focus <span>Totals across returned districts · source periods shown in the selected view</span></p>
        {issues.map((issue, index) => <button key={issue.id} type="button" aria-pressed={selected === issue.id} className={selected === issue.id ? 'is-selected' : ''} onClick={() => { setSelected(issue.id); chooseDistrict(''); }}>
          <span className="or-issue-index">0{index + 1}</span><span className="or-issue-copy"><b>{issue.title}</b><small>{issue.quantity}</small></span><strong>{issue.rows.length ? short(issue.total) : 'Not returned'}</strong><span className="or-issue-arrow" aria-hidden="true">↗</span>
        </button>)}
      </section>
      <div className="or-detail-layout">
        <aside className="or-focus-context">
          <span className="or-kicker">From scale to action</span>
          <h2>Start with <br/>the places behind <br/><em>the number.</em></h2>
          <p>Ranked by reported workload, not performance. Choose a ULB to inspect its evidence.</p>
          <div className="or-cohort-graphic" aria-label={`${ranked.length} of ${scope.length} usable ULBs report a positive shortfall`}>
            <div aria-hidden="true">{scope.map((row) => <i key={row.key} className={row.value > 0 ? 'is-open' : ''}/>)}</div>
            <b>{ranked.length}<span> / {scope.length} usable ULBs</span></b>
            <small>report a positive shortfall in this selection<br/>One square = one usable ULB.</small>
            <p><i/>Positive shortfall <i/>No positive shortfall</p>
          </div>
        </aside>
        <div className="or-review-list" ref={listRef}>
          <header className="or-workspace-head"><div><span className="or-kicker">Named review list</span><h2>{active.title}<span> / {scopeName}</span></h2></div><span className="or-list-count">{ranked.length} ULBs</span></header>
          <div className="or-list-caption"><span>ULB / reported shortfall</span><span>Largest volume first</span></div>
          <ol className="or-ranked" aria-label="ULBs in selected review scope">{visible.map((row, index) => {
            const key = diagnosticsKeyFor(row.ulb, row.district);
            const hasDiagnostic = datasets.SAMPLE.diagnostics.some((entry) => entry.ulbKey === key);
            return <li key={row.key}><span className="or-rank">{String(index + 1).padStart(2, '0')}</span><div className="or-row-name"><b>{row.ulb}</b><small>{row.district}</small><i aria-hidden="true"><em style={{ width: `${row.value / (ranked[0]?.value || 1) * 100}%` }}/></i></div><div className="or-row-value"><strong>{format(row.value)}</strong><small>{active.unit}</small></div>{hasDiagnostic ? <a href={href(`/diagnostics/${key}`)} aria-label={`Inspect ${row.ulb} evidence`}><Arrow/></a> : <span className="or-unmatched" title="No diagnostics page for this source name">Name review</span>}</li>;
          })}</ol>
          {ranked.length === 0 && <p className="or-no-gap">{scope.length ? 'Usable records in this selection report no positive shortfall.' : 'No usable measurements in this selection. Missing evidence is not zero.'}</p>}
          <div className="or-list-actions">{ranked.length > 5 && <button onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>{showAll ? 'Show top five' : `Browse all ${ranked.length} ULBs`}</button>}<a href={`${href('/operational-analytics')}&tab=${selected}`}>Open full analysis <Arrow/></a></div>
        </div>
      </div>

      <footer className="or-source-line"><span><b>{active.period}</b> · {active.source}</span><span>{active.rows.length} usable of {anchorRegistry.length} observed ULB-name candidates · {active.excluded} held out</span></footer>
    </section>

    <section className="or-interpretation" aria-label="Movement and interpretation">
      <a className="or-movement" href={`${href('/operational-analytics')}&tab=${selected}&view=movement`}><div><span className="or-kicker">Across this source / {movement.metricLabel}</span><h3>{changed ? `${changed} matched ULB values changed` : 'The reported values repeated'}</h3><p>{movementText}</p><small>{movement.previousPeriod} → {movement.currentPeriod} · {movement.matched} comparable pairs · {movement.excluded} held out</small></div><Arrow/></a>
      <div className="or-reading"><span className="or-kicker">Read this correctly</span><p>{active.boundary}</p><small>Unchanged reports do not prove inactivity. Two periods do not establish a persistent trend.</small></div>
    </section>

    <section className="or-readiness" aria-label="Evidence scope and decision boundary"><div><span className="or-kicker">Ready for descriptive review</span><p><b>{governedSnapshotStats.completeDatasets}</b> complete datasets <span> / {readinessCatalogueStats.platformAvailable} granted</span> · {format(governedSnapshotStats.records)} retained rows</p><small>{anchorRegistry.length} observed ULB-name candidates provide a working reference, not an official statewide denominator.</small></div><a href={href('/gap-radar')}><span>Scoring remains</span><b>UNSCORED</b><small>Inspect activation gates →</small></a></section>
    {integrity}
    <div className="or-context-links"><a href={`${href('/operational-analytics')}&tab=processing`}><span>Supporting evidence</span><b>Processing facilities & source statuses</b><Arrow/></a><a href={`${href('/operational-analytics')}&tab=outcomes`}><span>Historical context / 2024</span><b>Swachh outcomes & reported ranks</b><Arrow/></a></div>
    <details className="or-audit"><summary>Methods & additional retained history <span>Source rules and community programmes</span></summary><div><p>{active.rows.length} ULB candidates have the fields needed for this issue. Missing or conflicting measurements are held out; genuine zeros stay in the cohort. Shortfalls are calculated per ULB before summing, so excess delivery in one ULB never cancels another ULB’s shortfall.</p><p>The map and ranking use the same eligible records. Concentration means the top five’s share of the selected source’s reported shortfall. Map matching does not approve a cross-source identity.</p>{children}</div></details>
  </div>;
}
