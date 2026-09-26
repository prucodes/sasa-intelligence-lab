import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { EnvironmentLedger } from '@/app/environment-ledger';
import { LabApp } from '@/app/lab-app';

describe('environment and carbon screen', () => {
  it('is reachable from the primary navigation', () => {
    render(<LabApp page="environment" initialMode="SAMPLE" />);
    const navigation = screen.getByRole('complementary', { name: 'Primary navigation' });
    expect(within(navigation).getByRole('link', { name: 'Environment & Carbon' })).toHaveAttribute('href', expect.stringContaining('/environment'));
    expect(navigation.querySelector('[aria-current="page"]')).toHaveAttribute('aria-label', 'Environment & Carbon');
  });

  it('opens on the physical ledger, not on the estimates', () => {
    render(<EnvironmentLedger mode="SAMPLE" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Legacy waste still on the ground/)).toBeInTheDocument();
    // The estimate figures must not be on screen until a reader asks for them.
    expect(screen.queryAllByText(/Estimates, not measurements/)).toHaveLength(0);
  });

  it('shows the household grain and says it is one day', () => {
    render(<EnvironmentLedger mode="SAMPLE" />);
    expect(screen.getByText('47,09,868')).toBeInTheDocument();
    expect(screen.getByText(/only complete day in retention/)).toBeInTheDocument();
  });

  it('carries the target alongside every figure that has one', () => {
    render(<EnvironmentLedger mode="SAMPLE" />);
    expect(screen.getByText('of 1,400 targeted')).toBeInTheDocument();
    expect(screen.getByText(/A length in kilometres of avenue planting/)).toBeInTheDocument();
  });

  it('labels the estimate layer as an estimate and shows the capacity ceiling', () => {
    render(<EnvironmentLedger mode="SAMPLE" />);
    fireEvent.click(screen.getByRole('tab', { name: /Carbon estimates/ }));
    expect(screen.getAllByText(/Estimates, not measurements/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /implies more wet waste than any completed plant can take/ })).toBeInTheDocument();
    // The derivation is on screen, so a reviewer can argue with a parameter.
    expect(screen.getByText('0.15 × 0.5 × 0.8 × 0.5 × 16/12 = 0.04 t CH4')).toBeInTheDocument();
    expect(screen.getByText('1.12 tCO2e per tonne')).toBeInTheDocument();
  });

  it('marks the undeclared legacy waste unit as an assumption in the table', () => {
    const { container } = render(<EnvironmentLedger mode="SAMPLE" />);
    fireEvent.click(screen.getByRole('tab', { name: /Carbon estimates/ }));
    const flagged = container.querySelectorAll('tr[data-undeclared="true"]');
    expect(flagged).toHaveLength(1);
    expect(flagged[0].textContent).toMatch(/assumed metric tonnes/);
  });

  it('names the missing measurement for every withheld conversion', () => {
    render(<EnvironmentLedger mode="SAMPLE" />);
    fireEvent.click(screen.getByRole('tab', { name: /What is missing/ }));
    expect(screen.getByRole('heading', { name: /What a certified inventory would need/ })).toBeInTheDocument();
    expect(screen.getByText(/Organic load per volume, as BOD or COD/)).toBeInTheDocument();
    expect(screen.getAllByText('What is needed to convert it').length).toBeGreaterThanOrEqual(6);
  });

  it('refuses to render a ledger in Demo or Live rather than showing a stand-in', () => {
    const { container: demo } = render(<EnvironmentLedger mode="DEMO" />);
    expect(demo.querySelector('.el-unavailable')).toBeInTheDocument();
    expect(demo.textContent).toMatch(/A fabricated carbon figure would be worse than none/);
    expect(demo.textContent).not.toMatch(/tCO2e/);

    const { container: live } = render(<EnvironmentLedger mode="LIVE" />);
    expect(live.querySelector('.el-unavailable')).toBeInTheDocument();
    expect(live.textContent).toMatch(/Live connector is on the roadmap/);
  });
});
