import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {buildUlbComparison,getUlbComparison} from '@/lib/ulb-comparison';
import {getOverviewIssues} from '@/lib/overview';
import {UlbRadar} from '@/app/ulb-radar';
import {UlbPeerProfile} from '@/app/ulb-peer-profile';
import {createProvider,diagnosticsKeyFor} from '@/lib/domain';
import {comparisonDiagnosticKey,ulbComparisonSources} from '@/lib/ulb-diagnostics-link';
import {sourceCandidateKey} from '@/lib/snapshots';

describe('ULB comparison',()=>{
  it('keeps genuine zero completion, holds out zero denominators and over-completion, and groups overlap',()=>{
    const issue=getOverviewIssues()[1];
    const row={key:'a',ulb:'A',district:'D',basis:10,completed:0,value:10};
    const data=buildUlbComparison({...issue,rows:[row,{...row,key:'b',ulb:'B'},{...row,key:'zero',basis:0},{...row,key:'over',completed:11},{...row,key:'done',completed:10,value:0}]});
    expect(data.points).toHaveLength(3);expect(data.unplotted).toHaveLength(2);
    expect(data.coordinates).toHaveLength(2);expect(data.coordinates[0].points).toHaveLength(2);
    expect(data.median).toBe(10);expect(data.points.map(p=>p.rate)).toEqual([0,0,100]);
  });
  it('preserves all source candidates in plotted or explained groups for every programme',()=>{
    for(const id of ['sanitation','collection','processing'] as const){
      const data=getUlbComparison(id);
      expect(data.points.length).toBeGreaterThan(0);
      expect(data.points.length+data.unplotted.length).toBe(data.rows.length);
      expect(data.coordinates.reduce((n,g)=>n+g.points.length,0)).toBe(data.points.length);
      expect(data.points.every(p=>p.rate>=0&&p.rate<=100)).toBe(true);
      for(const point of data.points){
        const key=comparisonDiagnosticKey(point.key,id,data.period);
        if(key){const diagnostic=createProvider('SAMPLE').getDiagnostic(key);expect(diagnostic.ulbKey).toBe(key);expect(diagnostic.evidence.some(e=>e.tableKey===ulbComparisonSources[id]&&e.period===data.period&&sourceCandidateKey(e.rawFields)===point.key)).toBe(true);}
      }
    }
  });
  it('connects ULB and peer selection to exact values and a real diagnostics route',()=>{
    const data=getUlbComparison();const [selected,peer]=data.points;
    render(<UlbRadar/>);
    fireEvent.change(screen.getByRole('combobox',{name:'Select comparison ULB'}),{target:{value:selected.key}});
    expect(screen.getByRole('link',{name:'Open ULB Diagnostics ↗'})).toHaveAttribute('href',`/diagnostics/${diagnosticsKeyFor(selected.ulb,selected.district)}?mode=governed&programme=sanitation`);
    fireEvent.change(screen.getByRole('combobox',{name:'Compare another ULB'}),{target:{value:peer.key}});
    expect(screen.getByRole('link',{name:'Inspect peer ↗'})).toBeVisible();
    fireEvent.change(screen.getByRole('combobox',{name:'ULB comparison programme'}),{target:{value:'collection'}});
    expect(screen.getByRole('combobox',{name:'Select comparison ULB'})).toHaveValue('');
    expect(screen.queryByRole('link',{name:'Inspect peer ↗'})).toBeNull();
  });
  it('words the reading guide for the programme on screen',()=>{
    render(<UlbRadar/>);
    const note=()=>screen.getByRole('note',{name:'How to read this chart'});
    expect(note()).toHaveTextContent('Each dot is one ULB in July 2026.');
    expect(note()).toHaveTextContent('More toilets approved, so a bigger job.');
    fireEvent.change(screen.getByRole('combobox',{name:'ULB comparison programme'}),{target:{value:'processing'}});
    expect(note()).toHaveTextContent('More tonnes of legacy waste to clear, so a bigger job.');
    expect(note()).toHaveTextContent(/Vertical: the middle ULB's workload \([\d,.]+\)\. Horizontal: half completed\. Reading guides, not targets\./);
  });
  it('excludes the selected ULB from its own peer distribution and keeps zero approvals unscored',()=>{
    const data=getUlbComparison();const point=data.points[0];
    const diagnostic=createProvider('SAMPLE').getDiagnostic(diagnosticsKeyFor(point.ulb,point.district));
    expect(diagnostic.name.toLowerCase()).toBe(point.ulb.toLowerCase());
    const onInspect=vi.fn();const {unmount}=render(<UlbPeerProfile records={diagnostic.evidence} onInspect={onInspect}/>);
    const region=screen.getByRole('region',{name:'ULB delivery position among peers'});
    const counts=within(region).getAllByRole('definition').map(el=>Number(el.textContent));
    expect(counts.reduce((n,v)=>n+v,0)).toBe(data.points.length-1);
    fireEvent.click(screen.getByRole('button',{name:'Inspect these figures ↗'}));
    expect(onInspect).toHaveBeenCalledWith(expect.any(String));unmount();
    render(<UlbPeerProfile records={createProvider('SAMPLE').getDiagnostic('sample-narsipatnam').evidence} onInspect={vi.fn()}/>);
    expect(screen.getByRole('combobox',{name:'Diagnostic comparison programme'})).toHaveValue('collection');
    expect(screen.getByRole('img',{name:/peers lower/})).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox',{name:'Diagnostic comparison programme'}),{target:{value:'sanitation'}});
    expect(screen.getByText('No comparable rate')).toBeVisible();
    expect(screen.queryByRole('img',{name:/peers lower/})).toBeNull();
  });
});
