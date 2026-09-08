import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const output = resolve('artifacts/screenshots/content-pass');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4192';
const failures = [];
const targets = [
  ['funnel', 'operational-analytics', '.conversion-hero'],
  ['cohorts', 'operational-analytics', '.stage-cohort-panel'],
  ['comparison', 'operational-analytics', '.operational-compare'],
  ['crosswalk', 'gap-radar', '.crosswalk-workbench'],
  ['diagnostics', 'diagnostics/sample-narsipatnam', '.diagnostics-layout'],
  ['coverage', 'data-readiness', '.coverage-grid-panel', '&view=coverage'],
  ['catalogue', 'data-readiness', '.catalogue-table'],
  ['quality', 'data-readiness', '.reconciliation-panel', '&view=quality'],
  ['sanitation', 'operational-analytics', '.conversion-hero', '&tab=sanitation'],
  ['processing', 'operational-analytics', '.legacy-pareto-panel', '&tab=processing'],
  ['facilities', 'operational-analytics', '.facility-registry', '&tab=processing&subview=facilities'],
  ['outcomes', 'operational-analytics', '.outcome-evidence-landscape', '&tab=outcomes'],
  ['periods', 'data-readiness', '.snapshot-gate', '&view=periods'],
];
try {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({viewport: {width, height: 1000}});
    page.on('pageerror', error => failures.push(error.message));
    for (const [name, path, selector, params=''] of targets) {
      await page.goto(`${base}/${path}/?mode=governed${params}`, {waitUntil:'networkidle'});
      if (name === 'facilities') await page.getByRole('button', {name:'Facility registry',exact:true}).click();
      await page.locator(selector).first().evaluate(el => el.scrollIntoView({block:'start'}));
      await page.screenshot({path: resolve(output, `${name}-${width}.png`), animations:'disabled'});
      if (name === 'cohorts') {
        await page.locator('.cohort-ledger summary').nth(1).click();
        await page.locator('.cohort-ledger details[open]').getByText('Reported examples', {exact:true}).waitFor();
      }
      if (name === 'comparison') {
        const name = await page.locator('.operational-compare-card h3').first().innerText();
        await page.getByRole('button', {name:`Remove ${name} from comparison`,exact:true}).click();
        const picker = page.getByRole('combobox', {name:'Browse another ULB'});
        const option = await picker.locator('optgroup option').first().getAttribute('value');
        await picker.selectOption(option);
        if (await page.locator('.operational-compare-card').count() !== 3) failures.push(`Comparison selection failed at ${width}`);
      }
      if (name === 'diagnostics') {
        await page.locator('.record-source-list summary').first().click();
        await page.locator('.record-periods button').first().click();
        if (width < 1151 && !await page.locator('.evidence-panel').evaluate(el => el === document.activeElement)) failures.push('Mobile record selection did not focus inspector');
        await page.locator('.record-browser').evaluate(el => el.scrollIntoView({block:'start'}));
        await page.screenshot({path: resolve(output, `source-library-${width}.png`),animations:'disabled'});
      }
      if (name === 'coverage') {
        await page.getByRole('combobox', {name:'Coverage source',exact:true}).selectOption({label:'E-Auto'});
        await page.getByLabel('Filter coverage return state').getByRole('button', {name:/Not returned/}).click();
        if (await page.locator('.anchor-entity-grid article').count() > 12) failures.push('Coverage page exceeds 12 entities');
        if (await page.locator('.anchor-entity-grid article .state-not-returned').count() !== await page.locator('.anchor-entity-grid article').count()) failures.push('Coverage state filter mixed results');
        await page.locator('.anchor-browser').evaluate(el => el.scrollIntoView({block:'start'}));
        await page.screenshot({path: resolve(output, `source-browser-${width}.png`),animations:'disabled'});
      }
      const size = await page.evaluate(() => ({page:document.documentElement.scrollWidth,viewport:innerWidth}));
      if (size.page > size.viewport + 1) failures.push(`${name}: ${size.page}px content in ${width}px viewport`);
      if (width === 1440) {
        await page.getByRole('button', {name:'Switch to dark theme',exact:true}).click();
        await page.screenshot({path: resolve(output, `${name}-${width}-dark.png`),animations:'disabled'});
      }
    }
    console.log(`Lower-content checks completed at ${width}px.`);
    await page.close();
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('Lower-content smoke passed: 39 section states, expanded cohorts, ULB replacement, source-library selection, coverage filters and light/dark captures.');
} finally {await browser.close();}
