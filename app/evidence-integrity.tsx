'use client';

import { useMemo } from 'react';
import { getIdentityReach, getIhhlVintageCorroboration, getLgdCrosswalk } from '@/lib/lgd-crosswalk';
import { getDuplicateSourceSummary } from '@/lib/duplicate-sources';
import { governedSnapshotStats } from '@/lib/snapshots';
import './evidence-integrity.css';

const format = (value: number) => value.toLocaleString('en-IN');

/**
 * What the evidence itself is doing wrong, on the executive entry screen.
 *
 * Every other panel reports what the data says. This one reports what the data does to
 * itself: a supplied identity mapping that contradicts itself, and endpoints serving
 * rows another endpoint already returned. Both were found by this product rather than
 * declared by the platform, and both change how every number above should be read — so
 * they belong on the first screen, not buried in a methods note.
 */
export function EvidenceIntegrity({ href }: { href: (path: string) => string }) {
  const reach = useMemo(() => getIdentityReach(), []);
  const crosswalk = useMemo(() => getLgdCrosswalk(), []);
  const duplicates = useMemo(() => getDuplicateSourceSummary(), []);
  const corroboration = useMemo(() => getIhhlVintageCorroboration(), []);

  const findings = [
    {
      id: 'identity',
      value: crosswalk.selfContradictions.length,
      unit: crosswalk.selfContradictions.length === 1 ? 'district label' : 'district labels',
      title: 'The supplied identity mapping contradicts itself',
      detail: `Six retained datasets now carry LGD codes beside their departmental labels. ${crosswalk.selfContradictions.length} labels map to two different LGD districts inside a single source, and ${reach.disputed} entities carry codes two sources disagree about. The mapping reaches ${Math.round(reach.coverageRatio * 100)}% of observed entities and is not adopted as identity.`,
      href: href('/gap-radar'),
      cta: 'Inspect the mapping',
    },
    {
      id: 'duplicates',
      value: duplicates.redundantKeys,
      unit: duplicates.redundantKeys === 1 ? 'endpoint' : 'endpoints',
      title: 'Endpoints serving rows another endpoint already returned',
      detail: duplicates.groups.length
        ? `${duplicates.groups.map((group) => `${group.duplicates.join(', ')} repeats ${group.canonical}`).join('; ')}. ${format(duplicates.redundantRows)} rows would be counted twice if each key were treated as its own programme. Detected by comparing content, not names.`
        : 'No retained endpoint repeats another endpoint’s rows in this vintage.',
      href: `${href('/operational-analytics')}&tab=delivery`,
      cta: 'See the excluded copy',
    },
    {
      id: 'corroboration',
      value: corroboration.agreeing,
      unit: `of ${corroboration.compared} ULBs agree`,
      title: 'One programme, two independent returns, no disagreement',
      detail: `${corroboration.programme} is returned by both the August source and its September LGD reissue. Every one of the ${corroboration.compared} ULBs present in both reports identical approved, identified, under-construction and completed figures. ${corroboration.unmatched} candidates appear in only one vintage and are not compared. ${corroboration.boundary}`,
      href: `${href('/operational-analytics')}&tab=sanitation`,
      cta: 'Open the sanitation cohort',
      good: corroboration.verdict === 'corroborated',
    },
  ];

  return <section className="evidence-integrity" aria-labelledby="ei-title">
    <header>
      <div>
        <span className="ei-kicker">Found by review, not declared by the source</span>
        <h2 id="ei-title">What the evidence does to itself.</h2>
      </div>
      <p className="ei-scope">
        {governedSnapshotStats.completeDatasets} retained datasets · {format(governedSnapshotStats.records)} rows.
        These conditions change how every figure above should be read.
      </p>
    </header>
    <div className="ei-findings">
      {findings.map((finding) => <a key={finding.id} className="ei-finding" href={finding.href} data-empty={finding.value === 0} data-good={'good' in finding && finding.good === true}>
        <div className="ei-value"><strong>{finding.value}</strong><span>{finding.unit}</span></div>
        <div className="ei-copy">
          <b>{finding.title}</b>
          <p>{finding.detail}</p>
          <small>{finding.cta} →</small>
        </div>
      </a>)}
    </div>
  </section>;
}
