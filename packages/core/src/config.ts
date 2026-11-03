/**
 * Settings from environment variables. All values take effect at build time
 * and are baked into the site. Invalid values stop the build, so a typo never
 * publishes a wrongly configured site.
 * Allowlists and file signatures are deliberately not part of this.
 */

export interface Settings {
  /** Entries per block of the feed. */
  feedPageSize: number;
  /** Maximum length of an article excerpt in the feed, in characters. */
  feedExcerptChars: number;
  /** Maximum length of a memo description (meta tag), in characters. */
  memosDescriptionChars: number;
  /** Time limit per request to Memos, in milliseconds. */
  memosTimeoutMs: number;
  /** Maximum size per mirrored memo file, in bytes. */
  memosMaxFileBytes: number;
  /** Number of entries in the RSS feed. */
  rssItems: number;
}

export interface SettingSpec {
  key: keyof Settings;
  env: string;
  default: number;
  min: number;
  max: number;
  /** Factor from the variable's value to the setting's value (MB to bytes). */
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
    unit: 'entries',
    description: 'Entries per block of the feed',
  },
  {
    key: 'feedExcerptChars',
    env: 'MUFFEL_FEED_EXCERPT_CHARS',
    default: 200,
    min: 20,
    max: 2000,
    factor: 1,
    unit: 'characters',
    description: 'Length of the article excerpt in the feed',
  },
  {
    key: 'memosDescriptionChars',
    env: 'MUFFEL_MEMOS_DESCRIPTION_CHARS',
    default: 160,
    min: 20,
    max: 500,
    factor: 1,
    unit: 'characters',
    description: 'Length of the description of a memo page',
  },
  {
    key: 'memosTimeoutMs',
    env: 'MUFFEL_MEMOS_TIMEOUT_MS',
    default: 30_000,
    min: 1000,
    max: 300_000,
    factor: 1,
    unit: 'ms',
    description: 'Time limit per request to Memos',
  },
  {
    key: 'memosMaxFileBytes',
    env: 'MUFFEL_MEMOS_MAX_FILE_MB',
    default: 25,
    min: 1,
    max: 500,
    factor: MB,
    unit: 'MB',
    description: 'Maximum size per mirrored memo file',
  },
  {
    key: 'rssItems',
    env: 'MUFFEL_RSS_ITEMS',
    default: 50,
    min: 1,
    max: 500,
    factor: 1,
    unit: 'entries',
    description: 'Number of entries in the RSS feed',
  },
];

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function defaults(): Settings {
  const s: Record<string, number> = {};
  for (const spec of SETTING_SPECS) s[spec.key] = spec.default * spec.factor;
  return s as unknown as Settings;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze(defaults());

/**
 * Reads and validates all settings. An empty variable counts as unset
 * (Compose delivers it like that when `${VAR:-}` stays empty). Only unsigned
 * integers are allowed. All errors are collected.
 */
export function readSettings(
  env: Record<string, string | undefined> = process.env,
): Settings {
  const values: Record<string, number> = {};
  const errors: string[] = [];
  for (const spec of SETTING_SPECS) {
    const raw = env[spec.env]?.trim();
    if (raw === undefined || raw === '') {
      values[spec.key] = spec.default * spec.factor;
      continue;
    }
    const number = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (
      !Number.isSafeInteger(number) ||
      number < spec.min ||
      number > spec.max
    ) {
      errors.push(
        `${spec.env}="${raw}" is invalid, allowed are integers from ${spec.min} to ${spec.max} (${spec.unit}), default ${spec.default}`,
      );
      continue;
    }
    values[spec.key] = number * spec.factor;
  }
  if (errors.length > 0) {
    throw new ConfigError(`Invalid settings:\n- ${errors.join('\n- ')}`);
  }
  return values as unknown as Settings;
}
