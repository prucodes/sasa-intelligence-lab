import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4192';
const output = resolve('artifacts/screenshots/screen-features');
await mkdir(output, { recursive: true });
const routes = [
  ['overview', '/?mode=governed'],
  ['environment', '/environment/?mode=governed'],
  ['environment-carbon', '/environment/?mode=governed', 'Carbon scenarios'],
  ['environment-gaps', '/environment/?mode=governed', 'Inventory gaps'],
  ['environment-actions', '/environment/?mode=governed', 'Action pathway'],
  ['revisions', '/reconciliation/?mode=governed&view=revisions'],
  ['reconciliation', '/reconciliation/?mode=governed'],
  ['delivery', '/operational-analytics/?mode=governed&tab=delivery'],
  ['rural', '/operational-analytics/?mode=governed&tab=rural'],
  ['continuity', '/operational-analytics/?mode=governed&tab=continuity'],
  ['collection', '/operational-analytics/?mode=governed&tab=collection'],
  ['sanitation', '/operational-analytics/?mode=governed&tab=sanitation'],
  ['processing', '/operational-analytics/?mode=governed&tab=processing'],
  ['outcomes', '/operational-analytics/?mode=governed&tab=outcomes'],
  ['radar', '/gap-radar/?mode=governed'],
  ['rankings', '/gap-radar/?mode=governed&view=rankings'],
  ['radar-delivery', '/gap-radar/?mode=governed&view=ulb'],
  ['rural-movement', '/gap-radar/?mode=governed&view=movement'],
  ['rural-register', '/gap-radar/?mode=governed&view=register'],
  ['radar-programmes', '/gap-radar/?mode=governed&view=works'],
  ['diagnostics', '/diagnostics/sample-narsipatnam/?mode=governed'],
  ['readiness', '/data-readiness/?mode=governed'],
  ['coverage', '/data-readiness/?mode=governed&view=coverage'],
  ['periods', '/data-readiness/?mode=governed&view=periods'],
  ['quality', '/data-readiness/?mode=governed&view=quality'],
];
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.on('pageerror', (error) => failures.push(error.message));
    for (const [name, path, tab] of routes) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.locator('.app-shell:not(.booting)').waitFor();
      if (tab) await page.getByRole('tab', {name: new RegExp(tab)}).click();
      if (await page.getByText('404', {exact:true}).count()) failures.push(`${name}: route returned 404`);
      const sizes = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
      if (sizes.content > sizes.viewport + 1) failures.push(`${name}: ${sizes.content}px in ${width}px viewport`);
      await page.screenshot({ path: resolve(output, `${name}-${width}.png`), fullPage: name.startsWith('environment'), animations: 'disabled' });
      if (name === 'readiness') {
        const clippedTabs = await page.locator('.readiness-tabs').evaluate((nav) => [...nav.querySelectorAll('button')].filter((button) => button.getBoundingClientRect().right > nav.getBoundingClientRect().right + 1).length);
        if (clippedTabs) failures.push(`Readiness tabs clipped at ${width}px`);
      }
      if (name === 'diagnostics') {
        const metric = page.getByRole('combobox', { name: 'Evidence record', exact: true });
        await metric.selectOption({ label: 'MSW Processing · ISWM Facilities · July 2026' });
        await page.waitForTimeout(350);
        await page.getByText('Evidence details and raw fields', { exact: true }).click();
        await page.getByText('total_tpd', { exact: true }).waitFor();
      }
      if (width === 1440) {
        await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
        await page.screenshot({ path: resolve(output, `${name}-${width}-dark.png`), fullPage: name.startsWith('environment'), animations: 'disabled' });
      }
    }
    console.log(`Checked ${routes.length} screen states at ${width}px.`);
    await page.close();
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`Screen features passed: ${routes.length * 5} responsive screen states, light/dark captures and diagnostic selection.`);
} finally { await browser.close(); }
