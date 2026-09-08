import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EvidenceRecordBrowser } from '@/app/evidence-record-browser';
import { AnchoredSourceBrowser } from '@/app/anchored-source-browser';
import { createProvider } from '@/lib/domain';
import { getEvidenceCoverageGrid } from '@/lib/analytics';

describe('lower-screen evidence workspaces', () => {
  it('keeps every diagnostic record accessible under its source without merging periods', () => {
    const diagnostic = createProvider('SAMPLE').getDiagnostic('sample-narsipatnam');
    const onSelect = vi.fn();
    const { container } = render(<EvidenceRecordBrowser records={diagnostic.evidence} selectedId={diagnostic.evidence[0].id} onSelect={onSelect}/>);
    expect(container.querySelectorAll('.record-source-list > details')).toHaveLength(new Set(diagnostic.evidence.map(row => row.tableKey)).size);
    expect(container.querySelectorAll('.record-periods button')).toHaveLength(diagnostic.evidence.length);
    fireEvent.click(container.querySelectorAll('.record-periods button')[1]);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(diagnostic.evidence[onSelect.mock.calls[0][0]]).toBeDefined();
    fireEvent.change(screen.getByRole('searchbox', {name:'Filter source records'}), {target:{value:'no-such-source'}});
    expect(screen.getByText(/no retained source or period matches/i)).toBeInTheDocument();
  });

  it('exposes actual anchored return states, scoped to a source and district', () => {
    const grid = getEvidenceCoverageGrid();
    const { container } = render(<AnchoredSourceBrowser grid={grid}/>);
    const sourceIndex = grid.sources.findIndex(source => grid.rows.some(row => row.cells[grid.sources.indexOf(source)] === 'not-returned'));
    fireEvent.change(screen.getByRole('combobox', {name:'Coverage source'}), {target:{value:grid.sources[sourceIndex].tableKey}});
    const missing = grid.rows.filter(row => row.cells[sourceIndex] === 'not-returned');
    const filter = within(screen.getByLabelText('Filter coverage return state')).getByRole('button', {name:/Not returned/});
    expect(filter).toHaveTextContent(String(missing.length));
    fireEvent.click(filter);
    expect(container.querySelectorAll('.anchor-entity-grid article')).toHaveLength(Math.min(12, missing.length));
    expect(container.querySelectorAll('.anchor-entity-grid .state-not-returned')).toHaveLength(Math.min(12, missing.length));
    const district = missing[0].district;
    fireEvent.change(screen.getByRole('combobox', {name:'Coverage district'}), {target:{value:district}});
    expect(container.querySelector('.anchor-browser footer')).toHaveTextContent(`of ${missing.filter(row => row.district === district).length} matching entities`);
    expect(screen.getByText(/not an official statewide denominator/i)).toBeInTheDocument();
  });
});
