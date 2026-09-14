import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { OverviewReview } from '@/app/overview-review';
import { getOverviewIssues } from '@/lib/overview';
import { getRuralMovement } from '@/lib/rural-movement';
import { GapExplorer } from '@/app/gap-explorer';

const href = (path: string) => `${path}?mode=governed`;
const shapes = [{ d: 'Kurnool', path: 'M0 0L10 0L10 10Z' }, { d: 'No matched district', path: 'M20 20L30 20L30 30Z' }];

describe('connected overview interactions', () => {
  beforeEach(()=>window.history.replaceState({},'', '/?mode=governed'));
  it('carries the rural district and day basis into a directly opened Radar comparison',()=>{
    const overview=render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    fireEvent.change(screen.getByRole('combobox',{name:'Rural collection day basis'}),{target:{value:'working-days'}});
    fireEvent.change(screen.getByRole('combobox',{name:'Map district'}),{target:{value:'Annamayya'}});
    const link=screen.getByRole('link',{name:'Inspect Annamayya in Gap Radar ↗'}).getAttribute('href')!;
    expect(link).toContain('basis=working-days&district=Annamayya');
    overview.unmount();window.history.replaceState({},'',link);render(<GapExplorer/>);
    expect(screen.getByRole('button',{name:'Rural trends'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('combobox',{name:'Map district'})).toHaveValue('Annamayya');
    expect(screen.getByRole('combobox',{name:'Rural collection day basis'})).toHaveValue('working-days');
    fireEvent.change(screen.getByRole('combobox',{name:'Rural collection day basis'}),{target:{value:'all-days'}});
    expect(new URLSearchParams(window.location.search).get('basis')).toBe('all-days');
  });
  it('carries programme and district from Overview into ULB delivery comparison',()=>{
    const overview=render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    fireEvent.click(screen.getByRole('button',{name:/Vehicle delivery ULB/}));
    fireEvent.change(screen.getByRole('combobox',{name:'Review district'}),{target:{value:'Kurnool'}});
    const link=screen.getByRole('link',{name:/Compare Kurnool ULBs/}).getAttribute('href')!;
    overview.unmount();window.history.replaceState({},'',link);render(<GapExplorer/>);
    expect(screen.getByRole('combobox',{name:'ULB comparison programme'})).toHaveValue('collection');
    expect(screen.getByRole('combobox',{name:'ULB comparison district'})).toHaveValue('Kurnool');
  });
  it('keeps the Gap Radar trend summary on the selected day basis too', () => {
    render(<GapExplorer/>);
    fireEvent.click(screen.getByRole('button',{name:'Rural trends'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Rural collection day basis'}),{target:{value:'working-days'}});
    const lede=screen.getByRole('region',{name:'Four-month rural collection comparison'});
    expect(lede).toHaveTextContent('-1.57');
    expect(lede).toHaveTextContent('6 districts decline');
    expect(lede).toHaveTextContent('73,380 to 73,739 GP-day observations, a different subset each month');
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
    expect(lede).toHaveTextContent('73,380 to 73,739 panchayat-days a month');
    expect(lede).toHaveTextContent('without Sundays and second Saturdays');
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

  it('shows a validated cross-subject signal without inventing an overall score', () => {
    render(<OverviewReview shapes={shapes} failed={false} href={href}/>);
    const signal = screen.getByRole('region', { name: 'Validated cross-subject signals' });
    // 49 ULBs share a name and district across the three sources, but only 19 can be rated in all three.
    expect(signal).toHaveTextContent('49 ULBs carry the same name and district in all three July delivery measures, but only 19 can be rated in all three');
    expect(signal).toHaveTextContent('39%');
    expect(signal).toHaveTextContent('19 of 49 candidates');
    expect(signal).toHaveTextContent('18 candidates report zero in toilets and vehicles');
    expect(signal).toHaveTextContent('Overall rank gated');
    expect(signal).toHaveTextContent('no cross-subject trend is summed');
    // Nineteen ratable ULBs, eighteen of them zero, is too thin to call aligned evidence.
    expect(signal).toHaveTextContent('Too little overlap for an overall score');
    expect(signal).not.toHaveTextContent('strong enough');
    // A month identical to the one before in every field reads as possibly carried forward, not as steady ULBs.
    expect(signal).toHaveTextContent('July 2026 is identical to June 2026 in every field for 123 of 123 ULBs');
    expect(signal).toHaveTextContent('can be a repeated report rather than no progress');
    expect(within(signal).getByRole('link', { name: /Inspect subject comparisons/ })).toHaveAttribute('href', '/gap-radar?mode=governed&view=rankings');
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
