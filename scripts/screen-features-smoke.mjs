import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4192';
const output = resolve('artifacts/screenshots/screen-features');
await mkdir(output, { recursive: true });
const routes = [
  ['collection', '/operational-analytics/?mode=governed&tab=collection'],
  ['sanitation', '/operational-analytics/?mode=governed&tab=sanitation'],
  ['processing', '/operational-analytics/?mode=governed&tab=processing'],
  ['outcomes', '/operational-analytics/?mode=governed&tab=outcomes'],
  ['radar', '/gap-radar/?mode=governed'],
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
    for (const [name, path] of routes) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.locator('.app-shell:not(.booting)').waitFor();
      const sizes = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
      if (sizes.content > sizes.viewport + 1) failures.push(`${name}: ${sizes.content}px in ${width}px viewport`);
      await page.screenshot({ path: resolve(output, `${name}-${width}.png`), fullPage: false, animations: 'disabled' });
      if (name === 'readiness') {
        const clippedTabs = await page.locator('.readiness-tabs').evaluate((nav) => [...nav.querySelectorAll('button')].filter((button) => button.getBoundingClientRect().right > nav.getBoundingClientRect().right + 1).length);
        if (clippedTabs) failures.push(`Readiness tabs clipped at ${width}px`);
      }
      if (name === 'diagnostics') {
        const metric = page.getByRole('button', { name: /Processing facility/ });
        const colour = await metric.locator('strong').evaluate((node) => getComputedStyle(node).color);
        await metric.hover();
        if (colour !== await metric.locator('strong').evaluate((node) => getComputedStyle(node).color)) failures.push('Diagnostic hover changes metric text colour');
        await metric.click();
        await page.getByText('Evidence details and raw fields', { exact: true }).click();
        await page.getByText('total_tpd', { exact: true }).waitFor();
      }
      if (width === 1440) {
        await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
        await page.screenshot({ path: resolve(output, `${name}-${width}-dark.png`), fullPage: false, animations: 'disabled' });
      }
    }
    console.log(`Checked ${routes.length} screen states at ${width}px.`);
    await page.close();
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('Screen features passed: 50 responsive screen states, light/dark captures, diagnostic selection and hover readability.');
} finally { await browser.close(); }
