import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RESERVED_PAGE_SLUGS,
  assignUniqueSlugs,
  loadArticles,
  parseArticle,
  type Article,
} from './articles.ts';

// Exact results and warnings of reading articles.

const mtime = new Date('2026-05-05T10:00:00Z');
const parse = (text: string, file = 'dir/My Post.md') =>
  parseArticle({ path: file, text, mtime });
// A `created:` line without `updated:` gets the same `updated:`, so tests that
// are not about the dates see no warning.
const doc = (front: string, body = 'Text') => {
  const created = /^created: (.*)$/m.exec(front)?.[1];
  const full =
    created !== undefined && !/^updated:/m.test(front)
      ? `${front}\nupdated: ${created}`
      : front;
  return `---\npublish: true\n${full}\n---\n${body}`;
};

function article(text: string, file?: string): Article {
  const result = parse(text, file);
  if (result.kind !== 'article') throw new Error(JSON.stringify(result));
  return result.article;
}

describe('reserved page names', () => {
  it('are exactly the routes and folders of the site', () => {
    expect([...RESERVED_PAGE_SLUGS].sort()).toEqual(
      [
        'p',
        'm',
        'g',
        'tag',
        'page',
        'posts',
        'memos',
        'terms',
        'updated',
        'comments',
        'glossary',
        'graph',
        'files',
        'search',
        'media',
        'pagefind',
        'build',
        'feed',
        'sitemap',
        'robots',
        '404',
        'theme-init',
        '_astro',
        'index',
      ].sort(),
    );
  });

  it('skip a page with such a name', () => {
    expect(parse(doc('type: page\nslug: graph'))).toEqual({
      kind: 'skipped',
      warnings: [
        'dir/My Post.md: skipped, "graph" is reserved for the site and cannot be a page',
      ],
    });
  });
});

describe('parseArticle: fields', () => {
  it('takes the file name without .md as title and slug source', () => {
    const a = article(doc('created: 2026-01-02'), 'x/Über uns.MD');
    expect(a.title).toBe('Über uns');
    expect(a.slug).toBe('ueber-uns');
    const b = article(doc('created: 2026-01-02'), 'x/a.md.md');
    expect(b.title).toBe('a.md');
  });

  it('uses a text or number title, trimmed', () => {
    expect(article(doc('title: "  T  "\ncreated: 2026-01-02')).title).toBe('T');
    expect(article(doc('title: 42\ncreated: 2026-01-02')).title).toBe('42');
    expect(article(doc('title: [a]\ncreated: 2026-01-02')).title).toBe(
      'My Post',
    );
  });

  it('uses a given slug, warns about one that is not text', () => {
    expect(article(doc('slug: Eigener Weg\ncreated: 2026-01-02')).slug).toBe(
      'eigener-weg',
    );
    const blank = parse(doc('slug: "  "\ncreated: 2026-01-02'));
    expect(blank).toMatchObject({
      kind: 'article',
      article: { slug: 'my-post' },
      warnings: ['dir/My Post.md: slug is not text, the file name is used'],
    });
    const number = parse(doc('slug: 5\ncreated: 2026-01-02'));
    expect(number).toMatchObject({
      article: { slug: 'my-post' },
      warnings: ['dir/My Post.md: slug is not text, the file name is used'],
    });
  });

  it('skips a file whose slug cannot be built', () => {
    expect(parse(doc('created: 2026-01-02'), '!!!.md')).toEqual({
      kind: 'skipped',
      warnings: ['!!!.md: skipped, no slug can be built from "!!!"'],
    });
  });

  it('warns about an unknown type', () => {
    expect(parse(doc('type: recipe\ncreated: 2026-01-02'))).toMatchObject({
      article: { type: 'post' },
      warnings: [
        'dir/My Post.md: unknown type "recipe", treated as a post (known: glossary)',
      ],
    });
  });

  it('names a missing and an invalid created and updated, but not for pages', () => {
    expect(parse(doc('title: x'))).toMatchObject({
      article: {
        createdSource: 'mtime',
        created: mtime,
        updatedSource: 'mtime',
        updated: mtime,
      },
      warnings: [
        'dir/My Post.md: no created, the modification date of the file is used',
        'dir/My Post.md: no updated, the modification date of the file is used',
      ],
    });
    expect(parse(doc('created: soon\nupdated: 2026-01-02'))).toMatchObject({
      article: { createdSource: 'mtime', updatedSource: 'frontmatter' },
      warnings: [
        'dir/My Post.md: invalid created "soon", the modification date of the file is used',
      ],
    });
    expect(parse(doc('created: 2026-01-02\nupdated: later'))).toMatchObject({
      article: { createdSource: 'frontmatter', updatedSource: 'mtime' },
      warnings: [
        'dir/My Post.md: invalid updated "later", the modification date of the file is used',
      ],
    });
    expect(parse(doc('type: page'))).toMatchObject({
      article: { type: 'page', createdSource: 'mtime', updatedSource: 'mtime' },
      warnings: [],
    });
  });

  it('reads nav: true on a page, ignores and warns everywhere else', () => {
    expect(article(doc('type: page\nnav: true')).nav).toBe(true);
    expect(article(doc('type: page')).nav).toBeUndefined();
    const notTrue = parse(doc('type: page\nnav: "yes"'));
    expect(notTrue).toMatchObject({
      warnings: ['dir/My Post.md: nav must be the boolean true, ignored'],
    });
    expect((notTrue as { article: Article }).article.nav).toBeUndefined();
    const post = parse(doc('nav: true\ncreated: 2026-01-02'));
    expect(post).toMatchObject({
      warnings: [
        'dir/My Post.md: nav is only used for pages (type: page), ignored',
      ],
    });
    expect((post as { article: Article }).article.nav).toBeUndefined();
  });

  it('reads aliases of a glossary entry, drops what is no text, ignores them elsewhere', () => {
    const term = parse(
      doc(
        'type: glossary\naliases: [Sicherung, " Kopie ", 3, Sicherung]\ncreated: 2026-01-02',
      ),
    );
    expect(term).toMatchObject({
      article: { aliases: ['Sicherung', 'Kopie', '3'] },
    });
    const bad = parse(
      doc('type: glossary\naliases: [[x], ""]\ncreated: 2026-01-02'),
    );
    expect((bad as { article: Article }).article.aliases).toBeUndefined();
    expect((bad as { warnings: string[] }).warnings).toHaveLength(2);
    expect(
      article(doc('type: glossary\naliases: Sicherung\ncreated: 2026-01-02'))
        .aliases,
    ).toEqual(['Sicherung']);
    // Obsidian writes aliases on any note: no warning, no effect.
    const post = parse(doc('aliases: [x]\ncreated: 2026-01-02'));
    expect(post).toMatchObject({ warnings: [] });
    expect((post as { article: Article }).article.aliases).toBeUndefined();
  });

  it('reads created and updated separately and no longer reads date', () => {
    const a = article(doc('created: 2026-01-02\nupdated: 2026-03-04 10:00'));
    expect(a.created.toISOString()).toBe('2026-01-02T11:00:00.000Z');
    expect(a.updated.toISOString()).toBe('2026-03-04T09:00:00.000Z');
    const legacy = parse(doc('date: 2026-01-02'));
    expect(legacy).toMatchObject({
      article: { createdSource: 'mtime', updatedSource: 'mtime' },
      warnings: expect.arrayContaining([
        'dir/My Post.md: date is no longer read, use created (and updated)',
      ]),
    });
  });

  it('reads tags from a list or one value, warns about non-text entries', () => {
    expect(article(doc('tags: Eins\ncreated: 2026-01-02')).tags).toEqual([
      'eins',
    ]);
    expect(
      parse(doc('tags: [a, A, 3, "", b]\ncreated: 2026-01-02')),
    ).toMatchObject({
      article: { tags: ['a', 'b'] },
      warnings: ['dir/My Post.md: tag 3 is not text and is ignored'],
    });
    expect(article(doc('created: 2026-01-02')).tags).toEqual([]);
  });

  it('keeps a trimmed description and leaves out an empty one', () => {
    expect(
      article(doc('description: "  d  "\ncreated: 2026-01-02')).description,
    ).toBe('d');
    expect(
      article(doc('description: "  "\ncreated: 2026-01-02')),
    ).not.toHaveProperty('description');
    expect(
      article(doc('description: 5\ncreated: 2026-01-02')),
    ).not.toHaveProperty('description');
  });

  it('keeps a term only for glossary entries', () => {
    expect(
      article(doc('type: glossary\nterm: " API "\ncreated: 2026-01-02')).term,
    ).toBe('API');
    expect(
      article(doc('type: glossary\ncreated: 2026-01-02')),
    ).not.toHaveProperty('term');
  });

  it('skips files with wikilinks outside code only', () => {
    expect(parse(doc('created: 2026-01-02', 'See [[Other]].'))).toEqual({
      kind: 'skipped',
      warnings: [
        'dir/My Post.md: skipped, contains wikilinks ([[...]]); turn off "Use Wikilinks" in Obsidian',
      ],
    });
    for (const body of [
      '`[[a]]`',
      '```\n[[a]]\n```',
      '~~~md\n[[a]]\n~~~\nafter',
      '```\n[[a]]',
      'x ```\n```\n[[a]]\n```',
    ]) {
      expect(parse(doc('created: 2026-01-02', body)).kind, body).toBe(
        'article',
      );
    }
    for (const body of [
      '```\ncode\n```\n[[a]]',
      '`a` [[b]] `c`',
      '```\ncode\n```x\n[[a]]',
    ]) {
      expect(parse(doc('created: 2026-01-02', body)).kind, body).toBe(
        'skipped',
      );
    }
  });
});

describe('parseArticle: what is ignored', () => {
  it('ignores hidden and non-Markdown paths before reading', () => {
    expect(parse(doc('created: 2026-01-02'), '.a/b.md')).toEqual({
      kind: 'ignored',
    });
  });

  it('reports a broken frontmatter only when publish: true is visible', () => {
    const broken = '---\npublish: true\n: :\n  - [\n---\nx';
    expect(parse(broken)).toMatchObject({
      kind: 'skipped',
      warnings: [expect.stringMatching(/^dir\/My Post\.md: skipped, /)],
    });
    expect(parse('---\n: :\n  - [\n---\nx')).toEqual({ kind: 'ignored' });
    expect(parse('---\nxpublish: true\n: [\n---\nx')).toEqual({
      kind: 'ignored',
    });
    expect(parse('---\npublish: truex\n: [\n---\nx')).toEqual({
      kind: 'ignored',
    });
    expect(parse('---\n  publish:  true  \n: [\n---\nx').kind).toBe('skipped');
  });

  it('ignores a file without publish: true', () => {
    expect(parse('---\npublish: "true"\n---\nx')).toEqual({ kind: 'ignored' });
  });
});

describe('assignUniqueSlugs', () => {
  const entry = (slug: string, date: string, file: string): Article => ({
    type: 'post',
    slug,
    title: slug,
    created: new Date(date),
    createdSource: 'frontmatter',
    updated: new Date(date),
    updatedSource: 'frontmatter',
    tags: [],
    body: '',
    path: file,
  });

  it('gives the slug to the older entry, on a tie to the path first in order', () => {
    const { articles, warnings } = assignUniqueSlugs([
      entry('a', '2026-01-02', 'z.md'),
      entry('a', '2026-01-01', 'y.md'),
      entry('a', '2026-01-02', 'b.md'),
      entry('a', '2026-01-02', 'b.md'),
    ]);
    expect(articles.map((a) => [a.path, a.slug])).toEqual([
      ['y.md', 'a'],
      ['b.md', 'a-2'],
      ['b.md', 'a-3'],
      ['z.md', 'a-4'],
    ]);
    expect(warnings).toEqual([
      'b.md: slug "a" is already taken, "a-2" is used',
      'b.md: slug "a" is already taken, "a-3" is used',
      'z.md: slug "a" is already taken, "a-4" is used',
    ]);
  });
});

describe('loadArticles', () => {
  let folder: string;
  beforeEach(async () => {
    folder = await mkdtemp(path.join(os.tmpdir(), 'articles-'));
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  const put = async (file: string, text: string) => {
    await mkdir(path.dirname(path.join(folder, file)), { recursive: true });
    await writeFile(path.join(folder, file), text);
  };

  it('orders newest first, on the same date by path backwards', async () => {
    await put('b.md', doc('created: 2026-01-01'));
    await put('a.md', doc('created: 2026-01-01'));
    await put('c/d.md', doc('created: 2026-02-01'));
    await put('c.md', doc('created: 2026-01-01'));
    const { articles } = await loadArticles(folder);
    expect(articles.map((a) => a.path)).toEqual([
      'c/d.md',
      'c.md',
      'b.md',
      'a.md',
    ]);
  });

  it('keeps slugs apart per type and reports a taken one', async () => {
    await put('x.md', doc('created: 2026-01-01'));
    await put('y/x.md', doc('created: 2026-01-02'));
    await put('g/x.md', doc('type: glossary\ncreated: 2026-01-03'));
    const { articles, warnings } = await loadArticles(folder);
    expect(articles.map((a) => `${a.type}:${a.slug}`)).toEqual([
      'glossary:x',
      'post:x-2',
      'post:x',
    ]);
    expect(warnings).toEqual([
      'y/x.md: slug "x" is already taken, "x-2" is used',
    ]);
  });

  it('skips hidden folders, other files and links, and reports warnings', async () => {
    await put('.hidden/a.md', doc('created: 2026-01-01'));
    await put('notes.txt', 'publish: true');
    await put('draft.md', '---\npublish: false\n---\nx');
    await put('bad.md', doc('', '[[x]]'));
    await put('real.md', doc('created: 2026-01-01'));
    await symlink(path.join(folder, 'real.md'), path.join(folder, 'link.md'));
    await utimes(path.join(folder, 'real.md'), mtime, mtime);
    const { articles, warnings } = await loadArticles(folder);
    expect(articles.map((a) => a.path)).toEqual(['real.md']);
    expect(warnings).toEqual([
      'bad.md: skipped, contains wikilinks ([[...]]); turn off "Use Wikilinks" in Obsidian',
    ]);
  });
});
