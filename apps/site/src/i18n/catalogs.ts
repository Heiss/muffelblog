import type { Language } from '@muffelblog/core';
import { de } from './de.ts';
import { en } from './en.ts';
import type { Messages } from './types.ts';

export const catalogs: Record<Language, Messages> = { de, en };

/** Default UI language. A test keeps it equal to `DEFAULT_LANG` of the core. */
export const DEFAULT_UI_LANG: Language = 'en';

/** Picks the catalog; an unknown language stops the build. */
export function pickMessages(value: string): Messages {
  const lang = value.trim().toLowerCase() || DEFAULT_UI_LANG;
  if (!Object.hasOwn(catalogs, lang)) {
    throw new Error(
      `MUFFEL_LANG="${value}" is invalid, allowed are ${Object.keys(catalogs).join(', ')}, default ${DEFAULT_UI_LANG}`,
    );
  }
  return catalogs[lang as Language];
}
