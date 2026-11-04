import type { en } from './en.ts';

/** Widens the literal types of the English catalog to `string` and functions. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { -readonly [K in keyof T]: Widen<T[K]> };

/**
 * The shape every language catalog must have. It is derived from the English
 * catalog: a key that is missing in another language fails the type check.
 */
export type Messages = Widen<typeof en>;
