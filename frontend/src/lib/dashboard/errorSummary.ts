import type { ErrorPattern } from '../api';

/**
 * The error-pattern endpoint aggregates at most this many failed executions
 * (n8n API page size with execution data). A sum at the cap means "at least".
 */
export const ERROR_PATTERN_CAP = 100;

export interface InstanceErrorSummary {
  /** Failed executions in the window; null when unknown (not loaded, offline, failed). */
  count: number | null;
  /** True when the count reached the endpoint's cap and may be higher. */
  capped: boolean;
  /** Most recent error in the window, if any. */
  latest: { errorMessage: string; occurredAt: string; workflows: string[] } | null;
}

export function summarizeErrorPatterns(patterns: ErrorPattern[] | undefined | null): InstanceErrorSummary {
  if (!patterns) return { count: null, capped: false, latest: null };
  let count = 0;
  let latest: InstanceErrorSummary['latest'] = null;
  for (const p of patterns) {
    count += p.count;
    if (!latest || new Date(p.lastOccurred).getTime() > new Date(latest.occurredAt).getTime()) {
      latest = { errorMessage: p.errorMessage, occurredAt: p.lastOccurred, workflows: p.affectedWorkflows.filter(Boolean) };
    }
  }
  return { count, capped: count >= ERROR_PATTERN_CAP, latest };
}

export function formatErrorCount(summary: InstanceErrorSummary | undefined): string {
  if (!summary || summary.count === null) return '–';
  return summary.capped ? `${ERROR_PATTERN_CAP}+` : String(summary.count);
}

/** Instance whose most recent error is the newest across all summaries. */
export function pickLatestError<T extends { id: string }>(
  instances: T[],
  summaries: Record<string, InstanceErrorSummary>,
): { instance: T; latest: NonNullable<InstanceErrorSummary['latest']> } | null {
  let best: { instance: T; latest: NonNullable<InstanceErrorSummary['latest']> } | null = null;
  for (const instance of instances) {
    const latest = summaries[instance.id]?.latest;
    if (latest && (!best || new Date(latest.occurredAt) > new Date(best.latest.occurredAt))) {
      best = { instance, latest };
    }
  }
  return best;
}
