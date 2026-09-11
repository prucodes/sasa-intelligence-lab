import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverviewReview } from '@/app/overview-review';
import { getOverviewIssues } from '@/lib/overview';
import { getRuralMovement } from '@/lib/rural-movement';
import { GapExplorer } from '@/app/gap-explorer';

const href = (path: string) => `${path}?mode=governed`;
const shapes = [{ d: 'Kurnool', path: 'M0 0L10 0L10 10Z' }, { d: 'No matched district', path: 'M20 20L30 20L30 30Z' }];

describe('connected overview interactions', () => {
  it('keeps the Gap Radar trend summary on the selected day basis too', () => {
    render(<GapExplorer/>);
    fireEvent.click(screen.getByRole('button',{name:'May–August trends'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Rural collection day basis'}),{target:{value:'working-days'}});
    const lede=screen.getByLabelText('Selected comparison');
    expect(lede).toHaveTextContent('-1.57');
    expect(lede).toHaveTextContent('6 districts that decline');
    expect(lede).toHaveTextContent('73,380');
  });
  it('keeps the statewide headline, figure and cohort aligned with the chart day basis', () => {
    render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const lede=screen.getByLabelText('Selected review subject');
    fireEvent.change(screen.getByRole('combobox',{name:'Rural collection day basis'}),{target:{value:'working-days'}});
    const expected=getRuralMovement('working-days');
    const change=(expected.series.at(-1)!.comparable.collectionRate!-expected.series[0].comparable.collectionRate!)*100;
    expect(lede).toHaveTextContent(`${expected.declining.length} districts that decline`);
    expect(lede).toHaveTextContent(change.toFixed(2));
    expect(lede).toHaveTextContent(expected.cohort.pairs.toLocaleString('en-IN'));
    expect(lede).toHaveTextContent('working days only');
    fireEvent.change(screen.getByRole('combobox',{name:'Rural collection day basis'}),{target:{value:'all-days'}});
    expect(lede).toHaveTextContent('5 districts that decline');
    expect(lede).toHaveTextContent('-1.29');
    expect(lede).toHaveTextContent('85,769');
  });
  it('keeps issue, district, map, list and concentration in sync', () => {
    render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const buttons = screen.getByRole('navigation', { name: 'Operational review subjects' });
    expect(within(buttons).getAllByRole('button')).toHaveLength(8);
    expect(within(buttons).getByRole('button', { name: /Rural collection change/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(buttons).getByRole('button', { name: /Vehicle delivery/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Kurnool:/ }));
    expect(screen.getByRole('combobox', { name: 'Review district' })).toHaveValue('Kurnool');
    expect(buttons).toHaveAccessibleDescription(/Totals cover returned districts only/);
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
    fireEvent.click(screen.getByRole('button', { name: /Household toilets/ }));
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
