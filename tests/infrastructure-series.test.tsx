import {describe,it,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {InfrastructureSeries} from '@/app/infrastructure-series';
import data from '@/data/aggregates/infrastructure-series.json';
import {validateAggregate} from '@/scripts/aggregate-contract.mjs';
describe('all-month infrastructure comparison',()=>{
 it('keeps a common denominator and identifies monthly context separately',()=>{
  expect(data.series.map(s=>s.period)).toEqual(['2026-05','2026-06','2026-07','2026-08']);
  expect(data.commonObservations).toBe(83186);
  render(<InfrastructureSeries/>);
  expect(screen.getByText(/83,186 registered GP\/day-of-month/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Infrastructure evidence basis'),{target:{value:'full'}});
  expect(screen.getByText(/Month lengths and reporting populations differ/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Infrastructure month'),{target:{value:'2026-05'}});
  expect(screen.getByRole('heading',{name:/2026-05 · the observations/})).toBeInTheDocument();
 });
 it('rejects altered rates and common-cohort populations',()=>{
  const broken=structuredClone(data);broken.series[0].comparable[0].rate=.99;broken.series[1].comparable[0].valid++;
  expect(validateAggregate('infrastructure-series.json',broken).join(' ')).toMatch(/group rate.*common cohort population/);
 });
});
