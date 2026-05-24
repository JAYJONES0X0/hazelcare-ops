const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const email = process.env.AUTH_LOGIN_EMAIL || '';
const password = process.env.AUTH_PASSWORD || '';
(async () => {
  const out = { startedAt: new Date().toISOString(), console: [], pageErrors: [], responses: [], snapshots: [] };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1030 } });
  page.setDefaultTimeout(45000);
  page.on('console', msg => out.console.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => out.pageErrors.push({ message: err.message, stack: err.stack }));
  page.on('response', resp => { if (resp.status() >= 400) out.responses.push({ status: resp.status(), url: resp.url() }); });
  try {
    await page.goto('https://hazelcare-ops.vercel.app/CareOps', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[placeholder="Personnel ID"]', { timeout: 10000 }).catch(() => null);
    if (await page.locator('input[placeholder="Personnel ID"]').count()) {
      await page.getByPlaceholder('Personnel ID').fill(email);
      await page.getByPlaceholder('Access Key').fill(password);
      await page.getByRole('button', { name: /establish connection/i }).click();
    }
    await page.waitForFunction(() => /Command Centre|Notes & Documents|Care Logs/i.test(document.body.innerText || ''), null, { timeout: 30000 });
    await page.getByText('Notes & Documents', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByText('Note Workspace', { exact: true }).first().click();
    await page.waitForTimeout(4000);
    const body = await page.locator('body').innerText();
    out.snapshots.push({ label: 'after-note-workspace-4s', hasHydrating: /Hydrating records in background/i.test(body), hasImportPrompt: /Import a diary export to begin/i.test(body), hasAllClients: /All clients/i.test(body), excerpt: body.slice(0, 1200) });
    await page.waitForTimeout(4000);
    const body2 = await page.locator('body').innerText();
    out.snapshots.push({ label: 'after-note-workspace-8s', hasHydrating: /Hydrating records in background/i.test(body2), hasImportPrompt: /Import a diary export to begin/i.test(body2), hasAllClients: /All clients/i.test(body2), excerpt: body2.slice(0, 1200) });
    await page.screenshot({ path: path.join(__dirname, 'live-note-workspace-probe.png'), fullPage: true });
  } catch (err) {
    out.error = err.message || String(err);
    await page.screenshot({ path: path.join(__dirname, 'live-note-workspace-error.png'), fullPage: true }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(__dirname, 'live-note-workspace-probe.json'), JSON.stringify(out, null, 2));
    await browser.close();
  }
})();
