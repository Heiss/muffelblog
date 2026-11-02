const ZEITZONE = 'Europe/Berlin';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ZEITZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Abstand von Berlin zu UTC in Millisekunden zum Zeitpunkt `ts`. */
function berlinOffsetMs(ts: number): number {
  const teile: Record<string, string> = {};
  for (const teil of formatter.formatToParts(new Date(ts))) {
    teile[teil.type] = teil.value;
  }
  const alsUtc = Date.UTC(
    Number(teile.year),
    Number(teile.month) - 1,
    Number(teile.day),
    Number(teile.hour),
    Number(teile.minute),
    Number(teile.second),
  );
  return alsUtc - Math.floor(ts / 1000) * 1000;
}

/** Wandelt eine Berliner Ortszeit in den Zeitpunkt (UTC) um. */
export function berlinLocalToInstant(
  jahr: number,
  monat: number,
  tag: number,
  stunde: number,
  minute: number,
  sekunde: number,
  millisekunde = 0,
): Date {
  const naiv = Date.UTC(
    jahr,
    monat - 1,
    tag,
    stunde,
    minute,
    sekunde,
    millisekunde,
  );
  // Zwei Durchgänge, weil der Abstand vom gesuchten Zeitpunkt abhängt (Sommerzeit).
  const ersterVersuch = naiv - berlinOffsetMs(naiv);
  return new Date(naiv - berlinOffsetMs(ersterVersuch));
}

const MUSTER =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;

/**
 * Liest ein Datum aus dem Frontmatter.
 * - `2026-01-05`: reines Datum, gilt als 12:00 Uhr in Europe/Berlin
 * - `2026-01-05 09:30` oder `2026-01-05T09:30`: Berliner Ortszeit
 * - mit `Z` oder Versatz (`+02:00`): genau dieser Zeitpunkt
 * Liefert null, wenn der Wert kein gültiges Datum ist.
 */
export function parseDate(wert: unknown): Date | null {
  if (wert instanceof Date) {
    return Number.isNaN(wert.getTime()) ? null : new Date(wert.getTime());
  }
  if (typeof wert !== 'string') return null;

  const treffer = MUSTER.exec(wert.trim());
  if (!treffer) return null;

  const [, j, m, t, h, min, s, ms, zone] = treffer;
  const jahr = Number(j);
  const monat = Number(m);
  const tag = Number(t);
  const hatZeit = h !== undefined;
  const stunde = hatZeit ? Number(h) : 12;
  const minute = hatZeit ? Number(min) : 0;
  const sekunde = s !== undefined ? Number(s) : 0;
  const millisekunde = ms !== undefined ? Number(ms.padEnd(3, '0')) : 0;

  if (monat < 1 || monat > 12 || stunde > 23 || minute > 59 || sekunde > 59)
    return null;
  const kalender = new Date(Date.UTC(jahr, monat - 1, tag));
  if (kalender.getUTCMonth() !== monat - 1 || kalender.getUTCDate() !== tag)
    return null;

  if (zone === undefined) {
    return berlinLocalToInstant(
      jahr,
      monat,
      tag,
      stunde,
      minute,
      sekunde,
      millisekunde,
    );
  }
  const naiv = Date.UTC(
    jahr,
    monat - 1,
    tag,
    stunde,
    minute,
    sekunde,
    millisekunde,
  );
  if (zone.toUpperCase() === 'Z') return new Date(naiv);
  const vorzeichen = zone.startsWith('-') ? -1 : 1;
  const ziffern = zone.slice(1).replace(':', '');
  const versatzMinuten =
    Number(ziffern.slice(0, 2)) * 60 + Number(ziffern.slice(2, 4));
  return new Date(naiv - vorzeichen * versatzMinuten * 60_000);
}
