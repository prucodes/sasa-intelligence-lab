import { chromium } from '@playwright/test';

const baseUrl = process.env.PREVIEW_URL || 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(10_000);
const externalSourceRequests = [];
page.on('request', (request) => {
  if (request.url().includes('datalakes.ailivinglabs.ap.gov.in')) externalSourceRequests.push(request.url());
});

await page.goto(`${baseUrl}/?mode=sample`, { waitUntil: 'domcontentloaded' });
await page.getByRole('status').filter({ hasText: 'Authenticated snapshots' }).waitFor();
await page.getByRole('link', { name: 'Operational Analytics', exact: true }).click();
await page.waitForURL(/\/operational-analytics\?mode=sample/);
await page.waitForTimeout(500);
await page.getByRole('tab', { name: 'Sanitation Delivery', exact: true }).click();
await page.getByRole('heading', { name: 'IHHL delivery funnel', exact: true }).waitFor();
await page.getByRole('link', { name: 'Gap Radar', exact: true }).click();
await page.waitForURL(/\/gap-radar\?mode=sample/);
await page.getByRole('link', { name: /Narsipatnam/ }).click();
await page.waitForURL(/\/diagnostics\/sample-narsipatnam\?mode=sample/);
await page.getByRole('button', { name: /Processing facility/ }).click();
await page.getByText('total_tpd', { exact: true }).waitFor();
await page.goto(`${baseUrl}/data-readiness?mode=sample`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.getByRole('tab', { name: 'Quality', exact: true }).click();
await page.getByRole('heading', { name: 'Operational evidence quality', exact: true }).waitFor();
await page.goto(`${baseUrl}/data-readiness?mode=live`, { waitUntil: 'domcontentloaded' });
await page.getByRole('status').filter({ hasText: 'Live connector reserved' }).waitFor();

if (externalSourceRequests.length) {
  throw new Error(`LIVE mode made unexpected source requests: ${externalSourceRequests.join(', ')}`);
}

await browser.close();
console.log('Browser smoke passed: mode switch, navigation, diagnostics evidence, and inert LIVE mode.');
