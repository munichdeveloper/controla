import { test, expect, mockApi, seedSession, login, password } from './fixtures.mjs';

test('credentials cannot be submitted before hydration', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('http://127.0.0.1:3027/login');
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('#password')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeDisabled();
    await page.keyboard.press('Enter');
    expect(requests.some(url => /[?&](username|password)=/.test(url))).toBe(false);
  } finally {
    await context.close();
  }
});

for (const edition of ['Community Edition', 'Hosted Ops']) {
  test.describe(edition, () => {
    test('slow license lookup gates login and then accepts a POST', async ({ page }) => {
      let releaseLicense;
      const licenseGate = new Promise(resolve => { releaseLicense = resolve; });
      const api = await mockApi(page, { edition, licenseGate });
      await page.goto('/login');
      await expect(page.locator('form')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeDisabled();
      releaseLicense();
      await login(page, edition === 'Hosted Ops' ? 'first@example.com' : 'admin');
      expect(api.calls.filter(call => call.path === '/auth/login').map(call => call.method)).toEqual(['POST']);
      await expect(page.getByRole('link', { name: 'Production n8n', exact: true })).toBeVisible();
    });

    test('failed license lookup keeps credentials outside a form', async ({ page }) => {
      await mockApi(page, { edition, licenseFailure: true });
      await page.goto('/login');
      await expect(page.getByRole('alert').filter({ hasText: 'Keine Verbindung zur API möglich.' })).toBeVisible();
      await expect(page.locator('form')).toHaveCount(0);
      await expect(page.locator('#password')).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeDisabled();
    });

    test('instance routes, client navigation, history and mutations retain session state', async ({ page }) => {
      const api = await mockApi(page, { edition });
      await seedSession(page);
      await page.goto('/');
      await expect(page.getByRole('link', { name: 'Production n8n', exact: true })).toBeVisible();
      await page.evaluate(() => { window.navigationMarker = 'same-document'; });
      await page.getByRole('link', { name: 'Production n8n', exact: true }).click();
      await expect(page).toHaveURL(/\/instances\/demo$/);
      await expect(page.getByRole('heading', { name: 'Production n8n', exact: true })).toBeVisible();
      await expect.poll(() => api.calls.some(call => call.path === '/instances/demo')).toBe(true);
      await page.getByRole('button', { name: 'Workflows', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Bestellung verarbeiten', exact: true })).toBeVisible();
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Instanzübersicht', exact: true })).toBeVisible();
      await page.goForward();
      await expect(page.getByRole('heading', { name: 'Production n8n', exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Alerts', exact: true }).click();
      await expect(page.locator('#email')).toHaveValue('alerts@example.com');
      expect(await page.evaluate(() => window.navigationMarker)).toBe('same-document');
      await page.getByRole('link', { name: 'Instanzen', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Production n8n', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '+ Instanz hinzufügen', exact: true }).click();
      await page.getByPlaceholder('Production n8n').fill('Neue Instanz');
      await page.getByPlaceholder('https://n8n.example.com').fill('https://new.example.com');
      await page.getByPlaceholder('n8n_api_...').fill('fixture-key');
      await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Gespeichert: Neue Instanz', exact: true })).toBeVisible();
      await page.locator('button[title="Instanz bearbeiten"]').first().click();
      await page.locator('form input[type="text"]').fill('Bearbeitet');
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Gespeichert: Bearbeitet', exact: true })).toBeVisible();
      await page.goto('/instances/demo');
      await expect(page.getByRole('heading', { name: 'Gespeichert: Bearbeitet', exact: true })).toBeVisible();
    });

    test('alert mutations refetch server values and show save errors', async ({ page }) => {
      const api = await mockApi(page, { edition });
      await seedSession(page);
      await page.goto('/settings/alerts');
      await expect(page.locator('#email')).toHaveValue('alerts@example.com');
      const before = api.calls.filter(call => call.path === '/alerts/settings' && call.method === 'GET').length;
      await page.locator('#email').fill('Changed@Example.com');
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page.locator('#email')).toHaveValue('changed@example.com');
      expect(api.calls.filter(call => call.path === '/alerts/settings' && call.method === 'GET').length).toBeGreaterThan(before);
      api.failSave = true;
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page.getByText('Fehler beim Speichern: Simulierter Speicherfehler', { exact: true })).toBeVisible();
    });

    test('missing feature keys hide diagnostics and disable unsupported alerts', async ({ page }) => {
      await mockApi(page, { edition, features: {} });
      await seedSession(page);
      await page.goto('/instances/demo');
      await expect(page.getByRole('heading', { name: 'Production n8n', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Diagnose', exact: true })).toHaveCount(0);
      await page.getByRole('link', { name: 'Alerts', exact: true }).click();
      await expect(page.locator('#email')).toHaveValue('alerts@example.com');
      if (edition === 'Community Edition') {
        // CE keeps unavailable alerts visible as an upgrade teaser.
        await expect(page.locator('#notifyOnWorkflowError')).toBeDisabled();
        await expect(page.locator('#notifyOnInvalidApiKey')).toBeDisabled();
      } else {
        // Hosted plans hide features that are not booked.
        await expect(page.locator('#notifyOnWorkflowError')).toHaveCount(0);
        await expect(page.locator('#notifyOnInvalidApiKey')).toHaveCount(0);
      }
    });

    test('backup controls follow edition and saved values are reloaded', async ({ page }) => {
      const api = await mockApi(page, { edition });
      await seedSession(page);
      await page.goto('/settings/backups');
      await expect(page.getByRole('heading', { name: 'Backups', exact: true })).toBeVisible();
      if (edition === 'Community Edition') {
        await expect(page.getByRole('heading', { name: 'Automatische Backups', exact: true })).toBeVisible();
        await expect(page.locator('#googleDriveFolderId')).toHaveCount(0);
        expect(api.calls.some(call => call.path === '/backups/settings')).toBe(false);
      } else {
        await expect(page.locator('#googleDriveFolderId')).toHaveValue('test-folder');
        const before = api.calls.filter(call => call.path === '/backups/settings' && call.method === 'GET').length;
        await page.locator('#googleDriveFolderId').fill('  changed-folder  ');
        await page.locator('#intervalHours').selectOption('1');
        await page.getByRole('button', { name: 'Speichern', exact: true }).click();
        await expect(page.locator('#googleDriveFolderId')).toHaveValue('changed-folder');
        expect(api.calls.filter(call => call.path === '/backups/settings' && call.method === 'GET').length).toBeGreaterThan(before);
      }
    });
  });
}

test('invalid credentials can be corrected, session survives reload and logout removes it', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
  await page.locator('#password').fill('wrong-fixture-password');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByText('Ungültige Anmeldedaten', { exact: true })).toBeVisible();
  await login(page);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Production n8n', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
});

test('switching users does not reuse private cached instance data', async ({ page }) => {
  await mockApi(page, { edition: 'Hosted Ops', scopedInstances: true });
  await page.goto('/login');
  await login(page, 'first@example.com');
  await expect(page.getByRole('link', { name: 'Instanz für first@example.com', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await login(page, 'second@example.com');
  await expect(page.getByText('Instanz für first@example.com', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Instanz für second@example.com', exact: true })).toBeVisible();
});

test('logout from an instance page also guards browser history', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  await login(page);
  await page.getByRole('link', { name: 'Production n8n', exact: true }).click();
  await expect(page).toHaveURL(/\/instances\/demo$/);
  await expect(page.getByRole('heading', { name: 'Production n8n', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Production n8n', exact: true })).toHaveCount(0);
});

test('dark mode persists across client navigation and reload', async ({ page }) => {
  await mockApi(page);
  await seedSession(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Production n8n', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zwischen hellem und dunklem Design wechseln', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('link', { name: 'Alerts', exact: true }).click();
  await expect(page.locator('#email')).toHaveValue('alerts@example.com');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('#email')).toHaveValue('alerts@example.com');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

for (const token of ['valid-token', 'invalid-token', null]) {
  test(`password reset with ${token || 'missing token'}`, async ({ page }) => {
    const api = await mockApi(page);
    await page.goto(`/reset-password${token ? `?token=${token}` : ''}`);
    if (token === 'valid-token') {
      await page.locator('#password').fill(password);
      await page.locator('#confirmPassword').fill(password);
      await page.getByRole('button', { name: 'Passwort zurücksetzen', exact: true }).click();
      await expect(page.getByText('✓ Passwort erfolgreich zurückgesetzt', { exact: true })).toBeVisible();
      expect(api.calls.find(call => call.path === '/auth/reset-password')?.method).toBe('POST');
    } else {
      await expect(page.getByText(token ? 'Der Link ist ungültig oder abgelaufen' : 'Kein Token gefunden', { exact: true })).toBeVisible();
      await expect(page.locator('#password')).toHaveCount(0);
    }
  });
}

test('password reset request confirms submission without exposing account existence', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/forgot-password');
  await page.locator('#email').fill('fixture@example.com');
  await page.getByRole('button', { name: 'Passwort zurücksetzen', exact: true }).click();
  await expect(page.getByText('✓ E-Mail gesendet', { exact: true })).toBeVisible();
  expect(api.calls.find(call => call.path === '/auth/request-password-reset')?.method).toBe('POST');
});
