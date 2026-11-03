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
  it('ignores hidden files and folders', () => {
    expect(isIgnoredPath('.obsidian/app.json')).toBe(true);
    expect(isIgnoredPath('a/.versteckt/b.md')).toBe(true);
    expect(isIgnoredPath('.trash/x.md')).toBe(true);
  });

  it('ignores conflict copies', () => {
    expect(isIgnoredPath('a (conflicted copy 2026-01-05 100000).md')).toBe(
      true,
    );
    expect(isIgnoredPath('a.sync-conflict-20260105-100000-ABC.md')).toBe(true);
    expect(isIgnoredPath('a (Konfliktkopie 2026-01-05).md')).toBe(true);
  });

  it('ignores files that are not Markdown', () => {
    expect(isIgnoredPath('bild.png')).toBe(true);
    expect(isIgnoredPath('notizen.txt')).toBe(true);
  });

  it('lets normal Markdown files through', () => {
    expect(isIgnoredPath('a.md')).toBe(false);
    expect(isIgnoredPath('ordner/b c.md')).toBe(false);
  });
});

describe('parseArticle', () => {
  const ok =
    '---\npublish: true\ntitle: Titel\ndate: 2026-01-05\ntags: [A, b]\n---\nText\n';

  it('reads a published article', () => {
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

  it('ignores articles without publish', () => {
    expect(parse('a.md', '---\ntitle: A\n---\nText').kind).toBe('ignored');
    expect(parse('a.md', 'Nur Text').kind).toBe('ignored');
  });

  it('counts only the boolean true as publish', () => {
    for (const value of ['"true"', 'yes', '1', 'false', 'null']) {
      expect(parse('a.md', `---\npublish: ${value}\n---\nText`).kind).toBe(
        'ignored',
      );
    }
  });

  it('skips invalid YAML with a warning', () => {
    const r = parse('a.md', '---\npublish: true\ntitle: [offen\n---\nText');
    expect(r.kind).toBe('skipped');
  });

  it('skips articles with wikilinks', () => {
    const r = parse('a.md', '---\npublish: true\n---\nSiehe [[Notiz]].');
    expect(r.kind).toBe('skipped');
    const r2 = parse('a.md', '---\npublish: true\n---\n![[bild.png]]');
    expect(r2.kind).toBe('skipped');
  });

  it('does not treat wikilinks in code as wikilinks', () => {
    const text =
      '---\npublish: true\n---\nCode: `a[[0]]`\n\n```\nx[[1]]\n```\n';
    expect(parse('a.md', text).kind).toBe('article');
  });

  it('falls back to the modification date if the date is missing', () => {
    const r = parse('a.md', '---\npublish: true\n---\nText');
    expect(r.kind).toBe('article');
    if (r.kind !== 'article') return;
    expect(r.article.date).toEqual(mtime);
    expect(r.article.dateSource).toBe('mtime');
    expect(r.warnings.length).toBe(1);
  });

  it('falls back to the modification date for an invalid date and warns', () => {
    const r = parse('a.md', '---\npublish: true\ndate: gestern\n---\nText');
    expect(r.kind).toBe('article');
    if (r.kind !== 'article') return;
    expect(r.article.dateSource).toBe('mtime');
    expect(r.warnings.length).toBe(1);
  });

  it('derives the title from the file name', () => {
    const r = parse(
      'ordner/Größe und Maße.md',
      '---\npublish: true\ndate: 2026-01-05\n---\nText',
    );
    expect(r.kind === 'article' && r.article.title).toBe('Größe und Maße');
    expect(r.kind === 'article' && r.article.slug).toBe('groesse-und-masse');
  });

  it('takes a given slug and normalizes it', () => {
    const r = parse(
      'a.md',
      '---\npublish: true\nslug: Mein Slug\ndate: 2026-01-05\n---\nText',
    );
    expect(r.kind === 'article' && r.article.slug).toBe('mein-slug');
  });

  it('skips articles whose slug is not usable', () => {
    expect(
      parse('日本語.md', '---\npublish: true\ndate: 2026-01-05\n---\nText')
        .kind,
    ).toBe('skipped');
  });

  it('normalizes tags, removes duplicates and warns about invalid ones', () => {
    const text =
      '---\npublish: true\ndate: 2026-01-05\ntags: [Python, python, " ML ", 5]\n---\nText';
    const r = parse('a.md', text);
    expect(r.kind).toBe('article');
    if (r.kind !== 'article') return;
    expect(r.article.tags).toEqual(['python', 'ml']);
    expect(r.warnings.length).toBe(1);
  });

  it('accepts a single tag as text', () => {
    const r = parse(
      'a.md',
      '---\npublish: true\ndate: 2026-01-05\ntags: Python\n---\nText',
    );
    expect(r.kind === 'article' && r.article.tags).toEqual(['python']);
  });

  it('takes over the description', () => {
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

  it('leaves unique slugs unchanged', () => {
    const { articles, warnings } = assignUniqueSlugs([
      make('a.md', 'a', '2026-01-01'),
      make('b.md', 'b', '2026-01-02'),
    ]);
    expect(articles.map((a) => a.slug)).toEqual(['a', 'b']);
    expect(warnings).toEqual([]);
  });

  it('gives the older one the slug and appends a suffix to the younger one', () => {
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

  it('keeps counting and avoids clashes with existing suffixes', () => {
    const { articles } = assignUniqueSlugs([
      make('a.md', 'x', '2026-01-01'),
      make('b.md', 'x', '2026-01-02'),
      make('c.md', 'x', '2026-01-03'),
      make('d.md', 'x-2', '2026-01-04'),
    ]);
    expect(articles.map((a) => a.slug)).toEqual(['x', 'x-2', 'x-3', 'x-2-2']);
  });

  it('orders by path at the same date so the result is stable', () => {
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

  it('loads exactly the publishable articles', async () => {
    const { articles } = await loadArticles(dir);
    expect(articles.map((a) => a.slug).sort()).toEqual(
      [
        'gleich',
        'gleich-2',
        'groesse-und-masse',
        'hallo-welt',
        'ohne-datum',
        'rendering-demo',
        'tief',
        'unsicher',
        'zeit-ohne-zone',
      ].sort(),
    );
  });

  it('reports skipped files and files that fell back', async () => {
    const { warnings } = await loadArticles(dir);
    const text = warnings.join('\n');
    expect(text).toContain('kaputt.md');
    expect(text).toContain('wikilink.md');
    expect(text).toContain('ohne-datum.md');
    expect(text).not.toContain('geheim');
    expect(text).not.toContain('conflicted');
  });

  it('sorts by date, newest first', async () => {
    const { articles } = await loadArticles(dir);
    const times = articles.map((a) => a.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('returns an error for a missing folder', async () => {
    await expect(loadArticles(`${dir}/gibt-es-nicht`)).rejects.toThrow();
  });
});
