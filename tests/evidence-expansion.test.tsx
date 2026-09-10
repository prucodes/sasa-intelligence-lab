import {getRevisionAnalysis,getRevisionInventory,summarizeRevision,revisionMeasures} from '@/lib/source-revisions';
import {readinessCatalogueStats} from '@/lib/catalogue';
import {SourceRevisions} from '@/app/source-revisions';
import {describe,it,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {RuralMovement} from '@/app/rural-movement';
import {DeliveryPlans} from '@/app/delivery-plans';
import {getRuralMovement} from '@/lib/rural-movement';
import {getCorpusEvidenceCounts} from '@/lib/duplicate-sources';
import {getGapCapabilities} from '@/lib/gap-capabilities';
import {getDataQualityIssues,getSupportingProgrammePortfolio} from '@/lib/analytics';
import {excludeDisputed} from '@/lib/disputes';
import {governedSnapshotByKey} from '@/lib/snapshots';
import {reconcileSources,ihhlConstructionSources,sumReturned} from '@/lib/source-reconciliation';
import {datasets} from '@/lib/domain';

describe('expanded governed evidence',()=>{
  it('shows matched rates and updates scope to the selected district',()=>{
    const data=getRuralMovement();
    expect(data.districts.reduce((n,d)=>n+d.pairs,0)).toBe(85769);
    data.series.forEach((point,i)=>expect(data.districts.reduce((n,d)=>n+d.pairs*d.points[i].collectionRate!,0)/data.cohort.pairs).toBeCloseTo(point.comparable.collectionRate,4));
    expect(data.declining).toHaveLength(5);expect(data.rising).toHaveLength(2);
    render(<RuralMovement/>);
    expect(screen.getByRole('img',{name:/Statewide first-week/})).toHaveAccessibleName(/74.71%.*74.72%.*73.66%.*73.42%/);
    fireEvent.click(screen.getByRole('button',{name:'Annamayya',exact:true}));
    expect(screen.getByRole('img',{name:/Annamayya first-week/})).toHaveAccessibleName(/76.58%.*54.82%/);

  });
  it('opens supported reviews and clears the recovered Gobardhan blocker',()=>{
    expect(getGapCapabilities().every(capability=>capability.available)).toBe(true);
    const issue=getDataQualityIssues().find(issue=>issue.id==='unavailable');
    expect(issue).toMatchObject({count:0,severity:'info'});
    expect(datasets.SAMPLE.readiness.gates.find(gate=>gate.title==='Bundled response totals reconcile')?.state).toBe('met');
    expect(datasets.SAMPLE.readiness.cards.some(card=>card.value==='44 / 30')).toBe(false);
    expect(getCorpusEvidenceCounts()).toEqual({rawRows:6509,rowsExcludingAliases:6173,aliasRows:336,aliasRoutes:1});
  });
  it('keeps all 12 works months, defaulting to achievement and showing March as plan only',()=>{
    render(<DeliveryPlans/>);
    const position=screen.getByRole('group',{name:'Selected programme position'});
    expect(position).toHaveTextContent('August 2026 achievement');
    const march=screen.getByRole('button',{name:/March 2027: plan only, achievement not reported/});
    expect(screen.getAllByRole('button',{name:/; target/})).toHaveLength(12);
    fireEvent.click(march);
    expect(position).toHaveTextContent('March 2027 · plan only');expect(position).toHaveTextContent('Not reported');expect(position).toHaveTextContent('No rate');
    expect(position).not.toHaveTextContent('0.0%');
    fireEvent.change(screen.getByRole('combobox',{name:'Works programme'}),{target:{value:'magic-drains'}});
    expect(position).toHaveTextContent('August 2026 achievement');
  });
  it('fails on a wholly absent measure and keeps year-separated observations independent',()=>{
    const row={district_name:'D',ulb_name:'U',month_no:'7',year:'2026',achievement:'1'};
    expect(()=>excludeDisputed([row],'nonexistent')).toThrow('Dispute measure is absent');
    expect(excludeDisputed([row,{...row,year:'2027',achievement:'2'}],'achievement').excludedRows).toBe(0);
    expect(excludeDisputed([row,{...row,achievement:'2'}],'achievement').excludedRows).toBe(2);
  });
  it('excludes disagreements in resolved aliases and in the denominator before portfolio totals',()=>{
    const key='sasa_50_percent_green_spaces_api';const original=governedSnapshotByKey.get(key)!;
    const base={district_name:'D',month_no:'7',year:'2026'};
    const records=[
      {...base,ulb_name:'A',target:'10',achievement:'2'},
      {...base,ulb_name:'A',green_spaces_target_in_nos:'10',green_spaces_achieved:'3'},
      {...base,ulb_name:'B',target:'10',achievement:'4'},
      {...base,ulb_name:'B',target:'20',achievement:'4'},
      {...base,ulb_name:'ZERO',target:'10',achievement:'0'},
      {...base,ulb_name:'MISSING',target:'90',achievement:''},
    ];
    try{
      governedSnapshotByKey.set(key,{...original,records} as typeof original);
      const item=getSupportingProgrammePortfolio().find(item=>item.tableKey===key)!;
      expect(item.disputedEntitiesExcluded).toBe(2);expect(item.records).toBe(2);
      expect(item.achievement).toBe(0);expect(item.target).toBe(100);expect(item.coverage).toBe(0);
    }finally{governedSnapshotByKey.set(key,original);}
  });
  it('joins the full year-month and never turns an all-missing source sum into zero',()=>{
    expect(sumReturned([null,null])).toBeNull();expect(sumReturned([0,null])).toBe(0);
    const [left,right]=ihhlConstructionSources;
    const originalL=governedSnapshotByKey.get(left.tableKey)!;const originalR=governedSnapshotByKey.get(right.tableKey)!;
    const row=(year:string)=>({lgd_district_name:'D',year,month_no:'7',construction_of_ihhls_target_units:'10',construction_of_ihhls_achievement:'1',ihhls_target_units:'20',ihhls_achievement:'2'});
    try{
      governedSnapshotByKey.set(left.tableKey,{...originalL,records:[row('2026'),row('2027')]});
      governedSnapshotByKey.set(right.tableKey,{...originalR,records:[row('2026')]});
      const result=reconcileSources(left,right);
      expect(result.matched).toBe(1);expect(result.rows[0].periodKey).toBe('2026-07');expect(result.left.disputed).toBe(0);
      expect(result.leftOnly).toEqual(['D']);
    }finally{governedSnapshotByKey.set(left.tableKey,originalL);governedSnapshotByKey.set(right.tableKey,originalR);}
  });
});

describe('current schema revisions',()=>{
  it('assesses all staged responses and resolves merged measures once',()=>{
    // One row per retained current response, so this tracks the sync rather than a fixed vintage.
    expect(getRevisionInventory()).toHaveLength(readinessCatalogueStats.freshResponsesRetained);
    expect(getRevisionInventory().filter(row=>row.changed)).toHaveLength(9);
    const assets=getRevisionAnalysis('e-autos');
    expect(assets.identicalRoutes).toHaveLength(4);expect(assets.rows).toHaveLength(28);expect(assets.target).toBe(200);expect(assets.achievement).toBe(200);
    const green=getRevisionAnalysis('green-spaces');
    expect(green.identicalRoutes).toHaveLength(3);expect(green.rows).toHaveLength(123);expect(green.quality.duplicateRows).toBe(82);expect(green.target).toBe(100);expect(green.achievement).toBe(78);
    expect(getRevisionAnalysis('green-cover').achievement).toBeCloseTo(303.01,2);
    expect(getRevisionAnalysis('plastic-units')).toMatchObject({selectedPeriod:null,target:210,achievement:88});
    expect(getRevisionAnalysis('odf-villages')).toMatchObject({selectedPeriod:null,target:15995,achievement:15955});
  });
  it('holds revised conflicting measure pairs out and retains zero separately from blank',()=>{
    const spec=revisionMeasures[0];
    const rows=[{dstrt_nm:'Conflict',e_autos_target:'10',e_autos_achievement:'2'}, {dstrt_nm:'Conflict',e_autos_target:'10',e_autos_achievement:'3'}, {dstrt_nm:'Zero',e_autos_target:'10',e_autos_achievement:'0'}, {dstrt_nm:'Missing',e_autos_target:'90',e_autos_achievement:''}];
    const data=summarizeRevision(rows,spec);
    expect(data.quality.conflictingRows).toBe(2);expect(data.paired).toBe(1);expect(data.ratio).toBe(0);expect(data.missingMeasure).toBe(1);
    expect(summarizeRevision([rows[3]],spec).achievement).toBeNull();
  });
  it('renders undated revisions without inventing a monthly or zero-activity claim',()=>{
    render(<SourceRevisions/>);
    fireEvent.change(screen.getByRole('combobox',{name:'Revised measure'}),{target:{value:'plastic-units'}});
    const position=screen.getByRole('group',{name:'Revised source position'});
    expect(position).toHaveTextContent('Reporting period not supplied');expect(position).toHaveTextContent('88');expect(position).toHaveTextContent('210');
    expect(screen.queryByRole('combobox',{name:'Source period'})).not.toBeInTheDocument();
  });
});
