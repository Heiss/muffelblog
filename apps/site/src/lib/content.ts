import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  createFixtureMemosSource,
  createHttpMemosSource,
  readSettings,
} from '@muffelblog/core';
import type { MemosSource } from '@muffelblog/core';

export interface ContentConfig {
  /** Ordner mit den Markdown-Artikeln. */
  contentDir: string;
  /** Quelle der öffentlichen Memos. */
  memos: MemosSource;
}

function findRepoRoot(start: string): string {
  let ordner = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(ordner, 'pnpm-workspace.yaml'))) return ordner;
    const eltern = path.dirname(ordner);
    if (eltern === ordner)
      throw new Error(
        'Wurzel des Repos nicht gefunden (pnpm-workspace.yaml fehlt)',
      );
    ordner = eltern;
  }
}

/**
 * Wählt die Inhaltsquellen für den Build.
 *
 * Absicht: Ein Build ohne ausdrückliche Konfiguration darf nie Beispieldaten
 * veröffentlichen. Deshalb müssen `CONTENT_DIR` (synchronisierter Nextcloud-
 * Ordner) und `MEMOS_URL` (Adresse der Memos-Instanz) gesetzt sein. Beispieldaten
 * gibt es nur mit `MUFFEL_FIXTURES=1` (Entwicklung, Tests).
 */
export function contentConfig(
  env: Record<string, string | undefined> = process.env,
): ContentConfig {
  if (env.MUFFEL_FIXTURES === '1') {
    const fixtures = path.join(
      findRepoRoot(process.cwd()),
      'packages',
      'core',
      'fixtures',
    );
    return {
      contentDir: path.join(fixtures, 'content'),
      memos: createFixtureMemosSource(path.join(fixtures, 'memos')),
    };
  }
  const fehlend = (['CONTENT_DIR', 'MEMOS_URL'] as const).filter(
    (name) => !env[name],
  );
  if (fehlend.length > 0) {
    throw new Error(
      `Inhaltsquellen nicht konfiguriert, es fehlt: ${fehlend.join(', ')}. ` +
        'Für Entwicklung und Tests mit Beispieldaten MUFFEL_FIXTURES=1 setzen.',
    );
  }
  return {
    contentDir: env.CONTENT_DIR as string,
    memos: createHttpMemosSource({
      baseUrl: env.MEMOS_URL as string,
      timeoutMs: readSettings(env).memosTimeoutMs,
    }),
  };
}
