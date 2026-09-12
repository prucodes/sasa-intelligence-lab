/**
 * A percentage rounded for display that never reads as a boundary it has not reached.
 * 99.996% rounds to "100", which puts a ULB that has not finished in the same words as one
 * that has; 0.003% rounds to "0", which reads as no progress at all. Below 100 is shown at
 * the largest value under 100 at this precision, and above 0 is shown as "<0.1".
 */
export function rateText(value:number,digits=1){
  const factor=10**digits,shown=Math.round(value*factor)/factor;
  if(value<100&&shown>=100)return (Math.floor(value*factor)/factor).toLocaleString('en-IN',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  if(value>0&&shown<=0)return `<${(1/factor).toLocaleString('en-IN',{maximumFractionDigits:digits})}`;
  return value.toLocaleString('en-IN',{maximumFractionDigits:digits});
}
