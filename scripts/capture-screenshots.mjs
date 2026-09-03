import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.PREVIEW_URL || 'http://localhost:3000';
const outputDir = resolve('artifacts/screenshots');
const allRoutes = [
  ['overview', '/?mode=sample'],
  ['gap-radar', '/gap-radar?mode=sample'],
  ['diagnostics', '/diagnostics/sample-narsipatnam?mode=sample'],
  ['data-readiness', '/data-readiness?mode=sample'],
];
const routes = process.env.ROUTE_SET
  ? allRoutes.filter(([name]) => name === process.env.ROUTE_SET)
  : allRoutes;
const allViewports = [
  ['desktop', { width: 1672, height: 941 }],
  ['tablet', { width: 1024, height: 1366 }],
  ['phone', { width: 390, height: 844 }],
];
const viewports = process.env.VIEWPORT_SET
  ? allViewports.filter(([name]) => name === process.env.VIEWPORT_SET)
  : allViewports;

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
for (const [viewportName, viewport] of viewports) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const [routeName, route] of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0), undefined, { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: resolve(outputDir, `${routeName}-${viewportName}.png`), fullPage: false });
  }
  await context.close();
}
await browser.close();
