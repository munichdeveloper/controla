import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLicense } from '@/lib/license/LicenseContext';
import LoginPage from './page';

vi.mock('@/lib/license/LicenseContext', () => ({ useLicense: vi.fn() }));
vi.mock('@/lib/auth/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => createElement('a', props, children),
}));
vi.mock('@/components/Skeleton', () => ({ Skeleton: () => createElement('div') }));

beforeEach(() => {
  vi.mocked(useLicense).mockReturnValue({
    license: null,
    loading: true,
    error: false,
    isFeatureEnabled: () => false,
    isPremium: false,
    maxInstances: 3,
  });
});

describe('login HTML before hydration', () => {
  it('cannot submit credentials before JavaScript and the license are ready', () => {
    const html = renderToStaticMarkup(createElement(LoginPage));

    expect(html).toContain('Lizenz wird abgerufen...');
    expect(html).not.toContain('<form');
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*disabled=""/);
  });

  it('keeps credentials outside a form after a license failure', () => {
    vi.mocked(useLicense).mockReturnValue({ ...useLicense(), loading: false, error: true });
    const html = renderToStaticMarkup(createElement(LoginPage));

    expect(html).not.toContain('<form');
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).not.toContain('Lizenz wird abgerufen...');
    expect(html).toContain('Keine Verbindung zur API möglich.');
  });

  it('enables a POST form after the license loads, avoiding credentials in a GET URL', () => {
    vi.mocked(useLicense).mockReturnValue({
      ...useLicense(),
      loading: false,
      license: { edition: 'Community Edition', maxInstances: 3, features: {} },
    });
    const html = renderToStaticMarkup(createElement(LoginPage));

    expect(html).toContain('<form method="post">');
    expect(html).not.toMatch(/<fieldset[^>]*disabled/);
    expect(html).toMatch(/<button type="submit" class=/);
    expect(html).not.toContain('Lizenz wird abgerufen...');
  });
});
