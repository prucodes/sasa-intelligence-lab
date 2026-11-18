import {describe, expect, it} from 'vitest';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {getPageBrief, revisedRouteCount} from '@/lib/page-briefs';
import {getNamedFindings} from '@/lib/findings';
import {UlbAtlas} from '@/app/ulb-atlas';
import {getUlbAtlas} from '@/lib/ulb-atlas';
import {getRevisionInventory} from '@/lib/source-revisions';

describe('page briefs', () => {
  it('gives every screen all three parts', () => {
    for (const page of ['overview', 'operational-analytics', 'gap-radar', 'atlas', 'reconciliation', 'diagnostics', 'data-readiness'] as const) {
      const brief = getPageBrief(page)!;
      expect(brief.is.length).toBeGreaterThan(40);
      expect(brief.says.length).toBeGreaterThan(40);
      expect(brief.act.length).toBeGreaterThan(40);
    }
  });

  it('quotes the named findings rather than restating them', () => {
    const [first] = getNamedFindings();
    expect(getPageBrief('overview')!.says.replace(/\*\*/g, '')).toContain(first.statement);
    for (const finding of getNamedFindings()) expect(getPageBrief('operational-analytics')!.says.replace(/\*\*/g, '')).toContain(finding.headline);
  });

  it('derives the revised route count instead of fixing it in the label', () => {
    const inventory = getRevisionInventory();
    expect(revisedRouteCount()).toEqual({revised: inventory.filter((route) => route.changed).length, routes: inventory.length});
  });

  it('names the one blocked readiness gate', () => {
    expect(getPageBrief('data-readiness')!.says).toContain('Same-year outcome data is the one blocked gate');
  });
});

describe('ULB atlas screen', () => {
  it('opens on a complete dossier and follows the chosen measure through the table', () => {
    render(<UlbAtlas mode="SAMPLE" />);
    const model = getUlbAtlas();
    expect(screen.getByRole('group', {name: 'About this screen'})).toBeVisible();
    const dossier = screen.getByRole('complementary', {name: /^[A-Z(). ]+$/});
    expect(within(dossier).getByText(/of 8 measures placed/)).toBeVisible();
    fireEvent.click(screen.getByRole('radio', {name: 'Toilets'}));
    expect(screen.getByRole('heading', {level: 2, name: 'Toilet completion'})).toBeVisible();
    expect(screen.getByText(/approved toilets not completed/)).toBeVisible();
    const sorted = document.querySelector('.atlas-table thead th.is-sorted');
    expect(sorted?.textContent).toContain('Toilets');
    expect(screen.getAllByRole('row').length).toBeGreaterThan(model.ulbs.length);
  });

  it('finds a ULB by a spelling only another source uses', () => {
    render(<UlbAtlas mode="SAMPLE" />);
    fireEvent.change(screen.getByLabelText('Find a ULB by name, spelling or code'), {target: {value: 'Rajahmundry'}});
    expect(screen.getByRole('button', {name: /RAJAMAHENDRAVARAM/})).toBeVisible();
  });

  it('does not map ranks and says why', () => {
    render(<UlbAtlas mode="SAMPLE" />);
    fireEvent.click(screen.getByRole('radio', {name: 'Rank'}));
    expect(screen.getByText(/National ranks are not drawn by district/)).toBeVisible();
  });

  it('explains itself outside governed data instead of drawing nothing', () => {
    render(<UlbAtlas mode="DEMO" />);
    expect(screen.getByRole('heading', {name: 'The atlas reads retained evidence only'})).toBeVisible();
  });
});
