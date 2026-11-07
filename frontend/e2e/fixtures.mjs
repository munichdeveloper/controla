import { test as base, expect } from '@playwright/test';

export const password = 'browser-fixture-password';
const contractErrors = new WeakMap();
export const demo = {
  id: 'demo', name: 'Production n8n', baseUrl: 'https://n8n.example.com',
  status: 'online', version: '1.70.0', latestVersion: '1.71.0',
  lastSeenAt: '2026-11-04T10:00:00Z', createdAt: '2026-09-01T10:00:00Z',
};

// These are contract fixtures, not a connection to the private Premium backend.
export async function mockApi(page, options = {}) {
  const premium = options.edition === 'Hosted Ops';
  const state = {
    edition: premium ? 'Hosted Ops' : 'Community Edition',
    features: options.features ?? {
      'diagnostics.report': true,
      'alert.workflow_error': premium,
      'alert.invalid_api_key': premium,
    },
    instances: [{ ...demo }],
    alerts: { channels: { email: { address: 'alerts@example.com' } }, events: { instanceOffline: true, workflowError: false, invalidApiKey: false } },
    backups: { enabled: true, googleDriveFolderId: 'test-folder', intervalHours: 24 },
    calls: [], errors: [], failSave: false, failInstances: false,
  };
  contractErrors.set(page, state.errors);
  await page.context().route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();
    const token = request.headers().authorization?.replace('Bearer token-', '') || '';
    const username = token ? decodeURIComponent(token) : '';
    state.calls.push({ method, path, username, data: request.postDataJSON() });
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    const text = (body, status) => route.fulfill({ status, body });
    if (path === '/license') {
      if (options.licenseGate) await options.licenseGate;
      if (options.licenseFailure) return text('API unavailable', 503);
      return reply({ edition: state.edition, maxInstances: premium ? -1 : 3, features: state.features });
    }
    if (path === '/auth/login') {
      const input = request.postDataJSON();
      if (input.password !== password) return text('Ungültige Anmeldedaten', 401);
      return reply({ token: `token-${encodeURIComponent(input.username)}`, username: input.username, email: input.username, role: 'ADMIN' });
    }
    if (path === '/auth/validate-reset-token') return reply({}, url.searchParams.get('token') === 'valid-token' ? 200 : 400);
    if (path === '/auth/reset-password') return reply({ message: 'ok' });
    if (path === '/auth/request-password-reset') return reply({ message: 'ok' });
    if (!username) return text('Session expired', 401);
    if (path === '/auth/me') return reply({ token: `token-${token}`, username, email: username, role: 'ADMIN' });
    if (path === '/version') return reply({ version: '1.2.0' });
    if (path === '/instances' && method === 'GET') {
      if (options.instancesGate) await options.instancesGate;
      if (state.failInstances) return text('Simulierter Ladefehler', 503);
      return reply(state.instances.map(item => ({ ...item, name: options.scopedInstances ? `Instanz für ${username}` : item.name })));
    }
    if (path === '/instances' && method === 'POST') {
      const input = request.postDataJSON();
      const created = { ...demo, ...input, id: 'created', name: `Gespeichert: ${input.name}` };
      state.instances.push(created);
      return reply(created);
    }
    if (/^\/instances\/[^/]+$/.test(path)) {
      const instance = state.instances.find(item => path.endsWith(`/${item.id}`));
      if (!instance) return text('Not found', 404);
      if (method === 'PUT') Object.assign(instance, request.postDataJSON(), { name: `Gespeichert: ${request.postDataJSON().name}` });
      return reply(instance);
    }
    if (path.endsWith('/workflows')) return reply([{ id: 'wf1', name: 'Bestellung verarbeiten', active: true, lastRunAt: null, lastErrorAt: null }]);
    if (path === '/alerts/settings') {
      if (method === 'PUT') {
        if (state.failSave) return text('Simulierter Speicherfehler', 503);
        state.alerts = request.postDataJSON();
        if (state.alerts.channels.email) state.alerts.channels.email.address = state.alerts.channels.email.address.toLowerCase();
      }
      return reply(state.alerts);
    }
    if (path === '/backups/settings') {
      if (method === 'PUT') {
        state.backups = request.postDataJSON();
        state.backups.googleDriveFolderId = state.backups.googleDriveFolderId.trim();
      }
      return reply(state.backups);
    }
    if (path === '/premium/instances/backups') return reply({ demo: '2026-11-04T10:00:00Z' });
    if (path === '/premium/instances/demo/backup') return reply({ lastBackupAt: '2026-11-04T10:00:00Z' });
    if (path === '/premium/companion/demo/status') return reply({ configured: false, connected: false, capabilities: [] });
    state.errors.push(`${method} ${path}`);
    return text(`Unexpected fixture API: ${path}`, 404);
  });
  return state;
}

export async function seedSession(page, username = 'admin') {
  await page.addInitScript(user => localStorage.setItem('token', `token-${encodeURIComponent(user)}`), username);
}

export async function login(page, username = 'admin') {
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
  if (username !== 'admin') await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Instanz-Übersicht' })).toBeVisible();
}

export const test = base.extend({
  browserSafety: [async ({ page }, runTest) => {
    const errors = [], credentialGets = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /hydration|Minified React error|server rendered HTML/i.test(message.text())) errors.push(message.text());
    });
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() === 'GET' && (url.searchParams.has('password') || url.searchParams.has('username'))) credentialGets.push(url.pathname);
    });
    await runTest();
    expect(errors, 'browser runtime/hydration errors').toEqual([]);
    expect(credentialGets, 'credentials sent via GET').toEqual([]);
    expect(contractErrors.get(page) || [], 'unexpected backend calls').toEqual([]);
  }, { auto: true }],
});
export { expect };
