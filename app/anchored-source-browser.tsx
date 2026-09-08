'use client';

import { useMemo, useState } from 'react';
import type { getEvidenceCoverageGrid } from '@/lib/analytics';

type Grid = ReturnType<typeof getEvidenceCoverageGrid>;
type Cell = Grid['rows'][number]['cells'][number];
const labels: Record<Cell, string> = {
  returned: 'Returned', 'not-returned': 'Not returned', 'quality-issue': 'Quality condition', recovered: 'Local alias match',
};
const marks: Record<Cell, string> = { returned: '✓', 'not-returned': '—', 'quality-issue': '!', recovered: '↗' };

export function AnchoredSourceBrowser({ grid }: { grid: Grid }) {
  const [sourceKey, setSourceKey] = useState(grid.sources[0]?.tableKey ?? '');
  const [district, setDistrict] = useState('ALL');
  const [state, setState] = useState<Cell | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const sourceIndex = Math.max(0, grid.sources.findIndex(source => source.tableKey === sourceKey));
  const source = grid.sources[sourceIndex];
  const districts = useMemo(() => [...new Set(grid.rows.map(row => row.district))].sort(), [grid]);
  const scoped = grid.rows.filter(row => district === 'ALL' || row.district === district);
  const filtered = scoped.filter(row => state === 'ALL' || row.cells[sourceIndex] === state);
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const activePage = Math.min(page, pages - 1);
  const visible = filtered.slice(activePage * 12, activePage * 12 + 12);
  if (!source) return null;
  return <section className="anchor-browser" aria-label="Browse anchored coverage by source">
    <header><div><span className="eyebrow">Find the names behind the gaps</span><h3>One source. Every anchored ULB.</h3><p>Browse actual return states, including local alias matches. This registry is not an official statewide denominator.</p></div></header>
    <div className="anchor-browser-controls"><label>Source<select aria-label="Coverage source" value={source.tableKey} onChange={event => {setSourceKey(event.target.value); setPage(0);}}>{grid.sources.map(item => <option key={item.tableKey} value={item.tableKey}>{item.label}</option>)}</select></label><label>District<select aria-label="Coverage district" value={district} onChange={event => {setDistrict(event.target.value); setPage(0);}}><option value="ALL">All registry districts</option>{districts.map(item => <option key={item} value={item}>{item}</option>)}</select></label></div>
    <div className="anchor-state-filters" aria-label="Filter coverage return state"><button type="button" aria-pressed={state === 'ALL'} onClick={() => {setState('ALL');setPage(0);}}>All <b>{scoped.length}</b></button>{(Object.entries(labels) as Array<[Cell,string]>).map(([key,label]) => <button type="button" key={key} aria-pressed={state === key} onClick={() => {setState(key);setPage(0);}}><i className={`anchor-mark state-${key}`}>{marks[key]}</i>{label}<b>{scoped.filter(row => row.cells[sourceIndex] === key).length}</b></button>)}</div>
    <div className="anchor-entity-grid" aria-live="polite">{visible.map(row => <article key={row.ulbId}><i className={`anchor-mark state-${row.cells[sourceIndex]}`}>{marks[row.cells[sourceIndex]]}</i><div><b>{row.ulb}</b><small>{row.district}</small><span>{labels[row.cells[sourceIndex]]} · ID {row.ulbId}</span></div></article>)}</div>
    {filtered.length === 0 && <p className="record-empty">No registry entities have this return state in the selected district.</p>}
    <footer><span>{filtered.length ? activePage * 12 + 1 : 0}–{Math.min((activePage + 1) * 12, filtered.length)} of {filtered.length} matching entities</span><div><button type="button" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>← Previous</button><button type="button" disabled={activePage + 1 >= pages} onClick={() => setPage(activePage + 1)}>Next →</button></div></footer>
    <p className="anchor-browser-note">Return status across retained periods, not a same-month comparison. A local alias match improves reachability; it does not approve identity or clear quality gates.</p>
  </section>;
}
