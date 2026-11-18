import {describe, expect, it} from 'vitest';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {analyticsHero, atlasHero, environmentHero, gapRadarHero, readinessHero, revisedRouteCount} from '@/lib/screen-heroes';
import {getNamedFindings} from '@/lib/findings';
import {getRevisionInventory} from '@/lib/source-revisions';
import {UlbAtlas} from '@/app/ulb-atlas';
import {getUlbAtlas} from '@/lib/ulb-atlas';
import {serviceExclusions, serviceSnapshot} from '@/lib/ulb-service';

describe('screen heroes', () => {
  it('gives every hero a page name, an accent and two to four figures', () => {
    for (const hero of [analyticsHero(), atlasHero(), environmentHero(), gapRadarHero(), readinessHero()]) {
      expect(hero.title.length).toBeGreaterThan(3);
      expect(hero.accent.length).toBeGreaterThan(10);
      expect(hero.figures.length).toBeGreaterThanOrEqual(2);
      expect(hero.figures.length).toBeLessThanOrEqual(4);
      for (const figure of hero.figures) {
        expect(Number.isFinite(figure.value)).toBe(true);
        if (figure.meter !== undefined) { expect(figure.meter).toBeGreaterThanOrEqual(0); expect(figure.meter).toBeLessThanOrEqual(100); }
      }
    }
  });

  it('takes the analytics figures from the named findings', () => {
    const totals = getNamedFindings().map((finding) => finding.total);
    expect(analyticsHero().figures.map((figure) => figure.value)).toEqual(totals);
  });

  it('draws flows only where each stage is a subset of the one before', () => {
    for (const hero of [analyticsHero(), environmentHero()]) {
      for (const pipeline of hero.pipelines.filter((entry) => entry.kind === 'flow')) {
        for (let i = 1; i < pipeline.stages.length; i++) expect(pipeline.stages[i].value).toBeLessThanOrEqual(pipeline.stages[i - 1].value);
      }
    }
  });

  it('splits sewage plants into parts that add up to the planned total', () => {
    const plants = environmentHero().pipelines.find((pipeline) => pipeline.kind === 'split')!;
    const [whole, ...parts] = plants.stages;
    expect(parts.reduce((sum, part) => sum + part.value, 0)).toBe(whole.value);
  });

  it('places every eligible service ULB in the Gap Radar scatter', () => {
    expect(gapRadarHero().points).toHaveLength(serviceSnapshot.ulbs.filter((ulb) => !serviceExclusions(ulb).length).length);
  });

  it('derives the revised route count instead of fixing it in the label', () => {
    const inventory = getRevisionInventory();
    expect(revisedRouteCount()).toEqual({revised: inventory.filter((route) => route.changed).length, routes: inventory.length});
  });

  it('names the one blocked readiness gate', () => {
    expect(readinessHero().figures.find((figure) => figure.label === 'Blocked')!.context).toBe('Same-year outcome data');
  });
});

describe('ULB atlas screen', () => {
  it('opens on a complete dossier and follows the chosen measure through the table', () => {
    render(<UlbAtlas mode="SAMPLE" />);
    const model = getUlbAtlas();
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
