import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { formatDate, formatRelativeTime } from './index';

// Fixed clock and zone so the German output is reproducible, including DST.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Berlin';
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
  process.env.TZ = originalTz;
});

describe('formatDate', () => {
  it('formats in German style in Europe/Berlin (winter time, UTC+1)', () => {
    expect(formatDate('2026-11-04T10:00:00Z')).toBe('04.11.2026 11:00');
  });

  it('formats summer time (UTC+2)', () => {
    expect(formatDate('2026-07-01T22:30:00Z')).toBe('02.07.2026 00:30');
  });

  it('handles the DST switch nights', () => {
    expect(formatDate('2026-03-29T00:59:00Z')).toBe('29.03.2026 01:59');
    expect(formatDate('2026-03-29T01:00:00Z')).toBe('29.03.2026 03:00');
    expect(formatDate('2026-10-25T00:30:00Z')).toBe('25.10.2026 02:30');
    expect(formatDate('2026-10-25T01:30:00Z')).toBe('25.10.2026 02:30');
  });

  it('returns Nie for empty input and Ungültig for invalid input', () => {
    expect(formatDate(null)).toBe('Nie');
    expect(formatDate(undefined)).toBe('Nie');
    expect(formatDate('')).toBe('Nie');
    expect(formatDate('kein Datum')).toBe('Ungültig');
  });
});

describe('formatRelativeTime', () => {
  it('describes the past in German', () => {
    expect(formatRelativeTime('2026-11-14T11:59:30Z')).toBe('gerade eben');
    expect(formatRelativeTime('2026-11-14T11:59:00Z')).toBe('vor 1 Minute');
    expect(formatRelativeTime('2026-11-14T11:55:00Z')).toBe('vor 5 Minuten');
    expect(formatRelativeTime('2026-11-14T09:00:00Z')).toBe('vor etwa 3 Stunden');
    expect(formatRelativeTime('2026-11-10T12:00:00Z')).toBe('vor 4 Tagen');
    expect(formatRelativeTime('2026-08-14T12:00:00Z')).toBe('vor 3 Monaten');
  });

  it('describes the future in German', () => {
    expect(formatRelativeTime('2026-11-14T12:10:00Z')).toBe('in 10 Minuten');
    expect(formatRelativeTime('2026-11-16T12:00:00Z')).toBe('in 2 Tagen');
  });

  it('returns Nie for empty input and Ungültig for invalid input', () => {
    expect(formatRelativeTime(null)).toBe('Nie');
    expect(formatRelativeTime('kein Datum')).toBe('Ungültig');
  });
});
