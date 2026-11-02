import { describe, expect, it } from 'vitest';
import { berlinLocalToInstant, parseDate } from './date.ts';

const iso = (d: Date | null) => d?.toISOString() ?? null;

describe('berlinLocalToInstant', () => {
  it('rechnet Winterzeit (UTC+1) um', () => {
    expect(iso(berlinLocalToInstant(2026, 1, 5, 12, 0, 0))).toBe(
      '2026-01-05T11:00:00.000Z',
    );
  });

  it('rechnet Sommerzeit (UTC+2) um', () => {
    expect(iso(berlinLocalToInstant(2026, 7, 1, 12, 0, 0))).toBe(
      '2026-07-01T10:00:00.000Z',
    );
  });

  it('behandelt den Tag der Umstellung auf Sommerzeit', () => {
    // 29.03.2026: um 02:00 springt die Uhr auf 03:00. 12:00 liegt danach (UTC+2).
    expect(iso(berlinLocalToInstant(2026, 3, 29, 12, 0, 0))).toBe(
      '2026-03-29T10:00:00.000Z',
    );
    // 01:00 liegt davor (UTC+1).
    expect(iso(berlinLocalToInstant(2026, 3, 29, 1, 0, 0))).toBe(
      '2026-03-29T00:00:00.000Z',
    );
  });

  it('behandelt den Tag der Umstellung auf Winterzeit', () => {
    // 25.10.2026: um 03:00 springt die Uhr auf 02:00. 12:00 liegt danach (UTC+1).
    expect(iso(berlinLocalToInstant(2026, 10, 25, 12, 0, 0))).toBe(
      '2026-10-25T11:00:00.000Z',
    );
  });
});

describe('parseDate', () => {
  it('liest ein reines Datum als 12:00 Uhr Berlin', () => {
    expect(iso(parseDate('2026-01-05'))).toBe('2026-01-05T11:00:00.000Z');
    expect(iso(parseDate('2026-07-01'))).toBe('2026-07-01T10:00:00.000Z');
  });

  it('liest Datum mit Uhrzeit ohne Zone als Berliner Ortszeit', () => {
    expect(iso(parseDate('2026-07-01 09:30'))).toBe('2026-07-01T07:30:00.000Z');
    expect(iso(parseDate('2026-07-01T09:30'))).toBe('2026-07-01T07:30:00.000Z');
    expect(iso(parseDate('2026-07-01T09:30:15'))).toBe(
      '2026-07-01T07:30:15.000Z',
    );
  });

  it('beachtet eine angegebene Zone', () => {
    expect(iso(parseDate('2026-07-01T09:30:00+02:00'))).toBe(
      '2026-07-01T07:30:00.000Z',
    );
    expect(iso(parseDate('2026-07-01T07:30:00Z'))).toBe(
      '2026-07-01T07:30:00.000Z',
    );
  });

  it('übernimmt ein Date-Objekt unverändert', () => {
    const d = new Date('2026-02-03T04:05:06Z');
    expect(parseDate(d)?.getTime()).toBe(d.getTime());
  });

  it('liefert null für Ungültiges', () => {
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
