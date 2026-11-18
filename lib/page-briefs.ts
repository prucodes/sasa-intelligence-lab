import {getNamedFindings} from './findings';
import {serviceCategory, serviceExclusions, serviceSnapshot} from './ulb-service';
import {createProvider} from './domain';
import {getIhhlReconciliation} from './source-reconciliation';
import {getRevisionInventory} from './source-revisions';
import {formatAtlasDay, getUlbAtlas, measureHeadline} from './ulb-atlas';

/**
 * The three-part brief at the top of each screen: what it is, what it says now, and what to do
 * with it. "What it says now" is assembled from the same functions the screen draws from, so the
 * brief cannot drift from the figures beneath it. Spans wrapped in ** are emphasised figures.
 */
export type BriefPage = 'overview' | 'operational-analytics' | 'environment' | 'gap-radar' | 'atlas' | 'reconciliation' | 'diagnostics' | 'data-readiness';
export interface PageBrief { is: string; says: string; act: string }

const plural = (n: number, noun: string, many = `${noun}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? noun : many}`;

export function revisedRouteCount(): {revised: number; routes: number} {
  const inventory = getRevisionInventory();
  return {revised: inventory.filter((route) => route.changed).length, routes: inventory.length};
}

export function getPageBrief(page: BriefPage): PageBrief | null {
  switch (page) {
    case 'overview': {
      const findings = getNamedFindings();
      const lead = findings.slice(0, 2).map((finding) => finding.statement.replace(/(\d[\d,]* of \d[\d,]*)/, '**$1**')).join(' ');
      return {
        is: 'Andhra Pradesh sanitation on one screen: pick a subject for its headline, where it sits on the map and the places behind it.',
        says: `${lead} Both are ${findings[0]?.period ?? 'latest-period'} reports.`,
        act: 'Open a subject to see where its shortfall sits. To follow one ULB across every programme, open the ULB Atlas.',
      };
    }
    case 'operational-analytics': {
      const findings = getNamedFindings();
      return {
        is: 'Each programme’s retained evidence, one tab at a time: procurement, toilets, processing, works, rural sanitation, reporting continuity and the 2024 survey.',
        says: `${findings.map((finding) => finding.headline.replace(/^([\d,]+)/, '**$1**')).join('; ')}, as reported for ${findings[0]?.period ?? 'the latest period'}.`,
        act: 'Choose a tab. Every figure states its population and period, and a missing value is held out rather than counted as zero.',
      };
    }
    case 'gap-radar': {
      const eligible = serviceSnapshot.ulbs.filter((ulb) => !serviceExclusions(ulb).length);
      const both = eligible.filter((ulb) => serviceCategory(ulb, 80, 80) === 'both').length;
      const review = eligible.filter((ulb) => serviceCategory(ulb, 80, 80) === 'review').length;
      return {
        is: 'Comparisons inside one subject at a time: the ULB service day, subject rankings, delivery against approvals and rural district trends.',
        says: `On ${formatAtlasDay(serviceSnapshot.day)}, **${both} of ${eligible.length}** placed ULBs met both 80% draft guides for collection and segregation, and **${review}** were below both.`,
        act: 'Pick a subject, then a ULB and a peer. The draft guides are review lines, not targets, and nothing here is an overall rating.',
      };
    }
    case 'reconciliation': {
      const pair = getIhhlReconciliation();
      const {revised, routes} = revisedRouteCount();
      return {
        is: `Where two retained sources describe the same thing, and whether they agree. Here, the ${pair.left.spec.department} and ${pair.right.spec.department} returns for household toilets.`,
        says: `The two pair for **${pair.matched} district-months** across ${pair.districts} districts, and **${pair.targetsCoincide} of ${pair.matched}** carry the same target, so their figures cannot yet be combined. **${revised} of ${routes}** retained routes have been revised since retention.`,
        act: 'Open a district and month to see both returns side by side. A disagreement is a question for the department, not a figure to choose between.',
      };
    }
    case 'data-readiness': {
      const gates = createProvider('SAMPLE').getReadiness().gates;
      const met = gates.filter((gate) => gate.state === 'met').length;
      const blocked = gates.filter((gate) => gate.state === 'blocked');
      const future = gates.filter((gate) => gate.state === 'future').length;
      return {
        is: 'What the retained evidence can and cannot support yet: source access, reconciliation, identity, period alignment and the checks behind any future score.',
        says: `**${met} of ${gates.length}** readiness gates are met. ${blocked.length ? `${blocked.map((gate) => gate.title).join(' and ')} ${blocked.length === 1 ? 'is the one blocked gate' : 'are blocked'}` : 'None is blocked'}${future ? `, and ${plural(future, 'gate')} depend${future === 1 ? 's' : ''} on evidence that does not exist yet` : ''}.`,
        act: 'Read each blocked gate’s action to see what the department would need to publish. Nothing is scored until the gates it depends on are met.',
      };
    }
    case 'diagnostics':
      return {
        is: 'One ULB, source by source: what each programme reports for it, with the record behind every figure.',
        says: 'Evidence here is matched to the ULB by source name, so it is a candidate file, not a certified identity. Programmes that supply the urban body code are certified in the ULB Atlas.',
        act: 'Choose a ULB, then open any figure to see the source record and period it comes from.',
      };
    case 'atlas': {
      const model = getUlbAtlas();
      const reach = measureHeadline(model, 'reach');
      const toilets = measureHeadline(model, 'toilets');
      const toiletPeriod = model.measures.find((measure) => measure.id === 'toilets')!.period;
      return {
        is: `Every urban local body in the register, lined up across ${model.stats.measures} measures from ${model.stats.sources} sources. Each source is joined on the urban body code it supplies itself, never on a name.`,
        says: `**${reach.figure.toFixed(1)}%** of households in reporting ULBs were collected from on ${model.measures[0].period}. Of the ULBs placed by their code with toilets approved, **${toilets.tiles[0].value}** report none completed in ${toiletPeriod}.`,
        act: 'Pick a measure, then a ULB. Its dossier shows where it sits among the ULBs reporting each measure, and which measure to look at first. Export the table for a review meeting.',
      };
    }
    default:
      return null;
  }
}
