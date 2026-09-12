import './chart-guide.css';

export type ChartGuideItem={term:string;text:string};

const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
/** "on 12 August 2026" for a day, "in July 2026" for a month or a named period. Parsed by hand so no timezone can shift the day. */
export function periodPhrase(period:string){
  const day=/^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  if(day)return `on ${Number(day[3])} ${months[Number(day[2])-1]} ${day[1]}`;
  const month=/^(\d{4})-(\d{2})$/.exec(period);
  return month?`in ${months[Number(month[2])-1]} ${month[1]}`:`in ${period}`;
}

/** A visible reading key placed directly above a chart, worded for the subject on screen. */
export function ChartGuide({intro,items}:{intro:string;items:ChartGuideItem[]}){
  return <div className="chart-guide" role="note" aria-label="How to read this chart"><strong>How to read this chart</strong><p>{intro}</p><dl>{items.map(item=><div key={item.term}><dt>{item.term}</dt><dd>{item.text}</dd></div>)}</dl></div>;
}
