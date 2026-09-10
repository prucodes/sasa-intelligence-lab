import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RuralCohort } from '../app/rural-cohort';
import { DeliveryPlans } from '../app/delivery-plans';
import { ReportingContinuity } from '../app/reporting-continuity';

describe('governed reference controls',()=>{
  it('keeps quality counts visible and switches to present-centre conditions',()=>{
    render(<RuralCohort/>);
    expect(screen.getByLabelText('Record quality')).toHaveTextContent('91,427');
    expect(screen.getByText('Source completeness unproven')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox',{name:'Breakdown'}),{target:{value:'condition'}});
    const table=within(screen.getByRole('region',{name:'Inspect the comparison'})).getByRole('table');
    expect(within(table).getByRole('rowheader',{name:'Fully Functioning'})).toBeVisible();
    expect(within(table).queryByRole('rowheader',{name:'Registered without one'})).toBeNull();
    expect(screen.queryByText('It predicts nothing.')).toBeNull();
  });
  it('changes programme and period without summing monthly positions',()=>{
    render(<DeliveryPlans/>);
    fireEvent.change(screen.getByRole('combobox',{name:'Works programme'}),{target:{value:'sanitary-complexes'}});
    expect(within(screen.getByRole('group',{name:'Selected programme position'})).getByText('2,758')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox',{name:'Reporting period'}),{target:{value:'202605'}});
    expect(within(screen.getByRole('group',{name:'Selected programme position'})).getByText('1,179')).toBeVisible();
  });
  it('allows a valid-zero day to be inspected without calling it missing',()=>{
    render(<ReportingContinuity/>);
    const button=screen.getByRole('button',{name:/2026-08-13:/});
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed','true');
    expect(screen.getByText('Records with a valid zero')).toBeVisible();
    expect(screen.getByText('Records missing the measure')).toBeVisible();
  });
});
