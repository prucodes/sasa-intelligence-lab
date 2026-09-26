import { describe, expect, it } from 'vitest';
import {
  completedWetCapacity,
  estimateAssumptions,
  getCarbonEstimates,
  getEnvironmentSections,
  segregationAtSource,
} from '@/lib/environment-ledger';

const sections = getEnvironmentSections();
const lines = sections.flatMap((section) => section.lines);
const line = (id: string) => {
  const found = lines.find((item) => item.id === id);
  if (!found) throw new Error(`no ledger line ${id}`);
  return found;
};

describe('physical ledger', () => {
  it('collapses the green response repeats instead of adding them', () => {
    // The July payload carries 202 rows for 123 ULBs, 78 of them verbatim repeats.
    // Adding raw rows would report 2,039 km of target against an actual 1,400.
    const green = line('green-cover');
    expect(green.quality.rawRows).toBe(202);
    expect(green.quality.uniqueRows).toBe(123);
    expect(green.quality.conflictingKeys).toBe(0);
    expect(green.target).toBe(1400);
    expect(green.reported).toBeCloseTo(303.01, 2);
    expect(green.unit).toBe('km');
  });

  it('withholds a top-five list where the registry is barely bigger than five', () => {
    // Three C&D plants and six CBG units: listing five of them is not a concentration.
    expect(line('cd-waste').concentration).toBeNull();
    expect(line('cbg').concentration).toBeNull();
    expect(line('iswm-completed').concentration).not.toBeNull();
  });

  it('draws the legacy balance as a shortfall, not as progress', () => {
    expect(line('legacy-balance').polarity).toBe('shortfall');
    expect(line('green-cover').polarity).toBe('progress');
  });

  it('names who holds the reported green progress', () => {
    const green = line('green-cover');
    expect(green.concentration).not.toBeNull();
    expect(green.concentration!.share).toBeGreaterThan(0.5);
    expect(green.concentration!.top[0].name).toBe('GVMC');
    expect(green.concentration!.top).toHaveLength(5);
  });

  it('counts ULBs that carry a target but report nothing', () => {
    expect(line('green-spaces').silent).toBe(73);
    expect(line('water-bodies').silent).toBe(34);
  });

  it('reads the legacy balance as a liability held by named ULBs', () => {
    const legacy = line('legacy-balance');
    expect(legacy.reported).toBe(1485769);
    expect(legacy.reporting).toBe(49);
    // A zero balance is good news on this line, so it is never counted as silence.
    expect(legacy.silent).toBe(0);
    expect(legacy.caution).toMatch(/No unit is declared/);
  });

  it('separates configured processing capacity from completed capacity', () => {
    expect(line('iswm-configured').reported).toBe(5392);
    const completed = line('iswm-completed');
    expect(completed.reported).toBe(550);
    expect(completed.reporting).toBe(8);
    expect(completed.entities).toBe(108);
  });

  it('collapses the FSTP repeats although its period labels disagree', () => {
    const fstp = line('fstp');
    expect(fstp.quality.rawRows).toBe(70);
    expect(fstp.quality.uniqueRows).toBe(35);
    expect(fstp.reported).toBe(600);
    expect(fstp.caution).toMatch(/month number 7 are labelled JUNE/);
  });

  it('reports sewage capacity with no operating plant', () => {
    const sewage = line('sewage');
    expect(sewage.reported).toBeCloseTo(406.8, 1);
    expect(sewage.quality.uniqueRows).toBe(121);
  });

  it('selects one declared period per line rather than summing months', () => {
    expect(line('green-cover').period).toBe('July 2026');
    expect(line('legacy-balance').period).toBe('July 2026');
    expect(line('home-composting').period).toBe('July 2026');
  });

  it('keeps every line carrying its own boundary statement', () => {
    for (const item of lines) {
      expect(item.boundary.length).toBeGreaterThan(40);
      expect(item.tableKey).toMatch(/_api$/);
    }
  });
});

describe('capacity bound', () => {
  it('measures completed wet capacity, not configured capacity', () => {
    const capacity = completedWetCapacity();
    expect(capacity.completedFacilities).toBe(8);
    expect(capacity.completedWetTpd).toBeCloseTo(301, 0);
    expect(capacity.configuredWetTpd).toBeCloseTo(2957.25, 2);
    expect(capacity.largest).toBe('Nellore');
  });

  it('caps the segregation estimate at the capacity that exists to receive it', () => {
    const { capacityBound, estimates } = getCarbonEstimates();
    // Reported segregation implies far more wet waste than any completed plant can take.
    expect(capacityBound.impliedWetTonnesPerDay).toBeGreaterThan(capacityBound.completedWetTpd);
    expect(capacityBound.coveredShare).not.toBeNull();
    expect(capacityBound.coveredShare!).toBeLessThan(0.25);

    const implied = estimates.find((item) => item.id === 'segregation-implied')!;
    const bound = estimates.find((item) => item.id === 'capacity-bound')!;
    expect(bound.central).toBeLessThan(implied.central);
  });
});

describe('estimate layer', () => {
  it('derives the landfill factor from the stated IPCC parameters', () => {
    const { factors } = getCarbonEstimates();
    // 0.15 x 0.5 x 0.8 x 0.5 x 16/12 = 0.04 t CH4 per tonne, x 28 = 1.12 tCO2e.
    expect(factors.landfillCentral).toBeCloseTo(1.12, 4);
    expect(factors.landfillLow).toBeCloseTo(0.56, 4);
    expect(factors.landfillHigh).toBeCloseTo(1.4, 4);
    // Composting is not emission free, so the avoided figure is below the landfill factor.
    expect(factors.compostProcess).toBeCloseTo(0.1915, 4);
    expect(factors.avoidedCentral).toBeCloseTo(0.9285, 3);
    expect(factors.avoidedCentral).toBeLessThan(factors.landfillCentral);
  });

  it('keeps the low estimate below the central and the central below the high', () => {
    for (const estimate of getCarbonEstimates().estimates) {
      expect(estimate.low).toBeLessThan(estimate.central);
      expect(estimate.central).toBeLessThan(estimate.high);
    }
  });

  it('names an existing assumption for every estimate', () => {
    const known = new Set(estimateAssumptions.map((item) => item.id));
    for (const estimate of getCarbonEstimates().estimates) {
      expect(estimate.assumptions.length).toBeGreaterThan(0);
      for (const id of estimate.assumptions) expect(known.has(id)).toBe(true);
    }
  });

  it('sources every assumption and never claims a local measurement', () => {
    for (const assumption of estimateAssumptions) {
      expect(assumption.source.length).toBeGreaterThan(10);
      expect(assumption.note.length).toBeGreaterThan(20);
    }
    expect(estimateAssumptions.find((item) => item.id === 'legacy-unit')!.source).toMatch(/Not declared/);
  });

  it('states what each unconverted line would need', () => {
    const { unconverted } = getCarbonEstimates();
    expect(unconverted.length).toBeGreaterThanOrEqual(6);
    for (const item of unconverted) {
      expect(item.missing.length).toBeGreaterThan(40);
      expect(item.physical.length).toBeGreaterThan(5);
    }
    expect(unconverted.map((item) => item.id)).toContain('sewage-load');
  });

  it('refuses the word inventory for what it produces', () => {
    expect(getCarbonEstimates().boundary).toMatch(/[Nn]one of it is a certified inventory/);
    expect(getCarbonEstimates().boundary).toMatch(/published default factor/);
  });
});

describe('segregation at source', () => {
  it('reads the one complete urban day without treating it as a period', () => {
    const day = segregationAtSource();
    expect(day.day).toBe('2026-08-12');
    expect(day.households).toBe(4709868);
    expect(day.segregated).toBe(1915723);
    expect(day.secretariats).toBe(4023);
    expect(day.silentSecretariats).toBe(1702);
    expect(day.reach!).toBeCloseTo(0.5606, 3);
    expect(day.segregationOfCollected!).toBeCloseTo(0.7254, 3);
  });
});
