/**
 * Actual browser recording; presentation overlays never change application data.
 *
 *   PREVIEW_URL=<app base> node scripts/record-current-walkthrough.mjs --out <folder> [--rehearse]
 *
 * The folder is required, so a take or a rehearsal never writes over an earlier one by default.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const outIndex = process.argv.findIndex(arg => arg === '--out' || arg.startsWith('--out='));
const outArg = outIndex < 0 ? '' : process.argv[outIndex].startsWith('--out=') ? process.argv[outIndex].slice('--out='.length) : process.argv[outIndex + 1] ?? '';
if (!outArg || outArg.startsWith('--')) {
  console.error('Missing --out <folder>: name a new folder for this take, for example --out artifacts/walkthrough-2026-09-20');
  process.exit(2);
}
const out = resolve(outArg);
const dry = process.argv.includes('--rehearse');
const base = process.env.PREVIEW_URL || 'http://localhost:3002';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light', ...(dry ? {} : {recordVideo: { dir: out, size: {width:1920,height:1080} }}) });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const cues = [];
const chapters = [];
const start = Date.now();
const time = () => (Date.now()-start)/1000;
const hold = ms => page.waitForTimeout(dry ? 100 : ms);

async function overlay() {
  await page.evaluate(() => {
    if(document.getElementById('film-caption')) return;
    const style = document.createElement('style');
    style.textContent = `
      #film-caption{position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#092e32;color:#f1f5df;padding:22px 120px 24px;min-height:96px;box-sizing:border-box;display:flex;gap:34px;align-items:center;border-top:1px solid #a7d5bd55;font:500 25px/1.45 system-ui,sans-serif;pointer-events:none}
      #film-chapter{min-width:205px;color:#a5ceb8;text-transform:uppercase;font:600 13px/1.6 system-ui;letter-spacing:.17em;border-right:1px solid #a5ceb844;padding-right:30px}
      #film-words{max-width:1290px}
      #film-cursor{width:16px;height:16px;position:fixed;z-index:2147483646;pointer-events:none;background:#087c79;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 7px #84c9ad40;transition:left .45s,top .45s;opacity:0}
      vite-error-overlay,vinext-dev-tools{display:none!important}
    `;
    document.head.append(style);
    const caption = document.createElement('div'); caption.id='film-caption';
    caption.innerHTML='<span id="film-chapter"></span><span id="film-words"></span>';
    const cursor=document.createElement('div');cursor.id='film-cursor';
    document.body.append(caption,cursor);
  });
}
async function goto(path) {
  await page.goto(base+path,{waitUntil:'networkidle'});
  await page.locator('.app-shell:not(.booting)').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await overlay();
}
async function focus(selector) {
  await page.locator(selector).first().waitFor();
  await page.locator(selector).first().evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-125,behavior:'smooth'}));
  await page.waitForTimeout(850);
}
async function cue(chapter,text,seconds=7) {
  await overlay();
  await page.evaluate(({chapter,text})=>{document.querySelector('#film-caption').style.visibility='visible';document.querySelector('#film-chapter').textContent=chapter;document.querySelector('#film-words').textContent=text;}, {chapter,text});
  await page.evaluate(()=>document.querySelector('#film-cursor').style.opacity='0');
  const t=time();
  if(chapters.at(-1)?.title!==chapter) chapters.push({start:t,title:chapter});
  await page.screenshot({path:resolve(out,`${String(cues.length+1).padStart(2,'0')}.png`)});
  console.log(`${dry?'Rehearsal':'Recording'} ${cues.length+1}: ${chapter}`);
  await hold(seconds*1000);
  cues.push({start:t,end:time(),text,chapter,url:page.url()});
  await page.evaluate(()=>document.querySelector('#film-caption').style.visibility='hidden');
}
async function point(locator) {
  await locator.scrollIntoViewIfNeeded();
  const b=await locator.boundingBox();
  await page.evaluate(({x,y})=>{const c=document.querySelector('#film-cursor');c.style.left=x+'px';c.style.top=y+'px';c.style.opacity='1';},{x:b.x+b.width/2,y:b.y+b.height/2});
  await hold(550);
}
async function click(locator) {await point(locator);await locator.click();await page.waitForTimeout(450);}
async function select(name,label) {const loc=page.getByRole('combobox',{name,exact:true});await point(loc);await loc.selectOption({label});await page.waitForTimeout(450);}
async function card(ending=false) {
  await page.evaluate(ending=>{
    document.querySelector('#film-card')?.remove();
    const el=document.createElement('section');el.id='film-card';
    el.style.cssText='position:fixed;inset:0;z-index:2147483645;background:radial-gradient(ellipse at 85% 40%,#24594f 0%,#123b3c 40%,#071f27 100%);color:#f3f5df;padding:105px 125px;box-sizing:border-box;font-family:system-ui;overflow:hidden';
    el.innerHTML=`<div style="position:absolute;right:-80px;top:50px;width:900px;height:900px;opacity:.48"><svg viewBox="0 0 900 900" width="900"><g fill="none" stroke="#9ecdb6" stroke-width="1"><circle cx="450" cy="450" r="350"/><circle cx="450" cy="450" r="270"/><circle cx="450" cy="450" r="190"/><circle cx="450" cy="450" r="95"/><path d="M0 450H900M450 0V900" opacity=".3"/></g><path d="M160 620L310 410L420 520L570 230L710 310" fill="none" stroke="#c9e7a0" stroke-width="4"/>${[[160,620],[310,410],[420,520],[570,230],[710,310]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="9" fill="#d1e9ad"/>`).join('')}</svg></div>
      <div style="position:relative;max-width:1140px"><div style="font-size:18px;letter-spacing:.22em;color:#a9d3b9">SASA / INTELLIGENCE LAB</div>
      <div style="font-size:14px;letter-spacing:.16em;margin-top:65px;color:#a9d3b9">${ending?'FROM FINDING TO EVIDENCE':'A GUIDED APPLICATION WALKTHROUGH'}</div>
      <h1 style="font-size:91px;font-weight:450;line-height:1.09;letter-spacing:-.055em;margin:25px 0 30px;max-width:1070px">${ending?'See the signal.<br>Understand the basis.<br><i style="font-family:Georgia;color:#b8dca7;font-weight:400">Inspect the evidence.</i>':'Understand sanitation.<br>See where to look.<br><i style="font-family:Georgia;color:#b8dca7;font-weight:400">Know the evidence.</i>'}</h1>
      <p style="font-size:26px;line-height:1.6;max-width:860px;color:#c5d6ce">${ending?'Subject comparisons, reported trends and traceable records.<br>Formal overall ratings remain gated by evidence.':'An operational review workspace for Andhra Pradesh.<br>Explore delivery, compare places and trace findings to retained source records.'}</p>
      <div style="display:flex;gap:45px;border-top:1px solid #98c6b444;margin-top:42px;padding-top:28px;font-size:18px;color:#b9d5c6"><span>01 / Explore</span><span>02 / Compare</span><span>03 / Verify</span></div>
      <p style="font-size:14px;letter-spacing:.08em;color:#8caea4;margin-top:36px">RETAINED GOVERNED DATA · APPLICATION RECORDED 14 SEPTEMBER 2026</p></div>`;
    document.body.append(el);
  },ending);
}

try {
  await goto('/?mode=governed');
  await card();
  await cue('Welcome','SASA Intelligence Lab brings sanitation delivery, place comparisons and source evidence into one review workspace.',10);
  await page.screenshot({path:resolve(out,'intro.png')});
  await page.evaluate(()=>document.querySelector('#film-card').remove());
  await cue('01 / Overview','Start with a subject. Each view states what is measured, which places are included and the reporting period.',8);
  await focus('#overview-selected-evidence');
  await cue('01 / Rural change','May–August comparisons follow the same panchayat-day cohort. Statewide movement can hide different district trajectories.',9);
  await click(page.getByRole('button',{name:/Vehicle delivery.*ULB/}));
  await focus('#overview-selected-evidence');
  await cue('01 / Delivery maps','Vehicle delivery connects a reported shortfall to its district map and the ULBs contributing to that gap.',8);
  await select('Review district','Anakapalli');
  await cue('01 / Focus a place','Choose a district to narrow the map, headline and ULB review list to the same eligible records.',7);
  await click(page.getByRole('button',{name:/Household toilets.*ULB/}));
  await focus('#overview-selected-evidence');
  await cue('01 / Household toilets','Household toilets use their own approvals and completions. Different subjects retain their own units and denominators.',8);
  await click(page.getByRole('button',{name:/Works delivery & plans.*District/}));
  await focus('#overview-selected-evidence');
  await cue('01 / Works and plans','Inspect reported achievement alongside monthly targets. Forward plans stay separate from completed work.',8);
  await goto('/operational-analytics?mode=governed&tab=collection');
  await cue('02 / Operational analytics','Follow the delivery chain from target through work orders to vehicles supplied, then inspect the largest gaps.',8);
  await goto('/operational-analytics?mode=governed&tab=delivery');
  await focus('.evidence-workspace .ew-reading');
  await cue('02 / Monthly works timeline','Compare the twelve-month sequence. Achievement bars show reported work; later targets describe plans, not completed delivery.',9);
  await goto('/operational-analytics?mode=governed&tab=rural');
  await cue('02 / Rural infrastructure','Explore processing-centre presence and working condition at gram-panchayat level. A centre’s presence alone does not prove its effect.',9);
  await goto('/operational-analytics?mode=governed&tab=continuity');
  await cue('02 / Reporting patterns','Daily reporting distinguishes positive activity, reported zero and missing measurements before interpreting performance.',8);
  await goto('/gap-radar?mode=governed');
  await focus('.usr-stage');
  await cue('03 / Gap Radar','Each dot compares a ULB’s collection reach and segregation on 12 August 2026. The dashed lines are draft review guides.',10);
  await select('Find service ULB','NARSIPATNAM');
  await select('Compare service peer','KAVALI');
  await focus('.usr-stage');
  await cue('03 / Compare ULBs','Highlight a ULB and a peer to see their measured positions. Named examples help you find places worth closer review.',8);
  await focus('.usr-detail');
  await cue('03 / Read the basis','Read the exact rates, household counts and peer differences. This comparison covers two service measures on one day.',8);
  await goto('/gap-radar?mode=governed&view=rankings');
  await focus('.rk-controls');
  await cue('03 / Subject rankings','Switch subjects to compare eligible ULBs on a stated formula and period. Equal measured rates share a rank.',8);
  await select('Ranking subject','Household toilet delivery');
  await focus('.rk-field-stage');
  await cue('03 / A different subject','The field now shows toilet delivery: workload horizontally and completion rate vertically. The guides are cohort medians.',9);
  await select('Ranking subject','Legacy waste clearance');
  await focus('.rk-field-stage');
  await cue('03 / Legacy waste','Legacy waste has its own clearance measure. Subject positions never become an unexplained overall ULB score.',8);
  await goto('/gap-radar?mode=governed&view=register');
  await focus('.infrastructure-series .ew-reading');
  await cue('03 / Infrastructure and activity','Compare rural collection activity with the processing-centre register across retained months. Association does not establish a programme effect.',10);
  await goto('/diagnostics/sample-narsipatnam?mode=governed');
  await cue('04 / ULB diagnostics','Open a ULB case view to inspect returned measures, coverage and gaps, with reporting periods kept visible.',8);
  await select('Evidence record','MSW Processing · ISWM Facilities · July 2026');
  await click(page.getByText('Evidence details and raw fields',{exact:true}));
  await page.getByText('total_tpd',{exact:true}).waitFor();
  await focus('details[open]:has-text("Evidence details and raw fields")');
  await cue('04 / Inspect a record','Expand the evidence to inspect source fields and reported capacity. Configured capacity is not actual utilization.',8);
  await goto('/reconciliation?mode=governed&view=revisions');
  await cue('05 / Source reconciliation','Inspect revised sources and differences before combining evidence. Historical vintages remain visible alongside current routes.',8);
  await goto('/data-readiness?mode=governed');
  await focus('.sf-readiness-exceptions');
  await cue('05 / Data readiness','All 42 routes in the audited catalogue have retained evidence. Retention does not prove complete geographic coverage or scoring eligibility.',10);
  await click(page.getByRole('tab',{name:'Coverage',exact:true}));
  await cue('05 / Coverage and limits','Coverage makes missing evidence visible. Cross-source identity and period checks still matter before assigning formal overall ratings.',9);
  await goto('/?mode=governed');
  await card(true);
  await cue('Your review workflow','Choose a subject, compare places, inspect the record. Use the evidence to decide what deserves a closer look.',10);
  if(errors.length) throw new Error(`Browser errors: ${errors.join('\n')}`);
  await writeFile(resolve(out,dry?'rehearsal.json':'timeline.json'),JSON.stringify({base,cues,chapters,errors},null,2));
  const ts=s=>{const m=Math.round(s*1000);return `${String(Math.floor(m/3600000)).padStart(2,'0')}:${String(Math.floor(m/60000)%60).padStart(2,'0')}:${String(Math.floor(m/1000)%60).padStart(2,'0')},${String(m%1000).padStart(3,'0')}`;};
  if(!dry) {
    const trim=cues[0].start;
    for(const c of cues){c.start=Math.max(0,c.start-trim);c.end-=trim;}
    for(const c of chapters)c.start=Math.max(0,c.start-trim);
    await writeFile(resolve(out,'timeline.json'),JSON.stringify({base,cues,chapters,errors},null,2));
    await writeFile(resolve(out,'chapters.txt'),chapters.map(c=>`${ts(c.start).slice(0,8)}  ${c.title}`).join('\n'));
    await writeFile(resolve(out,'sasa-walkthrough.srt'),cues.map((c,i)=>`${i+1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n'));
    const video=page.video(); await context.close(); await video.saveAs(resolve(out,'recording.webm'));
    execFileSync('ffmpeg',['-y','-ss',String(trim),'-i',resolve(out,'recording.webm'),'-i',resolve(out,'sasa-walkthrough.srt'),'-map','0:v','-map','1:0','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:s','mov_text','-disposition:s:0','0','-metadata:s:s:0','language=eng','-movflags','+faststart',resolve(out,'sasa-walkthrough.mp4')],{stdio:'ignore'});
  }
  console.log(JSON.stringify({out,scenes:cues.length,seconds:time(),errors}));
} finally {await browser.close();}
