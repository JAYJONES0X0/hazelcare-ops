const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const email = process.env.AUTH_LOGIN_EMAIL || '';
const password = process.env.AUTH_PASSWORD || '';
const root = __dirname;
const baseUrl = 'https://hazelcare-ops.vercel.app/CareOps';

const pages = [
  ['Command Centre', 'Dashboard'],
  ['Command Centre', 'Import Hub'],
  ['Command Centre', 'Briefing'],
  ['Command Centre', 'Care Logs'],
  ['Command Centre', 'Staff Monitoring'],
  ['Client Care', 'Client Records'],
  ['Client Care', 'Task Packs'],
  ['Client Care', 'Risk & PBS'],
  ['Client Care', 'Audit Reports'],
  ['Staff & Shifts', 'Staff Directory'],
  ['Staff & Shifts', 'Handovers'],
  ['Staff & Shifts', 'Training & DBS'],
  ['Staff & Shifts', 'Agency Cover'],
  ['Staff & Shifts', 'Action Log'],
  ['Staff & Shifts', 'Incidents'],
  ['Notes & Documents', 'Staff Note'],
  ['Notes & Documents', 'Note Workspace'],
  ['Notes & Documents', 'Writing Coach'],
  ['Notes & Documents', 'Templates'],
  ['System', 'Settings'],
  ['System', 'Admin & Backup'],
  ['System', 'Regional Overview'],
];

async function login(page, out) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder="Personnel ID"]', { timeout: 12000 }).catch(() => null);
  if (await page.locator('input[placeholder="Personnel ID"]').count()) {
    if (!email || !password) throw new Error('Missing AUTH_LOGIN_EMAIL / AUTH_PASSWORD');
    await page.getByPlaceholder('Personnel ID').fill(email);
    await page.getByPlaceholder('Access Key').fill(password);
    await page.getByRole('button', { name: /establish connection/i }).click();
  }
  await page.waitForFunction(() => /Command Centre|Import Hub|Dashboard|Care Logs|Staff Monitoring/i.test(document.body.innerText || ''), null, { timeout: 45000 });
  out.authenticated = true;
}

async function inspectPage(page, label, viewportName) {
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(600);
  return await page.evaluate(({ label, viewportName }) => {
    const buttons = [...document.querySelectorAll('button')];
    const links = [...document.querySelectorAll('a')];
    const inputs = [...document.querySelectorAll('input, textarea, select')];
    const unlabeledButtons = buttons
      .filter((button) => !(button.innerText || '').trim() && !button.getAttribute('aria-label') && !button.getAttribute('title'))
      .map((button) => button.outerHTML.slice(0, 160));
    const unlabeledInputs = inputs
      .filter((input) => {
        const id = input.getAttribute('id');
        const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
        return !hasLabel && !input.getAttribute('aria-label') && !input.getAttribute('placeholder');
      })
      .map((input) => input.outerHTML.slice(0, 160));
    const badLinks = links
      .filter((link) => link.getAttribute('href') === '#' || !link.getAttribute('href'))
      .map((link) => (link.innerText || link.outerHTML).trim().slice(0, 120));
    const overflowing = [...document.body.querySelectorAll('*')]
      .filter((el) => el.scrollWidth > el.clientWidth + 8 && el.clientWidth > 0)
      .slice(0, 15)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        className: String(el.className || '').slice(0, 120),
        text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      }));
    return {
      label,
      viewportName,
      url: location.href,
      title: document.title,
      textStart: (document.body.innerText || '').slice(0, 800),
      buttonCount: buttons.length,
      linkCount: links.length,
      inputCount: inputs.length,
      unlabeledButtons,
      unlabeledInputs,
      badLinks,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 8,
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      overflowing,
    };
  }, { label, viewportName });
}

(async () => {
  const out = {
    startedAt: new Date().toISOString(),
    url: baseUrl,
    authenticated: false,
    console: [],
    pageErrors: [],
    failedRequests: [],
    responses4xx5xx: [],
    pageResults: [],
  };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 950 },
      { name: 'mobile', width: 375, height: 812 },
    ]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      page.setDefaultTimeout(45000);
      page.on('console', (msg) => out.console.push({ viewport: viewport.name, type: msg.type(), text: msg.text().slice(0, 500) }));
      page.on('pageerror', (err) => out.pageErrors.push({ viewport: viewport.name, message: err.message, stack: (err.stack || '').slice(0, 1000) }));
      page.on('requestfailed', (req) => out.failedRequests.push({ viewport: viewport.name, url: req.url(), failure: req.failure()?.errorText }));
      page.on('response', (resp) => {
        if (resp.status() >= 400) out.responses4xx5xx.push({ viewport: viewport.name, status: resp.status(), url: resp.url() });
      });
      await login(page, out);
      await page.screenshot({ path: path.join(root, `audit-${viewport.name}-home.png`), fullPage: true });
      out.pageResults.push(await inspectPage(page, 'Initial/Home', viewport.name));
      for (const [section, label] of pages) {
        let sectionButton = page.getByText(section, { exact: true }).first();
        if (!(await sectionButton.count())) {
          sectionButton = page.locator(`button[title="${section}"]`).first();
        }
        if (await sectionButton.count()) {
          await sectionButton.click().catch(() => null);
          await page.waitForTimeout(250);
        }
        const navItem = page.getByText(label, { exact: true }).first();
        if (!(await navItem.count())) {
          out.pageResults.push({ label, viewportName: viewport.name, ok: false, reason: 'nav item not found' });
          continue;
        }
        await navItem.click();
        await page.waitForTimeout(900);
        const safe = `${viewport.name}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        await page.screenshot({ path: path.join(root, `audit-${safe}.png`), fullPage: true }).catch(() => null);
        const result = await inspectPage(page, label, viewport.name);
        result.ok = true;
        out.pageResults.push(result);
      }
      await page.close();
    }
  } catch (err) {
    out.error = err.message || String(err);
  } finally {
    out.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(root, 'live-full-audit.json'), JSON.stringify(out, null, 2));
    await browser.close();
  }
})();
