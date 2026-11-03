import { describe, expect, it } from 'vitest';
import { berlinLocalToInstant, parseDate } from './date.ts';

const iso = (d: Date | null) => d?.toISOString() ?? null;

describe('berlinLocalToInstant', () => {
  it('converts winter time (UTC+1)', () => {
    expect(iso(berlinLocalToInstant(2026, 1, 5, 12, 0, 0))).toBe(
      '2026-01-05T11:00:00.000Z',
    );
  });

  it('converts summer time (UTC+2)', () => {
    expect(iso(berlinLocalToInstant(2026, 7, 1, 12, 0, 0))).toBe(
      '2026-07-01T10:00:00.000Z',
    );
  });

  it('handles the day the clocks go forward', () => {
    // 2026-03-29: at 02:00 the clock jumps to 03:00. 12:00 lies after it (UTC+2).
    expect(iso(berlinLocalToInstant(2026, 3, 29, 12, 0, 0))).toBe(
      '2026-03-29T10:00:00.000Z',
    );
    // 01:00 lies before it (UTC+1).
    expect(iso(berlinLocalToInstant(2026, 3, 29, 1, 0, 0))).toBe(
      '2026-03-29T00:00:00.000Z',
    );
  });

  it('handles the day the clocks go back', () => {
    // 2026-10-25: at 03:00 the clock jumps back to 02:00. 12:00 lies after it (UTC+1).
    expect(iso(berlinLocalToInstant(2026, 10, 25, 12, 0, 0))).toBe(
      '2026-10-25T11:00:00.000Z',
    );
  });
});

describe('parseDate', () => {
  it('reads a plain date as 12:00 Berlin time', () => {
    expect(iso(parseDate('2026-01-05'))).toBe('2026-01-05T11:00:00.000Z');
    expect(iso(parseDate('2026-07-01'))).toBe('2026-07-01T10:00:00.000Z');
  });

  it('reads a date with a time and no zone as Berlin local time', () => {
    expect(iso(parseDate('2026-07-01 09:30'))).toBe('2026-07-01T07:30:00.000Z');
    expect(iso(parseDate('2026-07-01T09:30'))).toBe('2026-07-01T07:30:00.000Z');
    expect(iso(parseDate('2026-07-01T09:30:15'))).toBe(
      '2026-07-01T07:30:15.000Z',
    );
  });

  it('respects a given zone', () => {
    expect(iso(parseDate('2026-07-01T09:30:00+02:00'))).toBe(
      '2026-07-01T07:30:00.000Z',
    );
    expect(iso(parseDate('2026-07-01T07:30:00Z'))).toBe(
      '2026-07-01T07:30:00.000Z',
    );
  });

  it('takes a Date object unchanged', () => {
    const d = new Date('2026-02-03T04:05:06Z');
    expect(parseDate(d)?.getTime()).toBe(d.getTime());
  });

  it('returns null for invalid input', () => {
    expect(parseDate('morgen')).toBeNull();
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('2026-01-05T25:00')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate(20260105)).toBeNull();
    expect(parseDate(new Date('kaputt'))).toBeNull();
  });
});
