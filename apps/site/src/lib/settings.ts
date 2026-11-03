import { readSettings } from '@muffelblog/core';
import type { Settings } from '@muffelblog/core';

let einstellungen: Settings | undefined;

/** Einstellungen aus den Umgebungsvariablen, einmal pro Build geprüft. */
export function getSettings(): Settings {
  einstellungen ??= readSettings();
  return einstellungen;
}
