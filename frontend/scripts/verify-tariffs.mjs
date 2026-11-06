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
  for (const plan of ['community', 'solo', 'agency', 'legacy']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const calls = [];
    const unknown = [];
    const detail = { id: 'demo', name: 'Fixture n8n', baseUrl: 'https://n8n.example.invalid', status: 'online', version: '1.0.0', latestVersion: '1.0.0', lastSeenAt: '2026-11-06T10:00:00Z', createdAt: '2026-11-01T10:00:00Z' };
    const instances = plan === 'community' ? [detail, { ...detail, id: 'second', name: 'Second instance' }, { ...detail, id: 'third', name: 'Third instance' }] : [detail];
    const automated = plan === 'agency' || plan === 'legacy';
    const user = { token: `token-${plan}`, username: plan === 'community' ? 'admin' : `${plan}@example.invalid`, email: `${plan}@example.invalid`, role: 'ADMIN' };
    await context.route('**/api/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname.slice(4);
      const authenticated = request.headers().authorization === `Bearer token-${plan}`;
      calls.push({ path, authenticated });
      const reply = body => route.fulfill({ json: body });
      if (path === '/license' && plan === 'community') return reply({ edition: 'Community Edition', maxInstances: -1, features: { 'diagnostics.report': true } });
      if (path === '/license') return reply({ edition: 'Premium Edition', ...(plan === 'legacy' ? {} : { tenantBound: authenticated }), maxInstances: authenticated && plan !== 'legacy' ? (plan === 'solo' ? 10 : 30) : -1,
        features: { 'diagnostics.report': true, ...(plan === 'legacy' ? {} : {
          'workflow.import': !authenticated || plan === 'agency', 'backup.scheduled': !authenticated || plan === 'agency', 'companion.manage': !authenticated,
        }) } });
      if (path === '/auth/login' || path === '/auth/me') return reply(user);
      if (!authenticated) return route.fulfill({ status: 401, body: 'unauthorized' });
      if (path === '/version') return reply({ version: 'fixture' });
      if (path === '/instances' && request.method() === 'POST') {
        assert.equal(plan, 'community');
        assert.equal(instances.length, 3);
        const created = { ...detail, ...request.postDataJSON(), id: 'fourth' };
        instances.push(created);
        return route.fulfill({ status: 201, json: created });
      }
      if (path === '/instances') return reply(instances);
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
    if (plan === 'community') {
      await page.locator('#username:disabled').waitFor();
      assert.equal(await page.locator('#username').inputValue(), 'admin');
    } else await page.locator('#username').fill(user.username);
    await page.locator('#password').fill('fixture-password');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.waitForURL('http://127.0.0.1:3028/');
    const expected = plan === 'legacy' || plan === 'community' ? 'Beliebig viele Instanzen überwachen' : `Bis zu ${plan === 'solo' ? 10 : 30} n8n-Instanzen überwachen`;
    await page.getByText(expected, { exact: false }).waitFor();
    assert(calls.some(call => call.path === '/license' && call.authenticated));
    if (plan === 'community') {
      await page.getByText('Third instance', { exact: true }).waitFor();
      await page.getByRole('button', { name: '+ Instanz hinzufügen', exact: true }).click();
      await page.getByPlaceholder('Production n8n', { exact: true }).fill('Fourth CE instance');
      await page.getByPlaceholder('https://n8n.example.com', { exact: true }).fill('https://fourth.example.invalid');
      await page.getByPlaceholder('n8n_api_...', { exact: true }).fill('fixture-key');
      await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
      await page.getByText('Fourth CE instance', { exact: true }).waitFor();
      assert.equal(instances.length, 4);
      await page.getByRole('button', { name: '+ Instanz hinzufügen', exact: true }).waitFor();
    }
    await page.goto('http://127.0.0.1:3028/instances/demo');
    await page.getByRole('button', { name: 'Workflows', exact: true }).click();
    await page.getByText('Fixture workflow', { exact: true }).waitFor();
    assert.equal(await page.locator('[title="Workflow importieren"]').count(), automated ? 1 : 0);
    assert.equal(await page.getByRole('button', { name: 'Companion', exact: true }).count(), plan === 'legacy' ? 1 : 0);
    await page.goto('http://127.0.0.1:3028/settings/backups');
    await page.getByText(automated ? 'Konfiguriere automatische Backups deiner Workflows auf Google Drive' : 'Geplante Workflow-Exporte sind im Agency-Tarif enthalten.', { exact: false }).waitFor();
    assert.equal(calls.some(call => call.path === '/backups/settings'), automated);
    if (plan !== 'legacy') assert(!calls.some(call => call.path.includes('/companion/')));
    assert.deepEqual(unknown, []);
    console.log(`${plan}: login -> authenticated license -> limit${plan === 'community' ? ' -> fourth instance' : ''} -> import/companion/Drive UI and request gates PASS`);
    await context.close();
  }
} finally { await browser?.close(); server.kill(); }
