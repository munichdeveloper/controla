import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLicenseInfo } from './index';

afterEach(() => vi.unstubAllGlobals());

describe('getLicenseInfo', () => {
  it('loads the public license without a login token or cached response', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ edition: 'Community Edition' }));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();

    await expect(getLicenseInfo(controller.signal)).resolves.toEqual({ edition: 'Community Edition' });
    expect(fetch).toHaveBeenCalledWith('/api/license', {
      cache: 'no-store',
      signal: controller.signal,
    });
  });

  it('rejects HTTP errors from the API or its proxy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502 })));
    await expect(getLicenseInfo(new AbortController().signal)).rejects.toMatchObject({ status: 502 });
  });

  it('rejects network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(getLicenseInfo(new AbortController().signal)).rejects.toThrow('Failed to fetch');
  });

  it.each([
    new Response('<html>Proxy fallback</html>'),
    Response.json({ status: 'ok' }),
  ])('rejects successful responses that do not identify the API', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(getLicenseInfo(new AbortController().signal)).rejects.toThrow();
  });
});
