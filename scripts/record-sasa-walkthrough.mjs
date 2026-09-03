import { chromium } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const run = promisify(execFile);
const baseUrl = process.env.PREVIEW_URL || 'http://localhost:3001';
const outputDir = resolve('artifacts/demo-video');
const webmPath = resolve(outputDir, 'sasa-intelligence-lab-walkthrough.webm');
const mp4Path = resolve(outputDir, 'sasa-intelligence-lab-walkthrough.mp4');
const subtitlePath = resolve(outputDir, 'sasa-intelligence-lab-walkthrough.srt');
const viewport = { width: 1440, height: 900 };

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 1,
  colorScheme: 'light',
  recordVideo: { dir: outputDir, size: viewport },
});
const page = await context.newPage();
page.setDefaultTimeout(15_000);

const startedAt = Date.now();
const captions = [];
let activeCaption = null;

const elapsedSeconds = () => (Date.now() - startedAt) / 1000;
const sleep = (milliseconds) => page.waitForTimeout(milliseconds);

async function installWalkthroughOverlay() {
  await page.evaluate(() => {
    if (document.querySelector('#sasa-demo-caption')) return;
    const style = document.createElement('style');
    style.id = 'sasa-demo-style';
    style.textContent = `
      #sasa-demo-caption{position:fixed;z-index:2147483646;left:50%;bottom:27px;transform:translateX(-50%);width:min(870px,74vw);padding:13px 22px;border:1px solid rgba(151,204,220,.55);border-radius:16px;color:#fff;background:linear-gradient(110deg,rgba(6,42,66,.94),rgba(23,43,82,.94));box-shadow:0 16px 46px rgba(3,22,43,.3);font:700 18px/1.4 Inter,system-ui,sans-serif;text-align:center;letter-spacing:.005em;backdrop-filter:blur(14px);opacity:0;transition:opacity .25s ease}
      #sasa-demo-caption.visible{opacity:1}
      #sasa-demo-section{position:fixed;z-index:2147483646;right:28px;top:88px;padding:8px 13px;border:1px solid rgba(15,148,143,.28);border-radius:999px;color:#087f7a;background:rgba(245,255,253,.94);box-shadow:0 8px 24px rgba(24,61,95,.12);font:850 11px/1 Inter,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      #sasa-demo-cursor{position:fixed;z-index:2147483647;left:1180px;top:112px;width:22px;height:22px;border:3px solid #fff;border-radius:50%;background:#08a7a0;box-shadow:0 0 0 5px rgba(8,167,160,.2),0 7px 20px rgba(3,30,54,.3);pointer-events:none;transition:left .55s cubic-bezier(.2,.8,.2,1),top .55s cubic-bezier(.2,.8,.2,1),transform .16s ease}
      #sasa-demo-cursor.click{transform:scale(.68);box-shadow:0 0 0 12px rgba(8,167,160,.16),0 7px 20px rgba(3,30,54,.3)}
    `;
    document.head.appendChild(style);
    const caption = document.createElement('div');
    caption.id = 'sasa-demo-caption';
    caption.setAttribute('role', 'status');
    const section = document.createElement('div');
    section.id = 'sasa-demo-section';
    const cursor = document.createElement('div');
    cursor.id = 'sasa-demo-cursor';
    document.body.append(caption, section, cursor);
  });
}

async function caption(text, section, duration = 4300) {
  const now = elapsedSeconds();
  if (activeCaption) {
    activeCaption.end = now;
    captions.push(activeCaption);
  }
  activeCaption = { start: now, end: now + duration / 1000, text };
  await installWalkthroughOverlay();
  await page.evaluate(({ text, section }) => {
    const captionNode = document.querySelector('#sasa-demo-caption');
    const sectionNode = document.querySelector('#sasa-demo-section');
    captionNode.textContent = text;
    sectionNode.textContent = section;
    captionNode.classList.add('visible');
  }, { text, section });
  await sleep(duration);
}

async function moveCursorTo(locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await page.evaluate(({ x, y }) => {
    const cursor = document.querySelector('#sasa-demo-cursor');
    if (cursor) {
      cursor.style.left = `${x - 11}px`;
      cursor.style.top = `${y - 11}px`;
    }
  }, { x, y });
  await page.mouse.move(x, y, { steps: 18 });
  await sleep(650);
}

async function click(locator) {
  await moveCursorTo(locator);
  await page.evaluate(() => document.querySelector('#sasa-demo-cursor')?.classList.add('click'));
  await sleep(180);
  await locator.click();
  await sleep(180);
  await page.evaluate(() => document.querySelector('#sasa-demo-cursor')?.classList.remove('click')).catch(() => {});
}

async function goto(path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, { timeout: 10_000 }).catch(() => {});
  await installWalkthroughOverlay();
  await sleep(450);
}

async function smoothScroll(y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
  await sleep(900);
}

async function clickNavigation(name) {
  const link = page.getByRole('link', { name, exact: true });
  await moveCursorTo(link);
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    link.click(),
  ]);
  await installWalkthroughOverlay();
  await sleep(500);
}

async function selectUlb(label) {
  const selector = page.getByRole('combobox', { name: 'Selected entity' });
  const value = await selector.locator('option').filter({ hasText: label }).getAttribute('value');
  if (!value) throw new Error(`Unable to resolve ULB option: ${label}`);
  await moveCursorTo(selector);
  await Promise.all([
    page.waitForURL((url) => url.pathname === `/diagnostics/${value}`),
    selector.selectOption(value),
  ]);
  await page.waitForLoadState('domcontentloaded');
  await installWalkthroughOverlay();
  await sleep(550);
}

await goto('/?mode=sample');
await caption('SASA Intelligence Lab turns governed sanitation records into a small number of operational review signals—then keeps every result traceable to evidence.', 'SASA INTELLIGENCE LAB', 5600);
await caption('The SAMPLE Overview starts with what needs attention: reported collection delivery, IHHL completion, and legacy-waste clearance.', 'OVERVIEW', 5200);
await smoothScroll(520);
await caption('The operational monitor compares only genuinely returned reporting periods. Each line remains a separate source measure—not a composite sanitation score.', 'REPORTED PERIOD HISTORY', 5000);

await clickNavigation('Operational Analytics');
await caption('Collection analytics follows the procurement chain from target, to work orders, to vehicles reported supplied.', 'OPERATIONAL ANALYTICS · COLLECTION', 5000);
await caption('The review table identifies the largest reported gaps using transparent arithmetic. It does not claim fleet utilization or service failure.', 'WHERE TO REVIEW', 4600);

await click(page.getByRole('tab', { name: 'Sanitation Delivery', exact: true }));
await caption('Sanitation Delivery shows how identified households move through approval, construction, and reported completion.', 'SANITATION DELIVERY', 5000);

await click(page.getByRole('tab', { name: 'Processing Infrastructure', exact: true }));
await caption('Processing Infrastructure separates configured TPD and KLD and surfaces facility status and source-quality issues. Capacity is never presented as utilization.', 'PROCESSING INFRASTRUCTURE', 5200);

await click(page.getByRole('tab', { name: /Swachh Outcomes/, exact: false }));
await caption('Swachh Outcomes are clearly isolated as 2024 historical context. They are not attributed to, or directly compared with, 2026 operations.', 'SWACHH OUTCOMES · 2024', 5000);

await clickNavigation('Gap Radar');
await caption('Gap Radar remains evidence-gated in SAMPLE mode. No real entity is forced onto a quadrant before identity, period, outcome, and scoring-policy checks are satisfied.', 'GAP RADAR · CURRENT ELIGIBILITY', 6000);

await clickNavigation('ULB Diagnostics');
await caption('ULB Diagnostics reads like a case file. Narsipatnam has matching collection, IHHL, processing, and historical outcome records—but remains UNSCORED.', 'ULB DIAGNOSTICS · NARSIPATNAM', 5800);
await click(page.getByRole('button', { name: /Processing facility/ }));
await caption('Selecting a record updates the Evidence Inspector with its source dataset, reporting period, grain, formula or check, scoring state, and expandable raw fields.', 'EVIDENCE INSPECTOR', 5200);

await selectUlb('Vijayawada — NTR');
await caption('The same evidence-first case view works for Vijayawada, preserving its own returned records and source periods.', 'ULB DIAGNOSTICS · VIJAYAWADA', 4800);

await selectUlb('Tirupati — Tirupati');
await caption('Tirupati can be reviewed independently without borrowing values from another ULB or treating missing records as zero.', 'ULB DIAGNOSTICS · TIRUPATI', 4800);

await selectUlb('Visakhapatnam — Visakhapatnam');
await caption('Visakhapatnam demonstrates the breadth of the retained evidence while the candidate identity warning remains visible and honest.', 'ULB DIAGNOSTICS · VISAKHAPATNAM', 5000);

await clickNavigation('Data Readiness');
await caption('Data Readiness explains what is usable today, what still needs review, and what evidence is required for higher-order intelligence.', 'DATA READINESS', 5200);

await click(page.getByRole('tab', { name: 'Coverage', exact: true }));
await caption('Coverage shows exact normalized-name overlaps across major datasets. A missing return is shown as missing—not converted into a zero.', 'COVERAGE', 5000);

await click(page.getByRole('tab', { name: 'Periods', exact: true }));
await caption('Periods lists only periods actually retrieved from governed responses, making the available historical depth explicit.', 'PERIOD AVAILABILITY', 4800);

await click(page.getByRole('tab', { name: 'Quality', exact: true }));
await caption('Quality brings ingestion and evidence issues into an operational review view: identity ambiguity, period conflicts, duplicates, missing fields, and unavailable sources.', 'DATA QUALITY', 5400);

await click(page.getByRole('tab', { name: 'Catalogue', exact: true }));
await caption('The catalogue and dataset-use register show how all 33 documented datasets relate to the product—analytical, supporting, unavailable, or pending ingestion.', 'DATASET USE', 5200);

await clickNavigation('Overview');
await caption('Today: governed operational review signals. Next: Gap Radar after evidence alignment. Later: persistent bottleneck and early-warning analytics after validated history exists.', 'TODAY · NEXT · LATER', 6200);
await caption('SASA Intelligence Lab: what the data tells us, what needs review, and the evidence behind every conclusion.', 'EVIDENCE-GATED SANITATION INTELLIGENCE', 6000);

if (activeCaption) {
  activeCaption.end = elapsedSeconds();
  captions.push(activeCaption);
  activeCaption = null;
}

const video = page.video();
await page.close();
await video.saveAs(webmPath);
await context.close();
await browser.close();

const timestamp = (seconds) => {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const ms = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};
const srt = captions.map((item, index) => `${index + 1}\n${timestamp(item.start)} --> ${timestamp(item.end)}\n${item.text}\n`).join('\n');
await writeFile(subtitlePath, srt, 'utf8');

await run('ffmpeg', [
  '-y', '-i', webmPath,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  mp4Path,
]);

console.log(JSON.stringify({ mp4Path, webmPath, subtitlePath, durationSeconds: elapsedSeconds() }, null, 2));
