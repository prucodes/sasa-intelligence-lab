'use client';

import { useMemo, useState } from 'react';
import { getIdentityReach, getLgdCrosswalk } from '@/lib/lgd-crosswalk';
import './lgd-crosswalk-panel.css';

const DATASET_LABELS: Record<string, string> = {
  ihhl_new_identification_new1_api: 'IHHL identification',
  swacch_survekshan_info_new1_api: 'Swachh Survekshan',
  fstps_stps_cotreatment_new1_api: 'FSTP/STP co-treatment',
  msw_cbg_units_new1_api: 'MSW CBG units',
  cd_waste_process_plants_revival_new1_api: 'C&D waste plants',
  sewage_treated_qty_new1_api: 'Sewage plant capacity',
};

/**
 * The evidence behind the identity gate.
 *
 * The platform shipped an entity mapping in September 2026, inside the fact rows. This
 * panel shows exactly how far it reaches and exactly where it disagrees with itself,
 * because "the mapping exists" and "the mapping can be used" are different claims and
 * only the first one is true.
 */
export function LgdCrosswalkPanel() {
  const crosswalk = useMemo(() => getLgdCrosswalk(), []);
  const reach = useMemo(() => getIdentityReach(), []);
  const [tab, setTab] = useState<'contradictions' | 'relabels' | 'unmapped'>('contradictions');

  const unrelated = crosswalk.districtRelabels.filter((relabel) => relabel.kind === 'unrelated');
  const spelling = crosswalk.districtRelabels.filter((relabel) => relabel.kind === 'spelling');
  const percent = Math.round(reach.coverageRatio * 100);

  return <section className="lgd-panel" aria-labelledby="lgd-panel-title">
    <header className="lgd-head">
      <div>
        <span className="lgd-kicker">Identity evidence / supplied mapping</span>
        <h2 id="lgd-panel-title">The source now states its own identity.<br/><em>It does not agree with itself.</em></h2>
        <p>
          Six retained datasets carry LGD district and mandal codes beside the departmental
          label, a mapping the source asserts rather than one this product inferred. That
          makes it evidence. It does not make it correct.
        </p>
      </div>
      <dl className="lgd-reach">
        <div><dt>Entities reached</dt><dd>{percent}%<span> {reach.covered} of {reach.totalCandidates}</span></dd></div>
        <div><dt>Datasets carrying codes</dt><dd>{reach.enrichedDatasets}<span> of {reach.totalDatasets} retained</span></dd></div>
        <div><dt>Codes disputed across sources</dt><dd>{reach.disputed}</dd></div>
      </dl>
    </header>

    <div className="lgd-verdict" role="note">
      <span className="lgd-verdict-tag">Not adopted as canonical identity</span>
      <p>{reach.blocker}</p>
    </div>

    <div className="lgd-tabs" role="tablist" aria-label="Mapping evidence">
      {([
        ['contradictions', 'Self-contradictions', crosswalk.selfContradictions.length],
        ['relabels', 'Label changes', crosswalk.districtRelabels.length + crosswalk.ulbRelabels.length],
        ['unmapped', 'No code supplied', crosswalk.unresolved],
      ] as const).map(([id, label, count]) => <button key={id} role="tab" type="button"
        aria-selected={tab === id} className={tab === id ? 'is-selected' : ''} onClick={() => setTab(id)}>
        {label}<b>{count}</b>
      </button>)}
    </div>

    {tab === 'contradictions' && <div className="lgd-body">
      <p className="lgd-lead">
        One departmental district label mapped to two different LGD districts <b>inside a
        single dataset</b>. Each of these is the source disagreeing with itself, not a
        naming question, so none of them can be resolved here.
      </p>
      <ul className="lgd-contradictions">
        {crosswalk.selfContradictions.map((entry) => <li key={`${entry.tableKey}-${entry.sourceDistrict}`}>
          <span className="lgd-source-label">{entry.sourceDistrict.replace(/^"|"$/g, '')}</span>
          <span className="lgd-arrow" aria-hidden="true">→</span>
          <span className="lgd-targets">{entry.lgdDistricts.map((name) => <b key={name}>{name}</b>)}</span>
          <small>{DATASET_LABELS[entry.tableKey] ?? entry.tableKey}</small>
        </li>)}
      </ul>
      {crosswalk.selfContradictions.length === 0 && <p className="lgd-empty">No source contradicts itself in the retained vintage.</p>}
    </div>}

    {tab === 'relabels' && <div className="lgd-body">
      <p className="lgd-lead">
        Where the LGD label differs from the departmental one. A respelling can be read as
        one place; an unrelated pair cannot, and is routed to a reviewer rather than applied.
        This is triage, not a verdict: <b>Rajamahendravaram</b> and <b>Rajahmundry</b> are
        the same city, and the check cannot see that.
      </p>
      <div className="lgd-relabel-groups">
        <div>
          <h3><i className="lgd-dot-warn" aria-hidden="true"/>Not a spelling variant <b>{unrelated.length + crosswalk.ulbRelabels.filter((item) => item.kind === 'unrelated').length}</b></h3>
          <ul className="lgd-relabels">
            {unrelated.map((relabel) => <li key={`${relabel.from}-${relabel.to}`} className="is-unrelated">
              <span>{relabel.from.replace(/^"|"$/g, '')}</span><i aria-hidden="true">→</i><b>{relabel.to}</b>
              <small>{relabel.ulbs} ULB{relabel.ulbs === 1 ? '' : 's'}</small>
            </li>)}
            {crosswalk.ulbRelabels.filter((item) => item.kind === 'unrelated').map((relabel) => <li key={`u-${relabel.from}`} className="is-unrelated">
              <span>{relabel.from.replace(/^"|"$/g, '')}</span><i aria-hidden="true">→</i><b>{relabel.to}</b><small>ULB name</small>
            </li>)}
          </ul>
        </div>
        <div>
          <h3><i className="lgd-dot-ok" aria-hidden="true"/>Respelled <b>{spelling.length + crosswalk.ulbRelabels.filter((item) => item.kind === 'spelling').length}</b></h3>
          <ul className="lgd-relabels">
            {spelling.map((relabel) => <li key={`${relabel.from}-${relabel.to}`}>
              <span>{relabel.from.replace(/^"|"$/g, '')}</span><i aria-hidden="true">→</i><b>{relabel.to}</b>
              <small>{relabel.ulbs} ULB{relabel.ulbs === 1 ? '' : 's'}</small>
            </li>)}
            {crosswalk.ulbRelabels.filter((item) => item.kind === 'spelling').map((relabel) => <li key={`u-${relabel.from}`}>
              <span>{relabel.from.replace(/^"|"$/g, '')}</span><i aria-hidden="true">→</i><b>{relabel.to}</b><small>ULB name</small>
            </li>)}
          </ul>
        </div>
      </div>
    </div>}

    {tab === 'unmapped' && <div className="lgd-body">
      <p className="lgd-lead">
        Source identities appearing in an LGD-enriched dataset with no LGD mandal code on
        any row. A blank code is not a missing lookup this product may fill in. It is the
        platform stating that it did not map this entity.
      </p>
      <ul className="lgd-unmapped">
        {crosswalk.entries.filter((entry) => !entry.lgdUlbCode).slice(0, 40).map((entry) => <li key={entry.sourceKey}>
          <b>{entry.sourceUlb}</b><span>{entry.sourceDistrict.replace(/^"|"$/g, '')}</span>
          <small>{entry.sources.map((key) => DATASET_LABELS[key] ?? key).join(' · ')}</small>
        </li>)}
      </ul>
      {crosswalk.unresolved > 40 && <p className="lgd-more">Showing 40 of {crosswalk.unresolved}.</p>}
    </div>}

    <footer className="lgd-foot">
      <span><b>{crosswalk.rowsWithUlbCode.toLocaleString('en-IN')}</b> of {crosswalk.rows.toLocaleString('en-IN')} rows across {crosswalk.datasets} datasets carry an LGD mandal code</span>
      <span>No code is inferred, corrected or filled in. Disputed and unmapped entities stay outside approved identity.</span>
    </footer>
  </section>;
}
