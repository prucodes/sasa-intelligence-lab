import {describe, expect, it} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import bwg from '@/data/aggregates/bwg-reference-day.json';
import {getSasaGoals, goalSummary} from '@/lib/sasa-goals';
import {getUlbAtlas, measureHeadline} from '@/lib/ulb-atlas';
import {serviceSnapshot} from '@/lib/ulb-service';
import {LabApp} from '@/app/lab-app';

const model = getSasaGoals();
const goal = (id: string) => model.goals.find((entry) => entry.id === id)!;

describe('SASA goals', () => {
  it('quotes every target from a dated, linked source', () => {
    expect(model.goals).toHaveLength(11);
    for (const entry of model.goals) {
      expect(entry.source.url).toMatch(/^https:\/\//);
      expect(entry.source.date).toBeTruthy();
      expect(entry.needs.length).toBeGreaterThan(10);
    }
  });

  it('derives each status from dates and values, never by hand', () => {
    for (const entry of model.goals) {
      if (!entry.reading) { expect(entry.status).toBe('not-measured'); continue; }
      if (entry.status === 'short-after-deadline') {
        expect(entry.reading.asOf > entry.deadline!).toBe(true);
        expect(entry.reading.share!).toBeLessThan(100);
      }
      if (entry.status === 'before-deadline') expect(entry.reading.asOf < entry.deadline!).toBe(true);
    }
    // A reading taken before the deadline can never say the target was missed.
    expect(goal('segregation').status).toBe('before-deadline');
    expect(goal('legacy').status).toBe('short-after-deadline');
  });

  it('never marks a nearer or different measure as met', () => {
    expect(goal('plastic').status).toBe('before-deadline');
    for (const id of ['odf-plus', 'green-cover', 'compost']) expect(goal(id).status).toBe('different-measure');
    // ODF Plus reads 99.75% of its own target, yet the target's definition is unknown.
    expect(goal('odf-plus').reading!.share!).toBeGreaterThan(99);
    expect(goal('odf-plus').status).not.toBe('met');
  });

  it('reads collection on the population the Atlas places, and states the all-ULB figure', () => {
    const atlas = measureHeadline(getUlbAtlas(), 'reach');
    expect(goal('collection').reading!.share!).toBeCloseTo(atlas.figure, 6);
    const all = serviceSnapshot.ulbs.reduce((sum, ulb) => sum + ulb.collected, 0) / serviceSnapshot.ulbs.reduce((sum, ulb) => sum + ulb.households, 0) * 100;
    expect(goal('collection').note).toContain(`${all.toLocaleString('en-IN', {maximumFractionDigits: 1})}%`);
    expect(model.heldUlbs.length).toBeGreaterThan(0);
  });

  it('keeps bulk generators to the retained secretariats and says the reading is partial', () => {
    const reading = goal('bulk-generators').reading!;
    expect(reading.display).toBe(`${bwg.processingOnSite.toLocaleString('en-IN')} of ${bwg.identified.toLocaleString('en-IN')} identified`);
    expect(bwg.processingOnSite).toBeLessThanOrEqual(bwg.identified);
    expect(bwg.usableSecretariats).toBeLessThan(bwg.registerSecretariats);
    expect(goal('bulk-generators').note).toMatch(/partial/);
    expect(goal('bulk-generators').status).toBe('tracked');
  });

  it('joins districts by label only when one register district matches, and lists every respelling', () => {
    const {rows, respelled, unmatched} = model.districts;
    expect(rows).toHaveLength(new Set(serviceSnapshot.ulbs.map((ulb) => ulb.district)).size);
    for (const entry of respelled) expect(rows.some((row) => row.district === entry.register)).toBe(true);
    // SPSR Nellore resembles no register spelling, so it stays blank rather than guessed.
    expect(unmatched.map((entry) => entry.source)).toContain('SPSR Nellore');
    expect(rows.find((row) => row.district === 'Sri Potti Sriramulu Nellore')!.legacyOutstanding.value).toBeNull();
  });

  it('leaves a district blank, with its reason, when every ULB in it is held out', () => {
    const vizag = model.districts.rows.find((row) => row.district === 'Visakhapatnam')!;
    expect(vizag.collection.value).toBeNull();
    expect(vizag.collection.detail).toMatch(/codes need review/);
  });

  it('writes at most three insights, each tied to a goal', () => {
    expect(model.insights.length).toBeGreaterThan(0);
    expect(model.insights.length).toBeLessThanOrEqual(3);
    for (const insight of model.insights) expect(model.goals.some((entry) => entry.id === insight.goalId)).toBe(true);
  });

  it('summarises the statuses so the hero and the rows agree', () => {
    const summary = goalSummary(model.goals);
    expect(summary.shortAfterDeadline + summary.beforeDeadline + summary.differentMeasure + summary.notMeasured + summary.met + summary.tracked).toBe(summary.total);
  });
});

describe('SASA goals screen', () => {
  it('opens on the hero and lists every target', () => {
    render(<LabApp page="goals" initialMode="SAMPLE" />);
    expect(screen.getByRole('heading', {level: 1, name: 'SASA Goals'})).toBeInTheDocument();
    const list = screen.getByRole('region', {name: 'Every target, one row each'});
    expect(list.querySelectorAll('details')).toHaveLength(11);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('sorts the district table by a column and marks the sort', () => {
    render(<LabApp page="goals" initialMode="SAMPLE" />);
    const table = screen.getByRole('table');
    const header = within(table).getByRole('button', {name: /Collection/});
    fireEvent.click(header);
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'descending');
    const first = within(table).getAllByRole('rowheader')[0].textContent;
    const best = [...model.districts.rows].filter((row) => row.collection.value !== null).sort((a, b) => b.collection.value! - a.collection.value!)[0].district;
    expect(first).toBe(best);
  });

  it('keeps synthetic data away from the real targets', () => {
    render(<LabApp page="goals" initialMode="DEMO" />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/retained evidence/i, {selector: 'p'})).toBeInTheDocument();
  });
});

describe('executive brief', () => {
  it('carries the target tally and insights in governed mode only', async () => {
    const {getExecutiveBrief, executiveBriefText} = await import('@/lib/executive-brief');
    const governed = executiveBriefText(getExecutiveBrief('SAMPLE'), '2026-11-18T00:00:00Z');
    expect(governed).toContain("AGAINST THE STATE'S TARGETS");
    expect(governed).toContain(`${model.goals.length} stated targets:`);
    for (const insight of model.insights) expect(governed).toContain(insight.text);
    const demo = executiveBriefText(getExecutiveBrief('DEMO'), '2026-11-18T00:00:00Z');
    expect(demo).not.toContain('stated targets');
  });
});
