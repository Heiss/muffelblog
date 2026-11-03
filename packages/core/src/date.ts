const TIME_ZONE = 'Europe/Berlin';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Offset of Berlin from UTC in milliseconds at the instant `ts`. */
function berlinOffsetMs(ts: number): number {
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(ts))) {
    parts[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Converts a Berlin local time to the instant (UTC). */
export function berlinLocalToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond = 0,
): Date {
  const naive = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  // Two passes, because the offset depends on the target instant (daylight saving time).
  const firstGuess = naive - berlinOffsetMs(naive);
  return new Date(naive - berlinOffsetMs(firstGuess));
}

const PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;

/**
 * Reads a date from the frontmatter.
 * - `2026-01-05`: date only, counts as 12:00 in Europe/Berlin
 * - `2026-01-05 09:30` or `2026-01-05T09:30`: Berlin local time
 * - with `Z` or an offset (`+02:00`): exactly that instant
 * Returns null if the value is not a valid date.
 */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value !== 'string') return null;

  const match = PATTERN.exec(value.trim());
  if (!match) return null;

  const [, y, mo, d, h, min, s, ms, zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hasTime = h !== undefined;
  const hour = hasTime ? Number(h) : 12;
  const minute = hasTime ? Number(min) : 0;
  const second = s !== undefined ? Number(s) : 0;
  const millisecond = ms !== undefined ? Number(ms.padEnd(3, '0')) : 0;

  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59)
    return null;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day)
    return null;

  if (zone === undefined) {
    return berlinLocalToInstant(
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
    );
  }
  const naive = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  if (zone.toUpperCase() === 'Z') return new Date(naive);
  const sign = zone.startsWith('-') ? -1 : 1;
  const digits = zone.slice(1).replace(':', '');
  const offsetMinutes =
    Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4));
  return new Date(naive - sign * offsetMinutes * 60_000);
}
