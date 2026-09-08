'use client';

import { useMemo, useState } from 'react';
import type { EvidenceRecord } from '@/lib/domain';

/** A browse-first index: every period stays a separate retained record. */
export function EvidenceRecordBrowser({ records, selectedId, onSelect }: {
  records: EvidenceRecord[];
  selectedId?: string;
  onSelect: (index: number) => void;
}) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const bySource = new Map<string, Array<{ record: EvidenceRecord; index: number }>>();
    records.forEach((record, index) => {
      if (query.trim() && !`${record.dataset} ${record.period}`.toLowerCase().includes(query.trim().toLowerCase())) return;
      const group = bySource.get(record.tableKey) ?? [];
      group.push({ record, index });
      bySource.set(record.tableKey, group);
    });
    return [...bySource.entries()];
  }, [records, query]);
  return <section className="record-browser" aria-label="Browse retained source records">
    <header><div><span className="eyebrow">Source library</span><h3>Browse every retained record</h3><p>Open a source, then choose its reported period. No periods are merged.</p></div><span>{records.length} records</span></header>
    <label><span className="sr-only">Filter source records</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter source or period (optional)"/></label>
    <div className="record-source-list">{groups.map(([key, entries]) => <details key={key}>
      <summary><div><b>{entries[0].record.dataset}</b><small>{entries[0].record.grain} grain · {entries.length} retained record{entries.length === 1 ? '' : 's'}</small></div><span>{entries.length}</span><i aria-hidden="true">+</i></summary>
      <div className="record-periods">{entries.map(({record, index}, position) => <button key={record.id} type="button" aria-pressed={record.id === selectedId} onClick={() => onSelect(index)}><span><b>{record.period}</b><small>Record {position + 1} · {record.matchStatus}</small></span><em>{record.id === selectedId ? 'Selected' : 'Inspect →'}</em></button>)}</div>
    </details>)}</div>
    {groups.length === 0 && <p className="record-empty">No retained source or period matches this filter.</p>}
  </section>;
}
