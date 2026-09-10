import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { validateAggregate } from '../scripts/aggregate-contract.mjs';
import { summariseContinuity } from '../scripts/aggregate-continuity.mjs';

const read = (name:string)=>JSON.parse(readFileSync(`data/aggregates/${name}`, 'utf8'));
describe('aggregate reconciliation',()=>{
  for(const name of readdirSync('data/aggregates').filter(n=>n.endsWith('.json')&&!n.endsWith('.detail.json'))) {
    it(`reconciles ${name}`,()=>expect(validateAggregate(name,read(name))).toEqual([]));
  }
  it('rejects the previously undetected headline mutation',()=>{
    const d=read('secretariat-cohort.json');
    d.totals.collected=2139145;
    expect(validateAggregate('secretariat-cohort.json',d).join(' ')).toContain('totals.collected does not reconcile');
  });
  it('rejects drift in daily totals and quality accounting',()=>{
    const d=read('reporting-continuity.json');d.datasets[0].days[0].value++;
    d.datasets[0].quality.duplicateRows++;
    const errors=validateAggregate('reporting-continuity.json',d).join(' ');
    expect(errors).toContain('totalValue does not reconcile');expect(errors).toContain('rawRows does not reconcile');
  });
});
describe('continuity measurement semantics',()=>{
  it('separates zero, missing and positive; ratios use paired measurements',()=>{
    const rows=[{id:'a',date1:'2026-08-01',value:'0',bottom:'100'}, {id:'b',date1:'2026-08-01',value:'',bottom:'100'}, {id:'c',date1:'2026-08-01',value:'20',bottom:'100'}, {id:'d',date1:'2026-08-01',value:'10',bottom:''}];
    const result=summariseContinuity([...rows,rows[0]],{entity:'id',measure:'value',denominator:'bottom'});
    expect(result?.days[0]).toMatchObject({rows:4,reporting:3,positive:2,zero:1,missing:1,value:30,pairedValue:20,denominator:200});
    expect(result?.naiveRatio).toBe(0.1);expect(result?.quality.duplicateRows).toBe(1);
  });
});
