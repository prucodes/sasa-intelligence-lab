import {describe,it,expect} from 'vitest';
import {rateText} from '@/lib/format-rate';

describe('rate display',()=>{
  it('never shows an unfinished rate as 100 or a non-zero rate as 0',()=>{
    expect(rateText(99.99602148398648,2)).toBe('99.99');
    expect(rateText(99.98435054773083,1)).toBe('99.9');
    expect(rateText(100,2)).toBe('100');
    expect(rateText(0.003,2)).toBe('<0.01');
    expect(rateText(0.04,1)).toBe('<0.1');
    expect(rateText(0,1)).toBe('0');
  });
  it('rounds ordinary rates as before',()=>{
    expect(rateText(69.5229948676663,1)).toBe('69.5');
    expect(rateText(72.1333,2)).toBe('72.13');
    expect(rateText(12.5,1)).toBe('12.5');
  });
});
