import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagnosticReadings } from '@/app/diagnostic-readings';
import { VehiclePairing } from '@/app/vehicle-pairing';
import { ExecutiveBrief } from '@/app/executive-brief';
import { createProvider, type EvidenceRecord } from '@/lib/domain';
import { getDiagnosticReadings } from '@/lib/diagnostic-readings';
import { getVehiclePairing, pairVehicleRecords } from '@/lib/vehicle-pairing';
import { executiveBriefText, getExecutiveBrief } from '@/lib/executive-brief';
import { governedSnapshotStats, governedSnapshotByKey, snapshotPeriod } from '@/lib/snapshots';

const vehicle = {district_name:'Example district',ulb_name:'Example ULB',actual_work_order_issued:'10',achievement:'0',month_number:'7',year:'2026'};
const key = 'sasa_sac_identification_of_new_ihhls_api';
const record:EvidenceRecord = {id:'test-ihhl',dataset:'IHHL source',tableKey:key,period:snapshotPeriod(governedSnapshotByKey.get(key)!),rawFields:{no_of_benf_identified:'10',ihhls_approved_by_mohua:'0',under_construction:'0',completed:'0'},grain:'ULB',joinMethod:'source',matchStatus:'EXACT',freshness:'retained',provenance:'test',normalizedCandidate:'example',formula:'completed / approved'};

describe('same-source procurement comparison',()=>{
  it('reconciles the current pairing and overlapping points without hiding zeroes',()=>{
    const data=getVehiclePairing();
    expect(data.period).toBe('July 2026');
    expect(data.points).toHaveLength(83);
    expect(data.orderedNone).toBe(75);
    expect(data.coordinates).toHaveLength(28);
    expect(data.coordinates).toHaveLength(new Set(data.points.map(point=>`${point.orders}|${point.supplied}`)).size);
    expect(data.coordinates.reduce((sum,group)=>sum+group.points.length,0)).toBe(83);
    expect(data.orderedNone+data.zeroBoth+data.supplyReported).toBe(data.points.length);
    expect(data.observedFrame).toBe(governedSnapshotStats.baselineUlbCandidates);
  });
  it('retains zero, deduplicates identical readings, excludes blank, invalid and disputed pairs',()=>{
    expect(pairVehicleRecords([vehicle,vehicle]).points).toHaveLength(1);
    expect(pairVehicleRecords([vehicle,{...vehicle,achievement:'1'}]).disputed).toBe(1);
    for(const achievement of ['','-1','abc','Infinity']) expect(pairVehicleRecords([{...vehicle,achievement}]).points).toHaveLength(0);
    expect(pairVehicleRecords([{...vehicle,ulb_name:' '}]).missingIdentity).toBe(1);
    expect(()=>pairVehicleRecords([vehicle,{...vehicle,month_number:'6'}])).toThrow('one reporting period');
  });
  it('offers keyboard point selection and district-grouped browsing',()=>{
    render(<VehiclePairing/>);
    const group=screen.getByRole('button',{name:'0 ordered, 0 supplied: 5 ULB-name candidates'});
    fireEvent.keyDown(group,{key:'Enter'});
    expect(group).toHaveAttribute('aria-pressed','true');
    expect(screen.getByLabelText('Selected procurement evidence')).toHaveTextContent('Both counts are reported as zero');
    expect(screen.getByRole('combobox',{name:'Browse a procurement ULB'}).querySelectorAll('optgroup').length).toBeGreaterThan(1);
  });
});

describe('source-owned diagnostic readings',()=>{
  it('explains zero approvals without creating a completion rate',()=>{
    const reading=getDiagnosticReadings([record])[0];
    expect(reading.value).toBe(0);expect(reading.denominator).toBe(0);expect(reading.ratio).toBeNull();
    expect(reading.note).toContain('denominator is reported as zero');
    render(<DiagnosticReadings records={[record]} onInspect={vi.fn()}/>);
    const card=screen.getByRole('button',{name:'Inspect Household toilets source'});
    expect(card).toHaveTextContent('of 0 approved');expect(card).toHaveTextContent('Rate unavailable');expect(card).not.toHaveTextContent('0%');
  });
  it('keeps blank, invalid, older and disputed readings out of current rates',()=>{
    const change=(rawFields:Record<string,string>)=>({...record,rawFields:{...record.rawFields,...rawFields}});
    expect(getDiagnosticReadings([change({completed:''})])[0].value).toBeNull();
    expect(getDiagnosticReadings([change({completed:'-1'})])[0].state).toBe('invalid');
    expect(getDiagnosticReadings([{...record,period:'June 2026'}])[0].state).toBe('missing');
    const dispute=getDiagnosticReadings([record,change({completed:'3'})])[0];
    expect(dispute.state).toBe('disputed');expect(dispute.ratio).toBeNull();expect(dispute.fields.every(field=>field.value===null)).toBe(true);
    expect(getDiagnosticReadings([change({completed:'2',ihhls_approved_by_mohua:'10'})])[0].ratio).toBe(.2);
  });
  it('links facility and outcome cards to their own sources',()=>{
    const diagnostic=createProvider('SAMPLE').getDiagnostic('sample-narsipatnam');
    const onInspect=vi.fn();
    render(<DiagnosticReadings records={diagnostic.evidence} onInspect={onInspect}/>);
    for(const reading of getDiagnosticReadings(diagnostic.evidence).filter(reading=>reading.evidenceIds.length)){
      fireEvent.click(screen.getByRole('button',{name:`Inspect ${reading.title} source`}));
      expect(onInspect).toHaveBeenLastCalledWith(reading.evidenceIds[0]);
      const evidence=diagnostic.evidence.find(row=>row.id===reading.evidenceIds[0]);
      expect(evidence?.period).toBe(reading.period);
    }
    expect(screen.getByText('Historical outcome context')).toBeInTheDocument();
  });
});

describe('executive evidence brief',()=>{
  it('uses the checked overview cohorts, latest periods and explicit scope',()=>{
    const brief=getExecutiveBrief('SAMPLE');
    expect(brief.issues.map(issue=>issue.total)).toEqual([1019,8479,1353366]);
    expect(brief.scope).toContain('Screen filters, selected ULBs and local crosswalk decisions are not applied');
    expect(brief.sources).toHaveLength(6);
    const text=executiveBriefText(brief,'2026-09-07T00:00:00Z');
    expect(text).toContain('not a source update time');expect(text).toContain('UNSCORED');
    for(const source of brief.sources){expect(text).toContain(source.responseId);expect(text).toContain(source.generatedAt);expect(text).toContain(source.period);}
    expect(text).toContain('119 eligible candidates / 123');
    expect(text).toContain('1 rows or candidate groups excluded');
  });
  it.each(['DEMO','LIVE'] as const)('keeps governed figures out of %s exports',mode=>{
    const brief=getExecutiveBrief(mode);expect(brief.issues).toEqual([]);expect(brief.sources).toEqual([]);expect(brief.footprint).toBeNull();
    expect(executiveBriefText(brief,'today')).not.toContain('1,019');
  });
  it('previews, prints and closes; failed downloads report an actionable message',()=>{
    const onClose=vi.fn();const print=vi.spyOn(window,'print').mockImplementation(()=>{});
    vi.stubGlobal('URL',class extends URL {static createObjectURL(){throw new Error('blocked');}});
    render(<ExecutiveBrief mode="SAMPLE" onClose={onClose}/>);
    const dialog=screen.getByRole('dialog',{name:'Executive evidence brief'});
    fireEvent.click(within(dialog).getByRole('button',{name:'Print / Save PDF'}));expect(print).toHaveBeenCalledOnce();
    fireEvent.click(within(dialog).getByRole('button',{name:'Download text'}));expect(screen.getByRole('alert')).toHaveTextContent('could not start');
    fireEvent.keyDown(document,{key:'Escape'});expect(onClose).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
