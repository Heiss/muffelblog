import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assignUniqueSlugs,
  isIgnoredPath,
  loadArticles,
  parseArticle,
} from './articles.ts';

const mtime = new Date('2026-05-05T10:00:00Z');
const parse = (path: string, text: string) =>
  parseArticle({ path, text, mtime });

describe('isIgnoredPath', () => {
  it('ignoriert versteckte Dateien und Ordner', () => {
    expect(isIgnoredPath('.obsidian/app.json')).toBe(true);
    expect(isIgnoredPath('a/.versteckt/b.md')).toBe(true);
    expect(isIgnoredPath('.trash/x.md')).toBe(true);
  });

  it('ignoriert Konfliktkopien', () => {
    expect(isIgnoredPath('a (conflicted copy 2026-01-05 100000).md')).toBe(
      true,
    );
    expect(isIgnoredPath('a.sync-conflict-20260105-100000-ABC.md')).toBe(true);
    expect(isIgnoredPath('a (Konfliktkopie 2026-01-05).md')).toBe(true);
  });

  it('ignoriert Dateien, die kein Markdown sind', () => {
    expect(isIgnoredPath('bild.png')).toBe(true);
    expect(isIgnoredPath('notizen.txt')).toBe(true);
  });

  it('lässt normale Markdown-Dateien durch', () => {
    expect(isIgnoredPath('a.md')).toBe(false);
    expect(isIgnoredPath('ordner/b c.md')).toBe(false);
  });
});

describe('parseArticle', () => {
  const ok =
    '---\npublish: true\ntitle: Titel\ndate: 2026-01-05\ntags: [A, b]\n---\nText\n';

  it('liest einen veröffentlichten Artikel', () => {
    const r = parse('ordner/datei.md', ok);
    expect(r.kind).toBe('article');
    if (r.kind !== 'article') return;
    expect(r.article).toMatchObject({
      slug: 'datei',
      title: 'Titel',
      tags: ['a', 'b'],
      dateSource: 'frontmatter',
      path: 'ordner/datei.md',
    });
    expect(r.article.date.toISOString()).toBe('2026-01-05T11:00:00.000Z');
    expect(r.warnings).toEqual([]);
  });

  it('ignoriert Artikel ohne publish', () => {
    expect(parse('a.md', '---\ntitle: A\n---\nText').kind).toBe('ignored');
    expect(parse('a.md', 'Nur Text').kind).toBe('ignored');
  });

  it('wertet nur den Boolean true als publish', () => {
    for (const wert of ['"true"', 'yes', '1', 'false', 'null']) {
      expect(parse('a.md', `---\npublish: ${wert}\n---\nText`).kind).toBe(
        'ignored',
      );
    }
  });

  it('überspringt ungültiges YAML mit Warnung', () => {
    const r = parse('a.md', '---\npublish: true\ntitle: [offen\n---\nText');
    expect(r.kind).toBe('skipped');
  });

  it('überspringt Artikel mit Wikilinks', () => {
    const r = parse('a.md', '---\npublish: true\n---\nSiehe [[Notiz]].');
    expect(r.kind).toBe('skipped');
    const r2 = parse('a.md', '---\npublish: true\n---\n![[bild.png]]');
    expect(r2.kind).toBe('skipped');
  });

  it('erkennt Wikilinks in Code nicht als Wikilinks', () => {
    const text =
      '---\npublish: true\n---\nCode: `a[[0]]`\n\n```\nx[[1]]\n```\n';
    expect(parse('a.md', text).kind).toBe('article');
  });

  it('fällt bei fehlendem Datum auf das Änderungsdatum zurück', () => {
    const r = parse('a.md', '---\npublish: true\n---\nText');
    expect(r.kind).toBe('article');
    if (r.kind !== 'article') return;
    expect(r.article.date).toEqual(mtime);
    expect(r.article.dateSource).toBe('mtime');
    expect(r.warnings.length).toBe(1);
  });

  it('fällt bei ungültigem Datum auf das Änderungsdatum zurück und warnt', () => {
    const r = parse('a.md', '---\npublish: true\ndate: gestern\n---\nText');
    expect(r.kind).toBe('article');
    if (r.kind !== 'article') return;
    expect(r.article.dateSource).toBe('mtime');
    expect(r.warnings.length).toBe(1);
  });

  it('leitet den Titel aus dem Dateinamen ab', () => {
    const r = parse(
      'ordner/Größe und Maße.md',
      '---\npublish: true\ndate: 2026-01-05\n---\nText',
    );
    expect(r.kind === 'article' && r.article.title).toBe('Größe und Maße');
    expect(r.kind === 'article' && r.article.slug).toBe('groesse-und-masse');
  });

  it('nimmt einen gesetzten Slug und normalisiert ihn', () => {
    const r = parse(
      'a.md',
      '---\npublish: true\nslug: Mein Slug\ndate: 2026-01-05\n---\nText',
    );
    expect(r.kind === 'article' && r.article.slug).toBe('mein-slug');
  });

  it('überspringt Artikel, deren Slug nicht brauchbar ist', () => {
    expect(
      parse('日本語.md', '---\npublish: true\ndate: 2026-01-05\n---\nText')
        .kind,
    ).toBe('skipped');
  });

  it('normalisiert Tags, entfernt Doppelte und warnt bei Ungültigem', () => {
    const text =
      '---\npublish: true\ndate: 2026-01-05\ntags: [Python, python, " ML ", 5]\n---\nText';
    const r = parse('a.md', text);
    expect(r.kind).toBe('article');
    if (r.kind !== 'article') return;
    expect(r.article.tags).toEqual(['python', 'ml']);
    expect(r.warnings.length).toBe(1);
  });

  it('akzeptiert einen einzelnen Tag als Text', () => {
    const r = parse(
      'a.md',
      '---\npublish: true\ndate: 2026-01-05\ntags: Python\n---\nText',
    );
    expect(r.kind === 'article' && r.article.tags).toEqual(['python']);
  });

  it('übernimmt die Beschreibung', () => {
    const r = parse(
      'a.md',
      '---\npublish: true\ndate: 2026-01-05\ndescription: Kurz\n---\nText',
    );
    expect(r.kind === 'article' && r.article.description).toBe('Kurz');
  });
});

describe('assignUniqueSlugs', () => {
  const make = (path: string, slug: string, date: string) => ({
    slug,
    title: path,
    date: new Date(date),
    dateSource: 'frontmatter' as const,
    tags: [],
    body: '',
    path,
  });

  it('lässt eindeutige Slugs unverändert', () => {
    const { articles, warnings } = assignUniqueSlugs([
      make('a.md', 'a', '2026-01-01'),
      make('b.md', 'b', '2026-01-02'),
    ]);
    expect(articles.map((a) => a.slug)).toEqual(['a', 'b']);
    expect(warnings).toEqual([]);
  });

  it('gibt dem Älteren den Slug und hängt beim Jüngeren ein Suffix an', () => {
    const { articles, warnings } = assignUniqueSlugs([
      make('b.md', 'gleich', '2026-01-03'),
      make('a.md', 'gleich', '2026-01-02'),
    ]);
    expect(articles.map((a) => [a.path, a.slug])).toEqual([
      ['a.md', 'gleich'],
      ['b.md', 'gleich-2'],
    ]);
    expect(warnings.length).toBe(1);
  });

  it('zählt weiter und vermeidet Zusammenstöße mit vorhandenen Suffixen', () => {
    const { articles } = assignUniqueSlugs([
      make('a.md', 'x', '2026-01-01'),
      make('b.md', 'x', '2026-01-02'),
      make('c.md', 'x', '2026-01-03'),
      make('d.md', 'x-2', '2026-01-04'),
    ]);
    expect(articles.map((a) => a.slug)).toEqual(['x', 'x-2', 'x-3', 'x-2-2']);
  });

  it('ordnet bei gleichem Datum nach Pfad, damit das Ergebnis stabil ist', () => {
    const { articles } = assignUniqueSlugs([
      make('z.md', 's', '2026-01-01'),
      make('a.md', 's', '2026-01-01'),
    ]);
    expect(articles.map((a) => [a.path, a.slug])).toEqual([
      ['a.md', 's'],
      ['z.md', 's-2'],
    ]);
  });
});

describe('loadArticles (Fixtures)', () => {
  const dir = fileURLToPath(new URL('../fixtures/content', import.meta.url));

  it('lädt genau die veröffentlichbaren Artikel', async () => {
    const { articles } = await loadArticles(dir);
    expect(articles.map((a) => a.slug).sort()).toEqual(
      [
        'gleich',
        'gleich-2',
        'groesse-und-masse',
        'hallo-welt',
        'ohne-datum',
        'tief',
        'zeit-ohne-zone',
      ].sort(),
    );
  });

  it('meldet übersprungene und zurückgefallene Dateien', async () => {
    const { warnings } = await loadArticles(dir);
    const text = warnings.join('\n');
    expect(text).toContain('kaputt.md');
    expect(text).toContain('wikilink.md');
    expect(text).toContain('ohne-datum.md');
    expect(text).not.toContain('geheim');
    expect(text).not.toContain('conflicted');
  });

  it('sortiert nach Datum, neueste zuerst', async () => {
    const { articles } = await loadArticles(dir);
    const times = articles.map((a) => a.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('liefert einen Fehler für einen fehlenden Ordner', async () => {
    await expect(loadArticles(`${dir}/gibt-es-nicht`)).rejects.toThrow();
  });
});
