import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const url = process.argv[2] || 'https://care-ops-os.vercel.app/';
const out = process.argv[3] || 'tmp/live-prod-probe.json';
const shot = process.argv[4] || 'tmp/live-prod-probe.png';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const events = {
  url,
  finalUrl: null,
  title: null,
  console: [],
  pageErrors: [],
  failedRequests: [],
  responses: [],
  text: null,
  bodyClass: null,
  htmlHead: null,
};

page.on('console', (msg) => {
  events.console.push({
    type: msg.type(),
    text: msg.text(),
    location: msg.location(),
  });
});

page.on('pageerror', (error) => {
  events.pageErrors.push({ name: error.name, message: error.message, stack: error.stack });
});

page.on('requestfailed', (request) => {
  events.failedRequests.push({
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText,
  });
});

page.on('response', (response) => {
  const status = response.status();
  if (status >= 400 || response.url().includes('/api/')) {
    events.responses.push({
      url: response.url(),
      status,
      contentType: response.headers()['content-type'] || '',
    });
  }
});

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(6000);
  events.finalUrl = page.url();
  events.title = await page.title();
  events.text = (await page.locator('body').innerText({ timeout: 5000 })).slice(0, 8000);
  events.bodyClass = await page.locator('body').getAttribute('class').catch(() => null);
  events.htmlHead = await page.locator('head').innerHTML().catch(() => null);
  await page.screenshot({ path: shot, fullPage: true });
} catch (error) {
  events.probeError = { name: error.name, message: error.message, stack: error.stack };
} finally {
  await fs.writeFile(out, JSON.stringify(events, null, 2));
  await browser.close();
}
