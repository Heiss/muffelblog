import { pickMessages } from './catalogs.ts';
import type { Messages } from './types.ts';

export type { Messages } from './types.ts';

/**
 * Value of `MUFFEL_LANG`, put in at build time by `astro.config.mjs` (`define`),
 * so the scripts that run in the browser carry exactly one language.
 */
declare const __MUFFEL_LANG__: string;

/** UI texts of the language chosen with `MUFFEL_LANG` (one language per build). */
export const messages: Messages = pickMessages(__MUFFEL_LANG__);
