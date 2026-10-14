import type { CompanionStatus } from '../types';

/** Minimum companion version offering the diagnostics routes. */
export const MIN_DIAGNOSTICS_COMPANION_VERSION = '0.2.0';

/** Companion capabilities (GET /api/capabilities of the companion). */
export const COMPANION_CAPABILITIES = {
  SERVICES: 'diagnostics.services',
  CONTAINER: 'diagnostics.container',
  LOGS: 'diagnostics.logs',
  STATS: 'diagnostics.stats',
  EVENTS: 'diagnostics.events',
  HOST: 'diagnostics.host',
} as const;

/**
 * hidden       – backend lacks the feature: render nothing
 * loading      – companion status not loaded yet
 * needs-setup  – no companion configured for the instance
 * unreachable  – companion configured but not reachable
 * needs-update – companion reachable but lacks a required capability
 * ready        – render the control
 */
export type CompanionSectionState = 'hidden' | 'loading' | 'needs-setup' | 'unreachable' | 'needs-update' | 'ready';

/**
 * The single place that decides whether a companion diagnostics control may
 * be rendered: (1) backend feature key, (2) companion configured and
 * reachable, (3) companion capability present.
 */
export function companionSectionState(
  featureEnabled: boolean,
  status: CompanionStatus | null | undefined,
  requiredCapabilities: readonly string[]
): CompanionSectionState {
  if (!featureEnabled) return 'hidden';
  if (!status) return 'loading';
  if (!status.configured) return 'needs-setup';
  if (!status.connected) return 'unreachable';
  const available = status.capabilities ?? [];
  return requiredCapabilities.every((capability) => available.includes(capability)) ? 'ready' : 'needs-update';
}

/** Most restrictive state of several sections (for a shared notice). */
export function worstState(states: CompanionSectionState[]): CompanionSectionState {
  const order: CompanionSectionState[] = ['hidden', 'ready', 'loading', 'needs-update', 'unreachable', 'needs-setup'];
  const visible = states.filter((s) => s !== 'hidden');
  if (visible.length === 0) return 'hidden';
  return visible.reduce((worst, s) => (order.indexOf(s) > order.indexOf(worst) ? s : worst), visible[0]);
}
