import { describe, expect, it } from 'vitest';
import { getVersionUpdateState } from './index';

describe('getVersionUpdateState', () => {
  it('reports an update for 2.48.x against 3.x', () => {
    expect(getVersionUpdateState('2.48.4', '3.3.0')).toBe('update-available');
  });

  it('reports up-to-date for equal versions', () => {
    expect(getVersionUpdateState('3.3.0', '3.3.0')).toBe('up-to-date');
  });

  it('returns null for unknown latest version', () => {
    expect(getVersionUpdateState('2.48.4', 'unknown')).toBeNull();
  });
});
