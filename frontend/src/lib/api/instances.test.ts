import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveInstance, deleteInstance, getInstances, restoreInstance } from './index';

afterEach(() => vi.unstubAllGlobals());

describe('instance lifecycle API', () => {
  it('requests archives only explicitly and sends lifecycle actions', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json({})));
    vi.stubGlobal('fetch', fetch);
    await getInstances();
    await getInstances(true);
    await archiveInstance('inst_a');
    await restoreInstance('inst_a');
    expect(fetch.mock.calls.map(call => [call[0], call[1].method || 'GET'])).toEqual([
      ['/api/instances', 'GET'], ['/api/instances?includeArchived=true', 'GET'],
      ['/api/instances/inst_a/archive', 'POST'], ['/api/instances/inst_a/restore', 'POST'],
    ]);
  });

  it.each([false, true])('passes deleteExternalData=%s and accepts the empty 204 response', async external => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await expect(external ? deleteInstance('inst_a', true) : deleteInstance('inst_a')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/instances/inst_a', expect.objectContaining({
      method: 'DELETE', body: JSON.stringify({ deleteExternalData: external }),
    }));
  });

  it('preserves conflict codes and shows the slot release time', async () => {
    const availableAt = '2026-11-14T16:30:00Z';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      code: 'instance_slot_locked', message: 'Platz gesperrt.', availableAt,
    }, { status: 409 })));
    await expect(archiveInstance('inst_a')).rejects.toMatchObject({
      status: 409, code: 'instance_slot_locked', availableAt,
      message: expect.stringContaining('Platz wieder frei ab'),
    });
  });
});
