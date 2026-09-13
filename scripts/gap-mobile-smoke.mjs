import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const base=process.env.PREVIEW_URL||'http://localhost:3002';
const views=[
 ['ULB service snapshot','.usr-scroll svg'],
 ['Subject rankings & profiles','.rk-field-scroll svg'],
 ['ULB delivery comparison','.ur-chart svg'],
 ['May–August trends','.movement-series-story svg'],
 ['Infrastructure & activity','.ew-chart-panel svg'],
 ['Reported programme gaps','.works-series-plot'],
];
await mkdir('artifacts/gap-mobile',{recursive:true});
try{
 for(const width of [320,393,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(`${base}/gap-radar?mode=governed`);
  for(const [name,selector] of views){
   await page.getByRole('button',{name,exact:true}).click();
   const chart=page.locator(selector);
   await expect(chart).toBeVisible();
   if(width<=768){
    if(selector.endsWith('svg')&&(width<=393||name!=='ULB service snapshot'))await expect(chart).toHaveAttribute('viewBox',/^0 0 400 /);
    const bounds=await chart.evaluate(el=>({width:el.getBoundingClientRect().width,parent:el.parentElement.clientWidth,scroll:el.scrollWidth,page:document.documentElement.scrollWidth}));
    expect(bounds.width,`${name} fits its container at ${width}`).toBeLessThanOrEqual(bounds.parent+1);
    expect(bounds.page,`${name} page width`).toBeLessThanOrEqual(width);
   }
   await chart.scrollIntoViewIfNeeded();
   // Allow the existing panel entrance transition to finish before visual capture.
   await page.waitForTimeout(500);
   await chart.screenshot({path:`artifacts/gap-mobile/${width}-${views.findIndex(v=>v[0]===name)}.png`});
   if(name==='Subject rankings & profiles'){
    for(const subject of ['reach','segregation','toilets','vehicles','legacy']){
     await page.getByRole('combobox',{name:'Ranking subject',exact:true}).selectOption(subject);
     await expect(chart).toBeVisible();
     expect(await chart.locator('g[role="button"]').count()).toBeGreaterThan(0);
    }
   }
   if(name==='ULB delivery comparison'){
    for(const subject of ['sanitation','collection','processing']){
     await page.getByRole('combobox',{name:'ULB comparison programme',exact:true}).selectOption(subject);
     await chart.locator('g[role="button"]').first().click();
     await expect(page.locator('.ur-rate')).toBeVisible();
    }
   }
   if(name==='Infrastructure & activity'){
    for(const basis of ['full','sensitivity','comparable']){
     await page.getByRole('combobox',{name:'Infrastructure evidence basis'}).selectOption(basis);
     expect(await chart.locator('polyline').count()).toBe(basis==='comparable'?2:0);
    }
   }
   if(name==='Reported programme gaps'){
    await expect(page.locator('.works-period')).toHaveCount(12);
    const planned=page.locator('.works-period.plan-only').last();
    await planned.click();
    await expect(planned).toHaveAttribute('aria-pressed','true');
    await expect(planned.locator('.works-achievement')).toHaveCount(0);
    if(width<=393)expect(await chart.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
   }
  }
 }
 expect(errors).toEqual([]);
 console.log('Gap Radar: six views at 320, 393, 768 and 1440px; five ranking subjects, three delivery subjects, infrastructure bases and plan-only month selection passed.');
}finally{await browser.close();}
