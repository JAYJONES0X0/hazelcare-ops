const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const out = path.join(ROOT, 'live-smoke-results.json');
const loginEmail = process.env.AUTH_LOGIN_EMAIL || '';
const loginPassword = process.env.AUTH_PASSWORD || '';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.setDefaultTimeout(90 * 1000);
  const results = { startedAt: new Date().toISOString(), pages: [] };
  let lastLoginResponse = null;
  page.on('response', async (resp) => {
    try {
      if (resp.url().includes('/api/auth/login')) {
        let body = null;
        try { body = await resp.json(); } catch {}
        lastLoginResponse = { status: resp.status(), url: resp.url(), body };
      }
    } catch {}
  });
  await page.goto('https://hazelcare-ops.vercel.app/CareOps', { waitUntil: 'domcontentloaded' });
  results.loginUrl = page.url();
  try {
    let onAccessScreen = false;
    try {
      await page.waitForSelector('input[placeholder="Personnel ID"]', { timeout: 10000 });
      onAccessScreen = true;
    } catch {
      onAccessScreen = false;
    }
    const initialBodyText = await page.locator('body').innerText();
    results.domProbe = {
      onAccessScreen,
      hasCareOpsAccessText: /careops access/i.test(initialBodyText),
      initialTextSnippet: initialBodyText.slice(0, 220),
    };
    if (onAccessScreen) {
      if (!loginEmail || !loginPassword) {
        throw new Error('AUTH_LOGIN_EMAIL / AUTH_PASSWORD missing for smoke login');
      }
      await page.getByPlaceholder('Personnel ID').fill(loginEmail);
      await page.getByPlaceholder('Access Key').fill(loginPassword);
      const loginRespPromise = page.waitForResponse((resp) => resp.url().includes('/api/auth/login'), { timeout: 30000 }).catch(() => null);
      await page.getByRole('button', { name: /establish connection/i }).click();
      const loginResp = await loginRespPromise;
      if (loginResp) {
        let loginBody = null;
        try { loginBody = await loginResp.json(); } catch {}
        results.loginResponse = { status: loginResp.status(), url: loginResp.url(), body: loginBody };
      } else {
        results.loginResponse = { status: null, reason: 'no /api/auth/login response captured' };
      }
      await page.waitForLoadState('networkidle');
      if (!results.loginResponse && lastLoginResponse) results.loginResponse = lastLoginResponse;
      const authError = await page.locator('text=Invalid credentials').count();
      results.loginUiInvalidCredentials = Boolean(authError);
    }

    await page.waitForFunction(() => {
      const t = document.body?.innerText || '';
      return /Command Centre|Import Hub|Dashboard|Care Logs|Staff Monitoring/i.test(t) && !/CareOps Access|Sovereign Access|Invalid credentials/i.test(t);
    });
    results.loggedInAt = new Date().toISOString();
    const checks = [
      { label: 'Import Hub', text: 'Import Hub', section: 'Command Centre' },
      { label: 'Staff Monitoring', text: 'Staff Monitoring', section: 'Command Centre' },
      { label: 'Task Packs', text: 'Task Packs', section: 'Client Care' },
      { label: 'Writing Coach', text: 'Writing Coach', section: 'Notes & Documents' }
    ];
    results.navChecks = Object.fromEntries(checks.map(c => [c.label, false]));
    await page.screenshot({ path: path.join(ROOT, 'live-smoke-dashboard.png'), fullPage: true });
    for (const item of checks) {
      if (item.section) {
        const sectionBtn = page.getByText(item.section, { exact: true }).first();
        if (await sectionBtn.count()) {
          await sectionBtn.click();
          await page.waitForTimeout(300);
        }
      }
      const link = page.getByText(item.text, { exact: true }).first();
      const count = await link.count();
      if (!count) { results.pages.push({ page: item.label, ok: false, reason: 'nav label not found' }); continue; }
      await link.click();
      await page.waitForTimeout(1200);
      const pageText = await page.locator('body').innerText();
      const safe = item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await page.screenshot({ path: path.join(ROOT, `live-smoke-${safe}.png`), fullPage: true });
      results.pages.push({ page: item.label, ok: true, url: page.url(), excerpt: pageText.slice(0, 600) });
      results.navChecks[item.label] = true;
    }
  } catch (error) {
    results.error = error.message || String(error);
    await page.screenshot({ path: path.join(ROOT, 'live-smoke-error.png'), fullPage: true }).catch(() => {});
  } finally {
    fs.writeFileSync(out, JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
