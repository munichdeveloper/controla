// Optional browser contract verification without duplicating the framework PR's test dependencies.
// Build first. Pass an installed playwright/index.mjs path, or install playwright externally.
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3028'], { stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch('http://127.0.0.1:3028/login')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true });
  for (const plan of ['solo', 'agency', 'legacy']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const calls = [];
    const unknown = [];
    const detail = { id: 'demo', name: 'Fixture n8n', baseUrl: 'https://n8n.example.invalid', status: 'online', version: '1.0.0', latestVersion: '1.0.0', lastSeenAt: '2026-11-06T10:00:00Z', createdAt: '2026-11-01T10:00:00Z' };
    const user = { token: `token-${plan}`, username: `${plan}@example.invalid`, email: `${plan}@example.invalid`, role: 'ADMIN' };
    await context.route('**/api/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname.slice(4);
      const authenticated = request.headers().authorization === `Bearer token-${plan}`;
      calls.push({ path, authenticated });
      const reply = body => route.fulfill({ json: body });
      if (path === '/license') return reply({ edition: 'Premium Edition', ...(plan === 'legacy' ? {} : { tenantBound: authenticated }), maxInstances: authenticated && plan !== 'legacy' ? (plan === 'solo' ? 10 : 30) : -1,
        features: { 'diagnostics.report': true, ...(plan === 'legacy' ? {} : {
          'workflow.import': !authenticated || plan === 'agency', 'backup.scheduled': !authenticated || plan === 'agency', 'companion.manage': !authenticated,
        }) } });
      if (path === '/auth/login' || path === '/auth/me') return reply(user);
      if (!authenticated) return route.fulfill({ status: 401, body: 'unauthorized' });
      if (path === '/version') return reply({ version: 'fixture' });
      if (path === '/instances') return reply([detail]);
      if (path === '/instances/demo') return reply(detail);
      if (path === '/instances/demo/workflows') return reply([{ id: 'wf1', name: 'Fixture workflow', active: true }]);
      if (path === '/backups/settings') return reply({ enabled: true, intervalHours: 24, googleDriveFolderId: 'fixture-folder' });
      if (path === '/premium/instances/backups') return reply({});
      if (path === '/premium/instances/demo/backup') return reply({ lastBackupAt: null });
      if (path === '/premium/companion/demo/status') return reply({ configured: false, connected: false });
      if (/events|error-patterns/.test(path)) return reply([]);
      unknown.push(path); return route.fulfill({ status: 404, body: 'unknown fixture request' });
    });
    await page.goto('http://127.0.0.1:3028/login');
    await page.locator('#username').fill(user.username);
    await page.locator('#password').fill('fixture-password');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.waitForURL('http://127.0.0.1:3028/');
    const expected = plan === 'legacy' ? 'Beliebig viele Instanzen überwachen' : `Bis zu ${plan === 'solo' ? 10 : 30} n8n-Instanzen überwachen`;
    await page.getByText(expected, { exact: false }).waitFor();
    assert(calls.some(call => call.path === '/license' && call.authenticated));
    await page.goto('http://127.0.0.1:3028/instances/demo');
    await page.getByRole('button', { name: 'Workflows', exact: true }).click();
    await page.getByText('Fixture workflow', { exact: true }).waitFor();
    assert.equal(await page.locator('[title="Workflow importieren"]').count(), plan === 'solo' ? 0 : 1);
    assert.equal(await page.getByRole('button', { name: 'Companion', exact: true }).count(), plan === 'legacy' ? 1 : 0);
    await page.goto('http://127.0.0.1:3028/settings/backups');
    await page.getByText(plan === 'solo' ? 'Geplante Workflow-Exporte sind im Agency-Tarif enthalten.' : 'Konfiguriere automatische Backups deiner Workflows auf Google Drive', { exact: false }).waitFor();
    assert.equal(calls.some(call => call.path === '/backups/settings'), plan !== 'solo');
    if (plan !== 'legacy') assert(!calls.some(call => call.path.includes('/companion/')));
    assert.deepEqual(unknown, []);
    console.log(`${plan}: login -> authenticated license -> limit -> import/companion/Drive UI and request gates PASS`);
    await context.close();
  }
} finally { await browser?.close(); server.kill(); }
