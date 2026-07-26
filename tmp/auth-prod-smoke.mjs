import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseUrl = process.argv[2] || 'https://care-ops-os.vercel.app/';
const out = process.argv[3] || 'tmp/auth-prod-smoke.json';
const screenshotDir = process.argv[4] || 'tmp/auth-prod-smoke';

function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = parseEnv(await fs.readFile('.env.local', 'utf8'));
const email = (env.AUTH_LOGIN_EMAIL || '').split(',')[0]?.trim();
const password = env.AUTH_PASSWORD;

if (!email || !password) {
  throw new Error('Missing AUTH_LOGIN_EMAIL or AUTH_PASSWORD in .env.local');
}

const pages = [
  'briefing',
  'dashboard',
  'upload',
  'note-workspace',
  'client-diary',
  'staff-monitoring',
  'nourish-tasks',
  'reports',
  'compliance',
  'settings',
  'admin',
];

await fs.mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const result = {
  baseUrl,
  login: null,
  events: [],
  pages: [],
};

page.on('console', (msg) => {
  const type = msg.type();
  if (['error', 'warning'].includes(type)) {
    result.events.push({ kind: 'console', type, text: msg.text(), location: msg.location(), page: page.url() });
  }
});

page.on('pageerror', (error) => {
  result.events.push({ kind: 'pageerror', name: error.name, message: error.message, stack: error.stack, page: page.url() });
});

page.on('requestfailed', (request) => {
  result.events.push({ kind: 'requestfailed', url: request.url(), failure: request.failure()?.errorText, page: page.url() });
});

page.on('response', (response) => {
  const status = response.status();
  if (status >= 400) {
    result.events.push({ kind: 'bad-response', url: response.url(), status, contentType: response.headers()['content-type'] || '', page: page.url() });
  }
});

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForTimeout(2500),
  ]);

  const bodyAfterLogin = await page.locator('body').innerText({ timeout: 8000 }).catch((error) => `BODY_READ_FAILED: ${error.message}`);
  result.login = {
    url: page.url(),
    bodySample: bodyAfterLogin.slice(0, 1000),
    hasLoginForm: await page.locator('input[type="password"]').count(),
  };

  for (const pageId of pages) {
    const pageResult = { pageId, ok: false, errorsBefore: result.events.length };
    try {
      await page.evaluate((id) => {
        localStorage.setItem('hc_current_page', id);
      }, pageId);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
      pageResult.title = await page.title();
      pageResult.bodySample = (await page.locator('body').innerText({ timeout: 8000 })).slice(0, 2000);
      pageResult.errorCount = result.events.length - pageResult.errorsBefore;
      pageResult.ok = !/System Recovery Mode|BODY_READ_FAILED/i.test(pageResult.bodySample);
      await page.screenshot({ path: `${screenshotDir}/${pageId}.png`, fullPage: true });
    } catch (error) {
      pageResult.error = { name: error.name, message: error.message, stack: error.stack };
    }
    result.pages.push(pageResult);
  }
} catch (error) {
  result.fatal = { name: error.name, message: error.message, stack: error.stack };
} finally {
  await fs.writeFile(out, JSON.stringify(result, null, 2));
  await browser.close();
}
