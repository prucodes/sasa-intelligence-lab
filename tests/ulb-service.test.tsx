import {describe,it,expect} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {buildUlbServiceSnapshot} from '../scripts/aggregate-ulb-service.mjs';
import {validateAggregate} from '../scripts/aggregate-contract.mjs';
import {serviceSnapshot as data,serviceCategory,serviceRates,serviceExclusions,serviceCoordinates} from '@/lib/ulb-service';
import {UlbServiceRadar} from '@/app/ulb-service-radar';
import {GapExplorer} from '@/app/gap-explorer';

const row={date1:'2026-08-12',district_code:'1',district_name:'District',ulb_code:'10',ulb_name:'ULB',sachivalayam_code:'100',api_lgd_dist_code:'1',api_lgd_mandal_code:'10',total_households:'100',collected_households:'80',garbage_segregation:'64'};
describe('ULB service evidence',()=>{
  it('collapses duplicates and computes ratios of sums, including actual zero collection',()=>{
    const zero={...row,sachivalayam_code:'101',total_households:'900',collected_households:'0',garbage_segregation:'0'};
    const result=buildUlbServiceSnapshot([row,row,zero],[row,zero,zero]);
    expect(result.ulbs[0]).toMatchObject({households:1000,collected:80,segregated:64,secretariats:2});
    expect(serviceRates(result.ulbs[0])).toEqual({collection:8,segregation:80});
    expect(validateAggregate('ulb-service-snapshot.json',result)).toEqual([]);
  });
  it('fails closed on conflicting, unmatched, missing or impossible evidence',()=>{
    for(const [left,right] of [
      [[row,{...row,collected_households:'79'}],[row]],
      [[row],[{...row,sachivalayam_code:'other'}]],
      [[row],[{...row,total_households:'101'}]],
      [[{...row,collected_households:''}],[row]],
      [[row],[{...row,garbage_segregation:'81'}]],
      [[row],[{...row,ulb_code:'20'}]],
    ]) expect(()=>buildUlbServiceSnapshot(left,right)).toThrow('withheld');
  });
  it('holds out an entire ULB on any member code discrepancy and never invents a zero Y',()=>{
    const mismatched={...row,sachivalayam_code:'101',api_lgd_mandal_code:'99'};
    const result=buildUlbServiceSnapshot([row,mismatched],[row,mismatched]);
    expect(result.ulbs[0].mappingReviewSecretariats).toBe(1);
    expect(serviceCategory(result.ulbs[0])).toBeNull();
    const zero={...result.ulbs[0],mappingReviewSecretariats:0,collected:0,segregated:0};
    expect(serviceRates(zero)).toEqual({collection:0,segregation:null});expect(serviceCategory(zero)).toBeNull();
  });
  it('places the real examples in all four categories and partitions all 123 ULBs',()=>{
    const expected={TADIPATRI:'both',KUPPAM:'both',NARSIPATNAM:'segregation',GUNTAKAL:'collection',ANANTAPUR:'review'};
    for(const [name,category] of Object.entries(expected)) expect(serviceCategory(data.ulbs.find(u=>u.name===name)!)).toBe(category);
    const eligible=data.ulbs.filter(u=>!serviceExclusions(u).length);
    expect(eligible).toHaveLength(108);expect(data.ulbs.length-eligible.length).toBe(15);
    expect(serviceCoordinates(eligible).reduce((n,g)=>n+g.ulbs.length,0)).toBe(108);
    expect(data.totals).toEqual({households:4709868,collected:2640792,segregated:1915723});
    const exact={...eligible[0],households:100,collected:80,segregated:64};
    expect(serviceCategory(exact)).toBe('both');expect(serviceCategory(exact,90,90)).toBe('review');
  });
  it('detects aggregate tampering in member measures and mapping eligibility',()=>{
    const copy=structuredClone(data);copy.ulbs[0].mappingReviewSecretariats++;
    copy.points[0][3]=99999999;
    expect(validateAggregate('ulb-service-snapshot.json',copy).join(' ')).toMatch(/mappingReviewSecretariats/);
    expect(validateAggregate('ulb-service-snapshot.json',copy).join(' ')).toMatch(/containment breach/);
  });
});
describe('ULB service matrix interactions',()=>{
  it('defaults Gap Radar to the real service matrix and retains delivery access',()=>{
    render(<GapExplorer/>);
    expect(screen.getByRole('button',{name:'ULB service snapshot'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('region',{name:'ULB service performance snapshot'})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'ULB delivery comparison'}));
    expect(screen.getByRole('combobox',{name:'ULB comparison programme'})).toBeVisible();
  });
  it('compares selected ULBs and updates categories without changing measured positions',()=>{
    render(<UlbServiceRadar/>);
    const kuppam=data.ulbs.find(u=>u.name==='KUPPAM')!;
    fireEvent.change(screen.getByLabelText('Compare service peer'),{target:{value:kuppam.code}});
    const detail=screen.getByRole('region',{name:'Selected service ULB'});
    expect(within(detail).getByText(/versus/)).toBeVisible();
    expect(within(detail).getAllByText(/selected minus peer/,{selector:'small'}).map(e=>e.textContent)).toEqual(['-0.8 pp · selected minus peer','-13.3 pp · selected minus peer']);
    fireEvent.change(screen.getByLabelText('Segregation reference'),{target:{value:'60'}});
    expect(within(detail).getByText('Doing well on both',{selector:'.usr-position'})).toBeVisible();
    expect(within(detail).getByText('69.5%',{selector:'.usr-metrics strong'})).toBeVisible();
    fireEvent.change(screen.getByLabelText('Find service ULB'),{target:{value:data.ulbs.find(u=>u.name==='ICHAPURAM')!.code}});
    expect(screen.getByLabelText('Compare service peer')).toHaveValue('');
    expect(within(detail).queryByText(/versus/)).toBeNull();
  });
  it('resets selections when filtering and gives held-out ULBs explicit reasons',()=>{
    render(<UlbServiceRadar/>);
    fireEvent.change(screen.getByLabelText('Service snapshot district'),{target:{value:data.ulbs[0].district}});
    expect(screen.getByLabelText('Find service ULB')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Service snapshot district'),{target:{value:''}});
    const zero=data.ulbs.find(u=>u.name==='ICHAPURAM')!;
    fireEvent.change(screen.getByLabelText('Find service ULB'),{target:{value:zero.code}});
    expect(screen.getByLabelText('Compare service peer')).toBeDisabled();
    expect(within(screen.getByRole('region',{name:'Selected service ULB'})).getByText('Not defined')).toBeVisible();
  });
});
