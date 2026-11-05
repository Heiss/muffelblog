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

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  zone?: string;
}

/** The numbers of a match; a date without a time counts as 12:00. */
function partsOf(match: RegExpExecArray): DateParts {
  const [, y, mo, d, h, min, s, ms, zone] = match;
  const hasTime = h !== undefined;
  return {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: hasTime ? Number(h) : 12,
    minute: hasTime ? Number(min) : 0,
    second: s !== undefined ? Number(s) : 0,
    millisecond: ms !== undefined ? Number(ms.padEnd(3, '0')) : 0,
    zone,
  };
}

/** True when month, day and time exist (no 31 February, no 25:00). */
function isValidDate(p: DateParts): boolean {
  if (p.month < 1 || p.month > 12) return false;
  if (p.hour > 23 || p.minute > 59 || p.second > 59) return false;
  const calendar = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return (
    calendar.getUTCMonth() === p.month - 1 && calendar.getUTCDate() === p.day
  );
}

/** The instant of a date with `Z` or an offset like `+02:00`. */
function withZone(p: DateParts, zone: string): Date {
  const naive = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
    p.millisecond,
  );
  if (zone.toUpperCase() === 'Z') return new Date(naive);
  const sign = zone.startsWith('-') ? -1 : 1;
  const digits = zone.slice(1).replace(':', '');
  const offsetMinutes =
    Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4));
  return new Date(naive - sign * offsetMinutes * 60_000);
}

/**
 * Reads a date from the frontmatter.
 * - `2026-01-05`: date only, counts as 12:00 in Europe/Berlin
 * - `2026-01-05 09:30` or `2026-01-05T09:30`: Berlin local time
 * - with `Z` or an offset (`+02:00`): exactly that instant
 * Returns null if the value is not a valid date.
 */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value !== 'string') return null;
  const match = PATTERN.exec(value.trim());
  if (!match) return null;
  const p = partsOf(match);
  if (!isValidDate(p)) return null;
  if (p.zone !== undefined) return withZone(p, p.zone);
  return berlinLocalToInstant(
    p.year,
    p.month,
    p.day,
    p.hour,
    p.minute,
    p.second,
    p.millisecond,
  );
}
