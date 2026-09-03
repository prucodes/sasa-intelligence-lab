import { describe, expect, it } from 'vitest';
import { getNamedFindings } from '@/lib/findings';
import { getCollectionProcurementSummary, getIHHLFunnel, getLegacyWasteSummary } from '@/lib/analytics';
import { rateCoverageViolation } from '@/lib/coverage';

const findings = getNamedFindings();
const byId = (id: string) => findings.find((finding) => finding.id === id)!;

describe('named findings exist and are ranked', () => {
  it('derives one finding per shortfall the evidence supports', () => {
    expect(findings.map((finding) => finding.id).sort()).toEqual(
      ['legacy-balance', 'stalled-approvals', 'undelivered-orders'],
    );
  });

  it('leads with the shortfall where the most entities have not started', () => {
    expect(findings[0].id).toBe('stalled-approvals');
    // 58 of 59, ahead of 75 of 78 for vehicles.
    expect(findings[0].stalled / findings[0].reporting)
      .toBeGreaterThan(findings[1].stalled / findings[1].reporting);
  });

  it('names entities largest first within each finding', () => {
    for (const finding of findings) {
      const values = finding.entities.map((entity) => entity.value);
      // Share-ranked findings order by proportion, so only volume-ranked lists
      // are monotonic in the raw value.
      if (finding.rankedBy === 'volume') {
        expect([...values].sort((a, b) => b - a)).toEqual(values);
      }
    }
  });

  it('never reports more affected entities than returned a value', () => {
    for (const finding of findings) {
      expect(finding.affected).toBeLessThanOrEqual(finding.reporting);
      expect(finding.stalled).toBeLessThanOrEqual(finding.affected);
    }
  });

  it('carries coverage, so no finding states a rate without its denominator', () => {
    for (const finding of findings) {
      expect(finding.coverage.expected).toBe(123);
      expect(rateCoverageViolation(`${Math.round(finding.concentration?.share ?? 0) * 100}%`, finding.coverage)).toBeNull();
    }
  });
});

describe('the vehicle finding measures orders, not intentions', () => {
  const finding = byId('undelivered-orders');

  it('counts the distance between work orders and deliveries', () => {
    const summary = getCollectionProcurementSummary();
    const ordered = summary.rows
      .filter((row) => row.ulb && (row.workOrders ?? 0) > 0)
      .reduce((sum, row) => sum + Math.max((row.workOrders ?? 0) - (row.supplied ?? 0), 0), 0);
    expect(finding.total).toBe(ordered);
    // Not the target gap, which would include procurement never started.
    expect(finding.total).toBeLessThan(summary.target - summary.supplied);
  });

  it('separates ULBs that received nothing from those merely behind', () => {
    const nellore = finding.entities.find((entity) => entity.ulb === 'Nellore');
    expect(nellore?.stalled).toBe(false);
    expect(finding.entities.find((entity) => entity.ulb === 'Kurnool')?.stalled).toBe(true);
  });
});

describe('the IHHL finding names the stalled approvals', () => {
  const finding = byId('stalled-approvals');

  it('totals approvals with nothing completed against them', () => {
    const funnel = getIHHLFunnel();
    expect(finding.total).toBe(funnel.approved - funnel.completed);
  });

  it('marks a ULB with construction under way as not stalled', () => {
    const kuppam = finding.entities.find((entity) => entity.ulb === 'Kuppam');
    expect(kuppam?.stalled).toBe(false);
  });
});

/**
 * Ranking legacy waste by tonnage put GVMC first — a ULB that has cleared 88% of
 * the largest dump in the state. The share remaining is the honest order.
 */
describe('the legacy finding ranks by share remaining, not mass', () => {
  const finding = byId('legacy-balance');

  it('does not lead with the largest city', () => {
    expect(finding.entities[0].ulb).not.toBe('GVMC');
    expect(finding.rankedBy).toBe('share');
  });

  it('offers no concentration of mass, which a share ranking cannot support', () => {
    expect(finding.concentration).toBeNull();
  });

  it('excludes rows whose own balance arithmetic does not close', () => {
    const conflicted = getLegacyWasteSummary().rows.filter((row) => row.balanceCheck === 'conflict');
    const named = new Set(finding.entities.map((entity) => entity.ulb));
    for (const row of conflicted) expect(named.has(row.ulb)).toBe(false);
  });
});
