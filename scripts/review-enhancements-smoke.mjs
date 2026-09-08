import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base=process.env.PREVIEW_URL || 'http://127.0.0.1:4192';
const output=resolve('artifacts/screenshots/review-enhancements');
const pdfOutput=resolve('tmp/pdfs');
await mkdir(output,{recursive:true});await mkdir(pdfOutput,{recursive:true});
const browser=await chromium.launch();
const failures=[];
try {
  for(const width of [320,390,768,1024,1440]) {
    const page=await browser.newPage({viewport:{width,height:1000}});
    page.on('pageerror',error=>failures.push(error.message));
    await page.goto(`${base}/gap-radar/?mode=governed`,{waitUntil:'networkidle'});
    const pairing=page.getByRole('region',{name:'Orders issued. Vehicles supplied?'});
    await pairing.scrollIntoViewIfNeeded();
    await pairing.screenshot({path:resolve(output,`pairing-${width}.png`)});
    await pairing.getByRole('button',{name:'0 ordered, 0 supplied: 5 ULB-name candidates'}).click();
    await pairing.getByText('Both counts are reported as zero.',{exact:false}).waitFor();
    const picker=pairing.getByRole('combobox',{name:'Browse a procurement ULB'});
    const first=await picker.locator('option').first().getAttribute('value');await picker.selectOption(first);
    if(width===1440){await page.getByRole('button',{name:'Switch to dark theme'}).click();await pairing.screenshot({path:resolve(output,'pairing-dark.png')});}
    await page.goto(`${base}/diagnostics/sample-narsipatnam/?mode=governed`,{waitUntil:'networkidle'});
    const readings=page.getByRole('region',{name:'What this ULB reported'});
    await readings.screenshot({path:resolve(output,`readings-${width}.png`)});
    for(const name of ['Household toilets','Processing facility','National rank']){
      const card=readings.getByRole('button',{name:`Inspect ${name} source`});
      if(!await card.isEnabled())continue;
      const before=await card.locator('strong').evaluate(el=>getComputedStyle(el).color);
      await card.hover();
      if(before!==await card.locator('strong').evaluate(el=>getComputedStyle(el).color))failures.push(`Hover changed ${name} colour at ${width}`);
      await card.click();
      if(await card.getAttribute('aria-pressed')!=='true')failures.push(`Source selection failed for ${name}`);
    }
    if(width===1440){await page.getByRole('button',{name:'Switch to dark theme'}).click();await readings.screenshot({path:resolve(output,'readings-dark.png')});}
    await page.getByRole('button',{name:'Open executive evidence brief'}).click();
    const brief=page.getByRole('dialog',{name:'Executive evidence brief'});
    await brief.getByText('Scope of this brief',{exact:true}).waitFor();
    await page.screenshot({path:resolve(output,`brief-${width}.png`)});
    const print=brief.getByRole('button',{name:'Print / Save PDF'});
    await print.focus();await page.keyboard.press('Shift+Tab');
    if(!await brief.getByRole('button',{name:'Close executive brief'}).evaluate(el=>el===document.activeElement))failures.push('Brief focus trap failed');
    if(width===1440){
      const downloadEvent=page.waitForEvent('download');await brief.getByRole('button',{name:'Download text'}).click();
      const download=await downloadEvent;const text=await readFile(await download.path(),'utf8');
      for(const required of ['Screen filters','UNSCORED','1,019','8,479','13,53,366','response generated'])if(!text.includes(required))failures.push(`Brief download missing ${required}`);
      await page.emulateMedia({media:'print'});
      if(await page.locator('.topbar').isVisible())failures.push('App chrome leaked into printed brief');
      const headings=await brief.locator('h2,h3').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).color));
      if(headings.some(colour=>colour!=='rgb(23, 44, 49)'))failures.push(`Print heading contrast regressed: ${headings.join(',')}`);
      await page.pdf({path:resolve(pdfOutput,'executive-brief-qa.pdf'),preferCSSPageSize:true,printBackground:true});
      await page.emulateMedia({media:'screen'});
    }
    const sizes=await brief.evaluate(el=>({content:el.scrollWidth,width:el.clientWidth}));
    if(sizes.content>sizes.width+1)failures.push(`Brief overflow at ${width}: ${JSON.stringify(sizes)}`);
    await page.keyboard.press('Escape');
    if(await brief.count())failures.push('Brief Escape did not close');
    if(!await page.getByRole('button',{name:'Open executive evidence brief'}).evaluate(el=>el===document.activeElement))failures.push('Brief did not restore trigger focus');
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))failures.push(`Page overflow at ${width}`);
    await page.close();console.log(`Checked new graph, source readings and brief at ${width}px.`);
  }
  if(failures.length)throw new Error(failures.join('\n'));
  console.log('Review enhancements passed: 15 responsive component states, source selection, hover, keyboard, export, print isolation and light/dark captures.');
} finally {await browser.close();}
