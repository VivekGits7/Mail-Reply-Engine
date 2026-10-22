import { describe, expect, it } from 'vitest';
import { emptyToNull, formatBytes, formatDate, formatRelative, fromLocalDateTimeInput, humanize, toLocalDateTimeInput } from './utility';

describe('utility', () => {
  it('reads date-only strings as local dates, not UTC midnight', () => {
    expect(formatDate('2026-11-03')).toBe('3 Nov 2026');
    expect(formatDate(null)).toBe('—');
  });

  it('describes times relative to now', () => {
    const now = new Date('2026-10-22T10:00:00Z').getTime();
    expect(formatRelative('2026-10-24T10:00:00Z', now)).toBe('in 2 days');
    expect(formatRelative('2026-10-22T07:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelative('2026-10-22T09:59:50Z', now)).toBe('just now');
    expect(formatRelative(undefined, now)).toBe('—');
  });

  it('turns backend keys into readable words', () => {
    expect(humanize('ready_for_signoff')).toBe('Ready for signoff');
    expect(humanize('')).toBe('—');
  });

  it('round trips datetime-local values through ISO strings', () => {
    const local = toLocalDateTimeInput('2026-11-16T10:00:00+05:30');
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(fromLocalDateTimeInput(local)).toISOString()).toBe('2026-11-16T04:30:00.000Z');
  });

  it('formats sizes and blanks', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(20480)).toBe('20.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
    expect(emptyToNull({ name: '', code: 'L4' })).toEqual({ name: null, code: 'L4' });
  });
});
