import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverviewReview } from '@/app/overview-review';
import { getOverviewIssues } from '@/lib/overview';

const href = (path: string) => `${path}?mode=governed`;
const shapes = [{ d: 'Kurnool', path: 'M0 0L10 0L10 10Z' }, { d: 'No matched district', path: 'M20 20L30 20L30 30Z' }];

describe('connected overview interactions', () => {
  it('keeps issue, district, map, list and concentration in sync', () => {
    render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const buttons = screen.getByRole('region', { name: 'Operational review issues' });
    expect(within(buttons).getByRole('button', { name: /Household toilets/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(buttons).getByRole('button', { name: /Vehicle delivery/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Kurnool:/ }));
    expect(screen.getByRole('combobox', { name: 'Review district' })).toHaveValue('Kurnool');
    expect(buttons).toHaveAccessibleDescription(/Totals across returned districts/);
    expect(screen.getByText(/One square = one usable ULB/)).toBeInTheDocument();
    const expected = getOverviewIssues()[0].rows.filter((row) => row.district === 'Kurnool' && row.value > 0);
    const list = screen.getByRole('list', { name: 'ULBs in selected review scope' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(Math.min(5, expected.length));
    expected.slice(0,5).forEach((row) => expect(within(list).getByText(row.ulb, { selector: 'b' })).toBeInTheDocument());
    expect(screen.getByText(/of .* vehicles · selected scope/)).toBeInTheDocument();
    fireEvent.click(within(buttons).getByRole('button', { name: /Legacy waste/ }));
    expect(screen.getByRole('combobox', { name: 'Review district' })).toHaveValue('');
    expect(screen.getByRole('link', { name: /Open full analysis/ })).toHaveAttribute('href', '/operational-analytics?mode=governed&tab=processing');
    expect(screen.queryByRole('button', { name: /No matched district/ })).not.toBeInTheDocument();
  });

  it('supports keyboard map selection and a usable fallback without boundaries', () => {
    const { rerender } = render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const district = screen.getByRole('button', { name: /^Kurnool:/ });
    fireEvent.keyDown(district, { key: 'Enter' });
    expect(district).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(district, { key: ' ' });
    expect(district).toHaveAttribute('aria-pressed', 'false');
    rerender(<OverviewReview shapes={null} failed={true} href={href}/>);
    expect(screen.getByText(/Map unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Review district' })).toBeEnabled();
  });
});
