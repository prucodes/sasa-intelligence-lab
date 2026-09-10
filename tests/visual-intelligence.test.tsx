import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {DistrictMap} from '@/app/district-map';
import {RuralRadar} from '@/app/rural-radar';
import {DeliveryPlans} from '@/app/delivery-plans';
import {ProgrammeExplorer} from '@/app/programme-explorer';
import {SourceReconciliation} from '@/app/source-reconciliation';
import {matchDistrictMeasure,eligibleMovementPoints,observedMedian} from '@/lib/visual-evidence';
import {geographicProgrammes,getProgrammeGeography} from '@/lib/programme-geography';
import {governedSnapshotByKey} from '@/lib/snapshots';

describe('geographic and movement intelligence',()=>{
  it('connects source bars to the selected reporting period and explains an empty search',()=>{
    render(<SourceReconciliation/>);
    fireEvent.click(screen.getAllByRole('button',{name:/Inspect May 2026/})[0]);
    expect(screen.getByRole('combobox',{name:'Reported month'})).toHaveValue('2026-05');
    expect(screen.getByRole('table')).toHaveAccessibleName(/May 2026/);
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'NoSuchDistrict'}});
    expect(screen.getByText('No district matches this search.')).toBeVisible();
    expect(screen.getByText(/May 2026 · 0 of 28 districts/)).toBeVisible();
  });
  it('requires a unique district match in both directions',()=>{
    const rows=[{district:'SPSR Nellore',value:0,detail:'Reported zero'}];
    const shapes=[{d:'Sri Potti Sriramulu Nellore',path:'M0 0L1 1Z'}];
    expect(matchDistrictMeasure(shapes[0].d,rows,shapes)).toBe(rows[0]);
    expect(matchDistrictMeasure(shapes[0].d,[...rows,{...rows[0],district:shapes[0].d}],shapes)).toBeNull();
    expect(matchDistrictMeasure(shapes[0].d,rows,[...shapes,{...shapes[0],d:'SPSR Nellore'}])).toBeNull();
    expect(matchDistrictMeasure('Markapuram',rows,shapes)).toBeNull();
  });
  it('keeps zero distinct from missing and unmatched districts selectable',()=>{
    const onSelect=vi.fn();
    const rows=[{district:'Guntur',value:0,detail:'Zero'},{district:'Krishna',value:null,detail:'Missing'},{district:'Markapuram',value:12,detail:'No polygon'}];
    render(<DistrictMap rows={rows} selected="" onSelect={onSelect} title="Review" unit="%" shapes={rows.slice(0,2).map((row,i)=>({d:row.district,path:`M${i} 0L1 1Z`}))}/>);
    const zero=screen.getByRole('button',{name:'Guntur: 0 %'}),missing=screen.getByRole('button',{name:'Krishna: Not available'});
    expect(zero.getAttribute('fill')).not.toContain('url(');expect(missing.getAttribute('fill')).toContain('url(');
    fireEvent.keyDown(zero,{key:'Enter'});expect(onSelect).toHaveBeenLastCalledWith('Guntur');
    fireEvent.change(screen.getByRole('combobox',{name:'Map district'}),{target:{value:'Markapuram'}});expect(onSelect).toHaveBeenLastCalledWith('Markapuram');
    expect(screen.queryByRole('button',{name:/Markapuram:/})).toBeNull();
  });
  it('plots actual coordinates, excludes incomplete observations and supports both chart views',()=>{
    const good={district:'A',pairs:50,julyRate:.25,augustRate:.75,changePercentagePoints:50};
    const rows=[good,{...good,district:'Missing',julyRate:null},{...good,district:'Invalid',augustRate:1.1},{...good,district:'Unpaired',pairs:0}];
    expect(eligibleMovementPoints(rows)).toEqual([good]);expect(observedMedian([.2,.4,.8,.9])).toBeCloseTo(.6);
    const onSelect=vi.fn();render(<RuralRadar rows={rows} selected="" onSelect={onSelect}/>);
    const point=screen.getByRole('button',{name:/A: July 25.00%, August 75.00%/});
    const dot=point.querySelector('.radar-point-dot')!;
    expect(dot.getAttribute('cx')).toBe('191.5');expect(dot.getAttribute('cy')).toBe('125');
    expect(screen.queryByRole('button',{name:/Missing: July/})).toBeNull();
    fireEvent.keyDown(point,{key:' '});expect(onSelect).toHaveBeenLastCalledWith('A');
    fireEvent.click(screen.getByRole('button',{name:'Starting point & change'}));
    expect(dot.getAttribute('cy')).toBe('40');expect(screen.getByText(/observed district median starting rate \(25.00%\)/)).toBeInTheDocument();
  });
  it('resolves every programme to usable geographic evidence at its declared grain',()=>{
    expect(geographicProgrammes).toHaveLength(14);
    for(const spec of geographicProgrammes){
      const data=getProgrammeGeography(spec.id);
      expect(data.spec.id).toBe(spec.id);expect(data.paired,`${spec.id} paired rows`).toBeGreaterThan(0);
      expect(data.mapRows.length,`${spec.id} districts`).toBeGreaterThan(0);
    }
  });
  it('uses paired quantities per district and excludes disputed candidates before mapping',()=>{
    const key='sasa_mepma_households_promoted_for_home_composite_api',original=governedSnapshotByKey.get(key)!;
    const row=(name:string,target:string,achievement:string)=>({district_name:'D',ulb_name:name,month_no:'7',year:'2026',target,achievement});
    try{
      governedSnapshotByKey.set(key,{...original,records:[row('A','10','10'),row('B','90','0'),row('B','90','0'),row('Missing','100',''),row('Conflict','1','1'),row('Conflict','1','0')]});
      const data=getProgrammeGeography('home-compost');
      expect(data.mapRows[0].value).toBe(10);expect(data.quality.duplicateRows).toBe(1);expect(data.quality.conflictingRows).toBe(2);
    }finally{governedSnapshotByKey.set(key,original);}
  });
  it('keeps future works achievements missing and resets map scope on programme change',()=>{
    render(<DeliveryPlans overview/>);
    fireEvent.change(screen.getByRole('combobox',{name:'Map district'}),{target:{value:'Guntur'}});
    expect(screen.getByRole('combobox',{name:'Map district'})).toHaveValue('Guntur');
    fireEvent.change(screen.getByRole('combobox',{name:'Reporting period'}),{target:{value:'202703'}});
    expect(screen.getByRole('combobox',{name:'Map district'})).toHaveValue('');
    fireEvent.click(screen.getByText('Inspect 28 district positions'));
    const table=screen.getByRole('table');expect(table).toHaveTextContent('Not reported');expect(table).not.toHaveTextContent('0.0%');
    fireEvent.change(screen.getByRole('combobox',{name:'Works programme'}),{target:{value:'magic-drains'}});
    expect(screen.getByRole('combobox',{name:'Reporting period'})).toHaveValue('202608');
  });
  it('connects programme map selection to its quantities and keeps undated positions undated',()=>{
    render(<ProgrammeExplorer/>);
    const select=screen.getByRole('combobox',{name:'Map district'});
    const option=within(select).getAllByRole('option')[1] as HTMLOptionElement;
    fireEvent.change(select,{target:{value:option.value}});
    expect(screen.getByRole('group',{name:'Selected geographic programme'})).toHaveTextContent(option.value);
    fireEvent.change(screen.getByRole('combobox',{name:'Geographic programme'}),{target:{value:'plastic-units'}});
    expect(screen.getByRole('group',{name:'Selected geographic programme'})).toHaveTextContent('Reporting period not supplied');
    expect(screen.queryByRole('combobox',{name:'Programme map period'})).toBeNull();
  });
});
