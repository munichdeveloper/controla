import { describe, expect, it } from 'vitest';
import { isAuthRoute } from './AppShell';

describe('isAuthRoute', () => {
  it('hides the app chrome on auth pages', () => {
    expect(isAuthRoute('/login')).toBe(true);
    expect(isAuthRoute('/forgot-password')).toBe(true);
    expect(isAuthRoute('/reset-password')).toBe(true);
    expect(isAuthRoute('/reset-password/abc')).toBe(true);
  });

  it('keeps the app chrome everywhere else', () => {
    expect(isAuthRoute('/')).toBe(false);
    expect(isAuthRoute('/instances/1')).toBe(false);
    expect(isAuthRoute('/settings/alerts')).toBe(false);
    expect(isAuthRoute('/login-help')).toBe(false);
    expect(isAuthRoute(null)).toBe(false);
  });
});
