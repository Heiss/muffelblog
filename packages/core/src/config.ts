/**
 * Einstellungen aus Umgebungsvariablen. Alle Werte wirken beim Build und sind
 * in der Seite festgeschrieben. Ungültige Werte brechen den Build ab, damit ein
 * Tippfehler keine falsch konfigurierte Seite veröffentlicht.
 * Freigabelisten und Dateikennungen gehören bewusst nicht dazu.
 */

export interface Settings {
  /** Einträge pro Block des Feeds. */
  feedPageSize: number;
  /** Höchstlänge des Auszugs eines Artikels im Feed, in Zeichen. */
  feedExcerptChars: number;
  /** Höchstlänge der Beschreibung eines Memos (Meta-Tag), in Zeichen. */
  memosDescriptionChars: number;
  /** Zeitlimit je Anfrage an Memos, in Millisekunden. */
  memosTimeoutMs: number;
  /** Höchstgröße je gespiegelter Memo-Datei, in Bytes. */
  memosMaxFileBytes: number;
}

export interface SettingSpec {
  key: keyof Settings;
  env: string;
  default: number;
  min: number;
  max: number;
  /** Faktor von Wert der Variable zu Wert der Einstellung (MB zu Bytes). */
  factor: number;
  unit: string;
  description: string;
}

const MB = 1024 * 1024;

export const SETTING_SPECS: readonly SettingSpec[] = [
  {
    key: 'feedPageSize',
    env: 'MUFFEL_FEED_PAGE_SIZE',
    default: 20,
    min: 1,
    max: 200,
    factor: 1,
    unit: 'Einträge',
    description: 'Einträge pro Block des Feeds',
  },
  {
    key: 'feedExcerptChars',
    env: 'MUFFEL_FEED_EXCERPT_CHARS',
    default: 200,
    min: 20,
    max: 2000,
    factor: 1,
    unit: 'Zeichen',
    description: 'Länge des Artikelauszugs im Feed',
  },
  {
    key: 'memosDescriptionChars',
    env: 'MUFFEL_MEMOS_DESCRIPTION_CHARS',
    default: 160,
    min: 20,
    max: 500,
    factor: 1,
    unit: 'Zeichen',
    description: 'Länge der Beschreibung einer Memo-Seite',
  },
  {
    key: 'memosTimeoutMs',
    env: 'MUFFEL_MEMOS_TIMEOUT_MS',
    default: 30_000,
    min: 1000,
    max: 300_000,
    factor: 1,
    unit: 'ms',
    description: 'Zeitlimit je Anfrage an Memos',
  },
  {
    key: 'memosMaxFileBytes',
    env: 'MUFFEL_MEMOS_MAX_FILE_MB',
    default: 25,
    min: 1,
    max: 500,
    factor: MB,
    unit: 'MB',
    description: 'Höchstgröße je gespiegelter Memo-Datei',
  },
];

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function standard(): Settings {
  const s: Record<string, number> = {};
  for (const spec of SETTING_SPECS) s[spec.key] = spec.default * spec.factor;
  return s as unknown as Settings;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze(standard());

/**
 * Liest und prüft alle Einstellungen. Eine leere Variable gilt als nicht
 * gesetzt (Compose liefert sie so, wenn `${VAR:-}` leer bleibt). Nur
 * Ganzzahlen ohne Vorzeichen sind erlaubt. Alle Fehler werden gesammelt.
 */
export function readSettings(
  env: Record<string, string | undefined> = process.env,
): Settings {
  const werte: Record<string, number> = {};
  const fehler: string[] = [];
  for (const spec of SETTING_SPECS) {
    const roh = env[spec.env]?.trim();
    if (roh === undefined || roh === '') {
      werte[spec.key] = spec.default * spec.factor;
      continue;
    }
    const zahl = /^\d+$/.test(roh) ? Number(roh) : NaN;
    if (!Number.isSafeInteger(zahl) || zahl < spec.min || zahl > spec.max) {
      fehler.push(
        `${spec.env}="${roh}" ist ungültig, erlaubt sind Ganzzahlen von ${spec.min} bis ${spec.max} (${spec.unit}), Standard ${spec.default}`,
      );
      continue;
    }
    werte[spec.key] = zahl * spec.factor;
  }
  if (fehler.length > 0) {
    throw new ConfigError(`Ungültige Einstellungen:\n- ${fehler.join('\n- ')}`);
  }
  return werte as unknown as Settings;
}
