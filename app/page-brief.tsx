'use client';

import {useMemo} from 'react';
import {getPageBrief, type BriefPage} from '@/lib/page-briefs';
import './page-brief.css';

/** Renders "**figure**" spans as emphasis; everything else is plain text. */
function Emphasis({text}: {text: string}) {
  return <>{text.split('**').map((part, index) => (index % 2 ? <b key={index}>{part}</b> : <span key={index}>{part}</span>))}</>;
}

export function PageBrief({page}: {page: BriefPage}) {
  const brief = useMemo(() => getPageBrief(page), [page]);
  if (!brief) return null;
  return (
    <div className="page-brief" role="group" aria-label="About this screen">
      <div><span className="page-brief-label">What this is</span><p><Emphasis text={brief.is} /></p></div>
      <div><span className="page-brief-label">What it says now</span><p><Emphasis text={brief.says} /></p></div>
      <div><span className="page-brief-label">What to do with it</span><p><Emphasis text={brief.act} /></p></div>
    </div>
  );
}
