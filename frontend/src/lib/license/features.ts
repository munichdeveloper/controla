/**
 * Feature keys reported by GET /api/license. A key is present only when the
 * connected backend contains the endpoints behind it (ADR-002); a missing key
 * means the UI must not render the control.
 */
export const FEATURES = {
  /** Community: GET /instances/{id}/diagnostics */
  DIAGNOSTICS_REPORT: 'diagnostics.report',
  /** Premium: companion diagnostics – services + container details */
  COMPANION_DIAG_CONTAINER: 'companion.diagnostics.container',
  /** Premium: companion diagnostics – logs + download */
  COMPANION_DIAG_LOGS: 'companion.diagnostics.logs',
  /** Premium: companion diagnostics – resources (stats, host) */
  COMPANION_DIAG_STATS: 'companion.diagnostics.stats',
  /** Premium: companion diagnostics – Docker events */
  COMPANION_DIAG_EVENTS: 'companion.diagnostics.events',
  /** Premium: companion diagnostics – support bundle */
  COMPANION_DIAG_BUNDLE: 'companion.diagnostics.bundle',
  /** Premium: diagnostic snapshots of incidents */
  COMPANION_DIAG_SNAPSHOTS: 'companion.diagnostics.snapshots',
  /** Premium: alerts for container events (OOM, crash loop, unhealthy) */
  ALERT_CONTAINER_EVENTS: 'alert.container_events',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];
