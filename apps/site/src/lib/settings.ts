import { readSettings } from '@muffelblog/core';
import type { Settings } from '@muffelblog/core';

let settings: Settings | undefined;

/** Settings from the environment variables, checked once per build. */
export function getSettings(): Settings {
  settings ??= readSettings();
  return settings;
}
