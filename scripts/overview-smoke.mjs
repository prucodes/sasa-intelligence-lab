import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4192';
const output = resolve('artifacts/screenshots/overview-review');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/?mode=governed&theme=light`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /The operational picture/ }).waitFor();
    const issues = page.getByRole('region', { name: 'Operational review issues' });
    const vehicle = issues.getByRole('button', { name: /Vehicle delivery/ });
    const before = await vehicle.evaluate((node) => getComputedStyle(node).color);
    await vehicle.hover();
    const after = await vehicle.evaluate((node) => getComputedStyle(node).color);
    if (before !== after) throw new Error('Hover changes the card text colour.');
    await vehicle.click();
    await page.getByRole('combobox', { name: 'Review district', exact: true }).selectOption('Kurnool');
    const list = page.getByRole('list', { name: 'ULBs in selected review scope' });
    if (!(await list.innerText()).includes('Kurnool')) throw new Error('District did not update the named list.');
    await issues.getByRole('button', { name: /Legacy waste/ }).click();
    if (await page.getByRole('combobox', { name: 'Review district', exact: true }).inputValue() !== '') throw new Error('Changing issue did not reset district.');
    const changed = page.getByRole('link').filter({ hasText: '25 matched ULB values changed' });
    await changed.waitFor();
    if (!(await changed.innerText()).includes('25 lower')) throw new Error('Period movement is inconsistent.');
    await page.getByRole('button', { name: /^Chittoor:/ }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Review district"]').value === 'Chittoor');
    if (width <= 760) await list.waitFor({ state: 'visible' });
    const overflow = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    if (overflow.content > overflow.viewport + 1) throw new Error(`Overflow at ${width}px: ${JSON.stringify(overflow)}`);
    await page.goto(`${base}/?mode=governed&theme=light`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: resolve(output, `overview-${width}-light.png`), fullPage: true });
    if (width === 1440) {
      await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
      await page.screenshot({ path: resolve(output, 'overview-1440-dark.png'), fullPage: true });
    }
    await page.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Overview smoke passed: five responsive widths, linked issue/map/list, unchanged hover text, source-period movement, light/dark screenshots and no page errors.');
} finally {
  await browser.close();
}
