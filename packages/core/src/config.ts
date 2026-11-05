/**
 * Settings from environment variables. All values take effect at build time
 * and are baked into the site. Invalid values stop the build, so a typo never
 * publishes a wrongly configured site.
 * Allowlists and file signatures are deliberately not part of this.
 */

/** UI languages. One build has exactly one (`MUFFEL_LANG`). */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANG: Language = 'en';

export interface Settings {
  /** Language of the user interface (articles are not translated). */
  lang: Language;
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
  /** Number of releases kept on disk (open tabs still load their assets). */
  releasesKept: number;
  /** Seconds between two checks of the sources. */
  checkIntervalSeconds: number;
  /** Equal checks in a row after a change before it is built (0 = at once). */
  debounceChecks: number;
  /** Time limit per request to a foreign server when sending webmentions, in ms. */
  webmentionsTimeoutMs: number;
  /** Maximum bytes read from a foreign response when sending webmentions. */
  webmentionsMaxBytes: number;
  /** Maximum number of targets per entry. */
  webmentionsMaxTargets: number;
  /** Pause between two requests to foreign servers, in ms. */
  webmentionsDelayMs: number;
  /** Tries per pair over later builds before it is given up. */
  webmentionsAttempts: number;
  /** Days a host without a webmention endpoint is not asked again. */
  webmentionsNoEndpointDays: number;
  /** Days a found endpoint is reused. */
  webmentionsEndpointDays: number;
  /** Send webmentions at all. Off by default: the instance stays inside. */
  webmentionsSend: boolean;
  /** Receive webmentions through webmention.io. Off by default: the instance stays inside. */
  webmentionsReceive: boolean;
  /** Lift the address check (loopback, private). Only for tests and the tutorial. */
  webmentionsAllowPrivate: boolean;
  /** Hosts that are never asked, lower case. */
  webmentionsBlock: string[];
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
  {
    key: 'releasesKept',
    env: 'MUFFEL_RELEASES_KEPT',
    default: 3,
    min: 1,
    max: 50,
    factor: 1,
    unit: 'releases',
    description: 'Number of releases kept on disk',
  },
  {
    key: 'checkIntervalSeconds',
    env: 'MUFFEL_CHECK_INTERVAL_SECONDS',
    default: 180,
    min: 10,
    max: 3600,
    factor: 1,
    unit: 'seconds',
    description: 'Seconds between two checks of Nextcloud and Memos',
  },
  {
    key: 'debounceChecks',
    env: 'MUFFEL_DEBOUNCE_CHECKS',
    default: 1,
    min: 0,
    max: 10,
    factor: 1,
    unit: 'checks',
    description: 'Equal checks in a row after a change before it is built',
  },
  {
    key: 'webmentionsTimeoutMs',
    env: 'MUFFEL_WEBMENTIONS_TIMEOUT_MS',
    default: 10_000,
    min: 1000,
    max: 60_000,
    factor: 1,
    unit: 'milliseconds',
    description: 'Time limit per request to a foreign server (webmentions)',
  },
  {
    key: 'webmentionsMaxBytes',
    env: 'MUFFEL_WEBMENTIONS_MAX_KB',
    default: 1024,
    min: 16,
    max: 10_240,
    factor: 1024,
    unit: 'KB',
    description:
      'Largest part of a foreign response that is read (webmentions)',
  },
  {
    key: 'webmentionsMaxTargets',
    env: 'MUFFEL_WEBMENTIONS_MAX_TARGETS',
    default: 10,
    min: 1,
    max: 100,
    factor: 1,
    unit: 'targets',
    description: 'Most links of one entry that are reported (webmentions)',
  },
  {
    key: 'webmentionsDelayMs',
    env: 'MUFFEL_WEBMENTIONS_DELAY_MS',
    default: 1000,
    min: 0,
    max: 60_000,
    factor: 1,
    unit: 'milliseconds',
    description: 'Pause between two requests to foreign servers (webmentions)',
  },
  {
    key: 'webmentionsAttempts',
    env: 'MUFFEL_WEBMENTIONS_ATTEMPTS',
    default: 3,
    min: 1,
    max: 10,
    factor: 1,
    unit: 'tries',
    description: 'Tries per source and target over later builds (webmentions)',
  },
  {
    key: 'webmentionsNoEndpointDays',
    env: 'MUFFEL_WEBMENTIONS_NO_ENDPOINT_DAYS',
    default: 30,
    min: 1,
    max: 365,
    factor: 1,
    unit: 'days',
    description: 'Days a host without an endpoint is not asked again',
  },
  {
    key: 'webmentionsEndpointDays',
    env: 'MUFFEL_WEBMENTIONS_ENDPOINT_DAYS',
    default: 7,
    min: 1,
    max: 365,
    factor: 1,
    unit: 'days',
    description: 'Days a found endpoint is reused',
  },
];

/** Settings that are no numbers: switches (`0`/`1`) and the block list. */
const FLAG_DEFAULTS = {
  webmentionsSend: false,
  webmentionsReceive: false,
  webmentionsAllowPrivate: false,
  webmentionsBlock: [] as string[],
};

const FLAGS = [
  ['webmentionsSend', 'MUFFEL_WEBMENTIONS_SEND'],
  ['webmentionsReceive', 'MUFFEL_WEBMENTIONS_RECEIVE'],
  ['webmentionsAllowPrivate', 'MUFFEL_WEBMENTIONS_ALLOW_PRIVATE'],
] as const;

const HOST_NAME =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function defaults(): Settings {
  const s: Record<string, unknown> = {
    lang: DEFAULT_LANG,
    ...FLAG_DEFAULTS,
    webmentionsBlock: [],
  };
  for (const spec of SETTING_SPECS) s[spec.key] = spec.default * spec.factor;
  return s as unknown as Settings;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze(defaults());

type Values = Record<string, unknown>;

function readFlags(
  env: Record<string, string | undefined>,
  values: Values,
  errors: string[],
) {
  for (const [key, name] of FLAGS) {
    const raw = env[name]?.trim();
    if (raw === undefined || raw === '') continue;
    if (raw === '1') values[key] = true;
    else if (raw !== '0')
      errors.push(
        `${name}="${raw}" is invalid, allowed are 0 and 1, default 0`,
      );
  }
}

function readBlock(
  env: Record<string, string | undefined>,
  values: Values,
  errors: string[],
) {
  const block = env.MUFFEL_WEBMENTIONS_BLOCK?.trim();
  if (!block) return;
  const hosts = block
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h !== '');
  const bad = hosts.filter((h) => !HOST_NAME.test(h));
  if (bad.length === 0) {
    values.webmentionsBlock = hosts;
    return;
  }
  errors.push(
    `MUFFEL_WEBMENTIONS_BLOCK contains no host name: ${bad.map((h) => `"${h}"`).join(', ')} (comma separated host names such as example.org)`,
  );
}

function readLang(
  env: Record<string, string | undefined>,
  values: Values,
  errors: string[],
) {
  const lang = env.MUFFEL_LANG?.trim().toLowerCase();
  if (!lang) return;
  if ((LANGUAGES as readonly string[]).includes(lang)) values.lang = lang;
  else
    errors.push(
      `MUFFEL_LANG="${env.MUFFEL_LANG?.trim()}" is invalid, allowed are ${LANGUAGES.join(', ')}, default ${DEFAULT_LANG}`,
    );
}

function readNumbers(
  env: Record<string, string | undefined>,
  values: Values,
  errors: string[],
) {
  for (const spec of SETTING_SPECS) {
    const raw = env[spec.env]?.trim();
    if (raw === undefined || raw === '') {
      values[spec.key] = spec.default * spec.factor;
      continue;
    }
    const number = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (
      Number.isSafeInteger(number) &&
      number >= spec.min &&
      number <= spec.max
    ) {
      values[spec.key] = number * spec.factor;
      continue;
    }
    errors.push(
      `${spec.env}="${raw}" is invalid, allowed are integers from ${spec.min} to ${spec.max} (${spec.unit}), default ${spec.default}`,
    );
  }
}

/**
 * Reads and validates all settings. An empty variable counts as unset
 * (Compose delivers it like that when `${VAR:-}` stays empty). Only unsigned
 * integers are allowed. All errors are collected.
 */
export function readSettings(
  env: Record<string, string | undefined> = process.env,
): Settings {
  const values: Values = {
    lang: DEFAULT_LANG,
    ...FLAG_DEFAULTS,
    webmentionsBlock: [],
  };
  const errors: string[] = [];
  readFlags(env, values, errors);
  readBlock(env, values, errors);
  readLang(env, values, errors);
  readNumbers(env, values, errors);
  if (errors.length > 0) {
    throw new ConfigError(`Invalid settings:\n- ${errors.join('\n- ')}`);
  }
  return values as unknown as Settings;
}
