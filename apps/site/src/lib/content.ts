import path from 'node:path';

/**
 * Ordner mit den Markdown-Artikeln. Der Builder setzt `CONTENT_DIR` auf den
 * synchronisierten Nextcloud-Ordner. Ohne Angabe dienen die Test-Fixtures.
 * Der Build läuft im Ordner apps/site, daher der relative Pfad.
 */
export function contentDir(): string {
  return (
    process.env.CONTENT_DIR ??
    path.resolve(process.cwd(), '../../packages/core/fixtures/content')
  );
}
