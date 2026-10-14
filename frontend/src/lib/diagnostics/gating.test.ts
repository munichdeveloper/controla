import { describe, expect, it } from 'vitest';
import type { CompanionStatus } from '../types';
import { COMPANION_CAPABILITIES as CAP, companionSectionState, worstState } from './gating';

function status(overrides: Partial<CompanionStatus> = {}): CompanionStatus {
  return {
    configured: true,
    connected: true,
    containerStatus: 'running',
    pinnedVersion: '1.70.0',
    runningVersion: '1.70.0',
    updating: false,
    companionVersion: '0.2.0',
    capabilities: [CAP.SERVICES, CAP.CONTAINER, CAP.LOGS, CAP.STATS, CAP.EVENTS, CAP.HOST],
    ...overrides,
  };
}

describe('companionSectionState', () => {
  // One row per combination of the compatibility matrix (plan, section 8).
  it.each([
    ['backend without the feature key', false, status(), 'hidden'],
    ['status not loaded yet', true, undefined, 'loading'],
    ['no companion configured', true, status({ configured: false, connected: false }), 'needs-setup'],
    ['companion unreachable', true, status({ connected: false }), 'unreachable'],
    ['companion 0.1.x without capabilities', true, status({ companionVersion: null, capabilities: undefined }), 'needs-update'],
    ['companion lacks the required capability', true, status({ capabilities: [CAP.SERVICES] }), 'needs-update'],
    ['everything available', true, status(), 'ready'],
  ] as const)('%s → %s', (_label, featureEnabled, companionStatus, expected) => {
    expect(companionSectionState(featureEnabled, companionStatus, [CAP.SERVICES, CAP.LOGS])).toBe(expected);
  });

  it('never renders a control when the key is missing, whatever the companion state', () => {
    for (const s of [undefined, status(), status({ configured: false }), status({ connected: false })]) {
      expect(companionSectionState(false, s, [CAP.LOGS])).toBe('hidden');
    }
  });
});

describe('worstState', () => {
  it('ignores hidden sections and picks the most restrictive one', () => {
    expect(worstState(['hidden', 'hidden'])).toBe('hidden');
    expect(worstState(['ready', 'hidden'])).toBe('ready');
    expect(worstState(['ready', 'needs-update'])).toBe('needs-update');
    expect(worstState(['needs-update', 'unreachable', 'ready'])).toBe('unreachable');
    expect(worstState(['unreachable', 'needs-setup'])).toBe('needs-setup');
  });
});
