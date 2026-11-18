import {getUlbAtlas, measureHeadline} from '@/lib/ulb-atlas';
import {serviceSnapshot} from '@/lib/ulb-service';

export function PopulationNote() {
  const atlas = getUlbAtlas();
  const all = serviceSnapshot.ulbs.reduce((sum, ulb) => ({households: sum.households + ulb.households, collected: sum.collected + ulb.collected, segregated: sum.segregated + ulb.segregated}), {households: 0, collected: 0, segregated: 0});
  const reach = measureHeadline(atlas, 'reach');
  const measure = atlas.measures.find((entry) => entry.id === 'reach')!;
  return <details className="population-note"><summary>Why do collection and segregation figures differ across views?</summary>
    <dl><div><dt>Atlas · {measure.reporting} ULBs with usable collection evidence</dt><dd>{reach.figure.toFixed(1)}% collected from</dd></div><div><dt>Environment · all {serviceSnapshot.ulbs.length} ULBs in the retained register</dt><dd>{(all.collected / all.households * 100).toFixed(1)}% collected from</dd></div></dl>
    <p>Both describe {measure.period}. The Atlas holds out {measure.held} ULBs for evidence checks. Environment preserves the full source register. A change in the population changes the result; it is not a change over time.</p>
    <p>Segregation also uses different denominators: Goals divides by all households in its placed ULBs; the Atlas divides by households collected from in each eligible ULB. Environment reports {(all.segregated / all.collected * 100).toFixed(1)}% of collected households across the full register. Read the population and denominator beside each figure before comparing.</p>
  </details>;
}
