import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLicense } from '@/lib/license/LicenseContext';
import { InstanceArchive, InstanceLifecycleActions, LifecycleDialog } from './InstanceLifecycle';
import type { InstanceSummary } from '@/lib/types';

vi.mock('@/lib/license/LicenseContext', () => ({ useLicense: vi.fn() }));
const instance: InstanceSummary = { id: 'inst_a', name: 'Production', baseUrl: 'https://n8n.example.com', status: 'online', version: '1', lastSeenAt: '' };

function features(keys: string[]) {
  vi.mocked(useLicense).mockReturnValue({
    license: null, loading: false, error: false, isPremium: false, showLockedFeatures: true, maxInstances: 3,
    isFeatureEnabled: key => keys.includes(key),
  });
}

function renderActions(archived = false) {
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() },
    createElement(InstanceLifecycleActions, { instance: { ...instance, archivedAt: archived ? '2026-11-14T10:00:00Z' : null } })));
}

beforeEach(() => features([]));

describe('instance lifecycle controls', () => {
  it('renders no actions or archive for missing feature keys', () => {
    expect(renderActions()).not.toContain('<button');
    expect(renderActions(true)).not.toContain('<button');
    expect(renderToStaticMarkup(createElement(InstanceArchive, { instances: [] }))).toBe('');
  });

  it('gates archive/restore and deletion independently', () => {
    features(['instances.archive']);
    expect(renderActions()).toContain('Aus Ansicht entfernen');
    expect(renderActions(true)).toContain('Wiederherstellen');
    expect(renderActions(true)).not.toContain('Endgültig löschen');
    features(['instances.delete']);
    expect(renderActions()).not.toContain('Aus Ansicht entfernen');
    expect(renderActions(true)).not.toContain('Wiederherstellen');
    expect(renderActions(true)).toContain('Endgültig löschen');
  });

  it('explains paused monitoring and restoration in the archive dialog', () => {
    const html = renderToStaticMarkup(createElement(LifecycleDialog, {
      instance, action: 'archive', pending: false, onClose: vi.fn(), onConfirm: vi.fn(),
    }));
    expect(html).toContain('Die Überwachung wird pausiert.');
    expect(html).toContain('im Archiv wiederherstellen');
  });

  it('requires a name confirmation and defaults external deletion to off', () => {
    const html = renderToStaticMarkup(createElement(LifecycleDialog, {
      instance, action: 'delete', pending: false, onClose: vi.fn(), onConfirm: vi.fn(),
    }));
    expect(html).toContain('Instanzkonfiguration und gespeicherter API-Key');
    expect(html).toContain('Instanznamen zur Bestätigung eingeben');
    expect(html).toContain('Externe Daten (z. B. Backups) ebenfalls löschen');
    expect(html).not.toContain('checked=');
    expect(html).toMatch(/<button type="submit" disabled=""/);
  });
});
