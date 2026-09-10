import {describe,it,expect} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {getRankingDefinition,getSubjectProfile,rankSubject,rankingSubjects,type RankingInput} from '@/lib/subject-rankings';
import {SubjectRankings} from '@/app/subject-rankings';
import {getUlbComparison} from '@/lib/ulb-comparison';
const input=(key:string,top:number|null,bottom:number|null,district='D'):RankingInput=>({key,name:key,district,top,bottom,reasons:[],identity:null,candidate:key});
describe('subject rankings',()=>{
  it('shares competition ranks, includes valid zeros and excludes invalid evidence',()=>{
    const result=rankSubject([input('a',80,100),input('b',8,10),input('c',50,100),input('zero',0,100),input('undefined',0,0),input('missing',null,100),input('impossible',101,100),{...input('held',90,100),reasons:['Disputed']}]);
    expect(result.rows.map(r=>[r.key,r.rank,r.tied])).toEqual([['a',1,2],['b',1,2],['c',3,1],['zero',4,1]]);
    expect(result.excluded).toHaveLength(4);expect(result.population).toBe(8);
  });
  it('recalculates district ranks and resolves numerical ties at the disclosed precision',()=>{
    const inputs=[input('a',100,100,'A'),input('b',1,3,'B'),input('c',2,6,'B')];
    expect(rankSubject(inputs).rows[1].rank).toBe(2);
    expect(rankSubject(inputs,'B').rows.map(r=>r.rank)).toEqual([1,1]);
  });
  it('ranks collection zeroes separately from undefined segregation ratios',()=>{
    const reach=rankSubject(getRankingDefinition('reach').inputs),seg=rankSubject(getRankingDefinition('segregation').inputs);
    expect(reach.rows).toHaveLength(107);expect(reach.excluded).toHaveLength(11);
    expect(seg.rows).toHaveLength(103);expect(seg.excluded).toHaveLength(15);
    expect(reach.rows.find(r=>r.name==='ICHAPURAM')?.rate).toBe(0);
    expect(seg.excluded.find(r=>r.name==='ICHAPURAM')?.reasons).toContain('Zero denominator; rate undefined');
  });
  it('reconciles each delivery ranking to its existing governed comparison',()=>{
    for(const [id,programme] of [['toilets','sanitation'],['vehicles','collection'],['legacy','processing']] as const){
      const definition=getRankingDefinition(id),ranking=rankSubject(definition.inputs),existing=getUlbComparison(programme);
      expect(ranking.rows.length).toBe(existing.points.length);
      expect(ranking.rows.every(r=>r.rate>=0&&r.rate<=100)).toBe(true);
      for(const r of ranking.rows)expect(r.rate).toBeCloseTo(existing.points.find(p=>p.key===r.candidate)!.rate,8);
      expect(ranking.rows.length+ranking.excluded.length).toBe(definition.inputs.length);
    }
  });
  it('joins only native-code-linked profiles and holds matching names as candidates',()=>{
    const definitions=rankingSubjects.map(s=>getRankingDefinition(s.id));
    const selected=definitions[0].inputs.find(r=>r.name==='NARSIPATNAM')!;
    const profile=getSubjectProfile(selected,'reach',definitions);
    expect(profile.filter(p=>p.ranked)).toHaveLength(2);
    const toilets=profile.find(p=>p.definition.id==='toilets')!;
    expect(toilets.candidate).toBeDefined();expect(toilets.matched).toBeUndefined();expect(toilets.ranked).toBeUndefined();
    const other=getSubjectProfile(toilets.candidate!,'toilets',definitions);
    expect(other.filter(p=>p.matched)).toHaveLength(1);
  });
  it('keeps the five subjects separate without creating a combined score',()=>{
    for(const subject of rankingSubjects){
      const d=getRankingDefinition(subject.id),r=rankSubject(d.inputs);
      expect(d.period).not.toBe('Not returned');expect(r.rows.length).toBeGreaterThan(0);
      expect(new Set(d.inputs.map(r=>r.key)).size).toBe(d.inputs.length);
      expect(r.rows[0].rank).toBe(1);
    }
  });
});
describe('ranking interaction',()=>{
  it('searches without reranking and displays selected evidence and identity coverage',()=>{
    render(<SubjectRankings/>);
    const data=rankSubject(getRankingDefinition('reach').inputs),point=data.rows.find(r=>r.name==='NARSIPATNAM')!;
    fireEvent.change(screen.getByLabelText('Search ranked ULBs'),{target:{value:'Narsipatnam'}});
    const button=screen.getByRole('button',{name:'Inspect ranking profile for NARSIPATNAM'});
    fireEvent.click(button);
    expect(within(screen.getByRole('complementary',{name:'Selected subject ranking'})).getByText(new RegExp(`${point.rank}`),{selector:'.rk-rank'})).toBeVisible();
    expect(screen.getByText('2 / 5 measures linked and rankable')).toBeVisible();
    expect(screen.getAllByText('Identity not linked').length).toBeGreaterThan(0);
  });
  it('clears stale selections when subject or population changes',()=>{
    render(<SubjectRankings/>);
    fireEvent.change(screen.getByLabelText('Ranking subject'),{target:{value:'vehicles'}});
    expect(screen.getByText('The rank is the starting point.')).toBeVisible();
    expect(screen.getByText('Supplied vehicles ÷ Vehicles on work orders × 100')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Ranking population'),{target:{value:getRankingDefinition('vehicles').inputs[0].district}});
    expect(screen.getByLabelText('Search ranked ULBs')).toHaveValue('');
  });
  it('renders a subject graph for every selectable field and keeps search scoped to the graph',()=>{
    render(<SubjectRankings/>);
    for(const subject of rankingSubjects){
      fireEvent.change(screen.getByLabelText('Ranking subject'),{target:{value:subject.id}});
      const graph=screen.getByRole('region',{name:new RegExp(`${subject.label} ranking graph`,'i')});
      expect(within(graph).getByText(new RegExp(subject.label))).toBeVisible();
      expect(within(graph).getAllByRole('button').length).toBeGreaterThan(0);
    }
    fireEvent.change(screen.getByLabelText('Ranking subject'),{target:{value:'reach'}});
    fireEvent.change(screen.getByLabelText('Search ranked ULBs'),{target:{value:'Narsipatnam'}});
    const graph=screen.getByRole('region',{name:/ranking graph/i});
    expect(within(graph).getAllByRole('button',{name:/NARSIPATNAM:.*reported completion/i}).length).toBe(1);
  });
});
