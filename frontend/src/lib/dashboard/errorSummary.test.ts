import { describe, expect, it } from 'vitest';
import { formatErrorCount, pickLatestError, summarizeErrorPatterns } from './errorSummary';

const p = (errorMessage: string, count: number, lastOccurred: string, affectedWorkflows = ['WF']) => ({
  errorMessage, count, lastOccurred, affectedWorkflows,
});

describe('summarizeErrorPatterns', () => {
  it('sums counts and keeps the newest error', () => {
    const s = summarizeErrorPatterns([
      p('401 Unauthorized', 3, '2026-11-13T10:00:00Z', ['Rechnungen']),
      p('Timeout', 2, '2026-11-13T12:00:00Z', ['Leads']),
    ]);
    expect(s.count).toBe(5);
    expect(s.capped).toBe(false);
    expect(s.latest).toEqual({ errorMessage: 'Timeout', occurredAt: '2026-11-13T12:00:00Z', workflows: ['Leads'] });
  });

  it('marks the endpoint cap as a lower bound', () => {
    const s = summarizeErrorPatterns([p('x', 100, '2026-11-13T10:00:00Z')]);
    expect(formatErrorCount(s)).toBe('100+');
  });

  it('treats missing data as unknown, not zero', () => {
    expect(formatErrorCount(summarizeErrorPatterns(undefined))).toBe('–');
    expect(formatErrorCount(summarizeErrorPatterns([]))).toBe('0');
  });
});

describe('pickLatestError', () => {
  it('returns the instance with the newest error', () => {
    const summaries = {
      a: summarizeErrorPatterns([p('A', 1, '2026-11-13T09:00:00Z')]),
      b: summarizeErrorPatterns([p('B', 1, '2026-11-13T11:00:00Z')]),
      c: summarizeErrorPatterns([]),
    };
    const best = pickLatestError([{ id: 'a' }, { id: 'b' }, { id: 'c' }], summaries);
    expect(best?.instance.id).toBe('b');
    expect(best?.latest.errorMessage).toBe('B');
  });

  it('returns null without errors', () => {
    expect(pickLatestError([{ id: 'a' }], { a: summarizeErrorPatterns([]) })).toBeNull();
  });
});
