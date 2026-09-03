import { chromium } from '@playwright/test';
const out='/private/tmp/claude-501/-Users-pruthviyannam-Documents-Groundwater-Project-Phase2A/5e7da5af-18ee-42a5-ba03-771c22cc6dc0/scratchpad/shots';
const routes=[['09-overview-demo','/?mode=demo'],['01-overview-sample','/?mode=sample'],['10-gap-radar-demo','/gap-radar?mode=demo'],['11-overview-dark','/?mode=sample&theme=dark'],['08-data-readiness','/data-readiness?mode=sample']];
const only=process.env.ONLY?process.env.ONLY.split(','):null;
const b=await chromium.launch({headless:true});
const c=await b.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const p=await c.newPage();
for(const [n,r] of (only?routes.filter(([x])=>only.some(o=>x.includes(o))):routes)){
  await p.goto('http://localhost:3001'+r,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0),undefined,{timeout:8000}).catch(()=>{});
  await p.waitForTimeout(400);
  await p.screenshot({path:`${out}/${n}.png`,fullPage:true});
  console.log('captured',n);
}
await b.close();
