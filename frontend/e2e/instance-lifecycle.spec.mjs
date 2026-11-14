import { test, expect, mockApi, seedSession } from './fixtures.mjs';

async function archive(page) {
  await page.getByRole('button', { name: 'Aus Ansicht entfernen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Die Überwachung wird pausiert.');
  await expect(dialog).toContainText('im Archiv wiederherstellen');
  await dialog.getByRole('button', { name: 'Aus Ansicht entfernen', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByText('Archiv (1)', { exact: true }).click();
  await expect(page.getByText(/Platz wieder frei ab \d{2}:\d{2}/)).toBeVisible();
}

test('archive confirmation can be cancelled, then archived instances can be restored', async ({ page }) => {
  const api = await mockApi(page);
  await seedSession(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Aus Ansicht entfernen', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
  expect(api.calls.some(call => call.path.endsWith('/archive'))).toBe(false);
  await archive(page);
  await expect(page.getByRole('link', { name: 'Production n8n', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Production n8n', exact: true })).toBeVisible();
  expect(api.calls.some(call => call.path === '/instances/demo/restore' && call.method === 'POST')).toBe(true);
});

for (const external of [false, true]) {
  test(`danger dialog requires exact name and passes deleteExternalData=${external}`, async ({ page }) => {
    const api = await mockApi(page);
    await seedSession(page);
    await page.goto('/');
    await archive(page);
    await page.getByRole('button', { name: 'Endgültig löschen', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const confirm = dialog.getByRole('button', { name: 'Endgültig löschen', exact: true });
    await expect(dialog).toContainText('gespeicherter API-Key');
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Instanznamen zur Bestätigung eingeben').fill('production n8n');
    await expect(confirm).toBeDisabled();
    expect(api.calls.some(call => call.method === 'DELETE')).toBe(false);
    if (external) await dialog.getByRole('checkbox').check();
    else await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await dialog.getByLabel('Instanznamen zur Bestätigung eingeben').fill('Production n8n');
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Keine archivierten Instanzen.', { exact: true })).toBeVisible();
    expect(api.calls.filter(call => call.method === 'DELETE')).toEqual([
      expect.objectContaining({ path: '/instances/demo', data: { deleteExternalData: external } }),
    ]);
  });
}

test('restore conflicts and delete failures stay visible without losing the archive', async ({ page }) => {
  const api = await mockApi(page);
  await seedSession(page);
  await page.goto('/');
  await archive(page);
  api.restoreConflict = true;
  await page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Kein Instanzplatz frei.');
  api.failDelete = true;
  await page.getByRole('button', { name: 'Endgültig löschen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Instanznamen zur Bestätigung eingeben').fill('Production n8n');
  await dialog.getByRole('button', { name: 'Endgültig löschen', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Löschen fehlgeschlagen');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('button', { name: 'Wiederherstellen', exact: true })).toBeVisible();
});

test('missing feature keys hide lifecycle controls and do not request archives', async ({ page }) => {
  const api = await mockApi(page, { features: {} });
  await seedSession(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Production n8n', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aus Ansicht entfernen' })).toHaveCount(0);
  await expect(page.getByText(/^Archiv \(/)).toHaveCount(0);
  expect(api.calls.filter(call => call.path === '/instances').every(call => !call.query.includes('includeArchived'))).toBe(true);
});
