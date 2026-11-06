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
const doc = (front: string, body = 'Text') =>
  `---\npublish: true\n${front}\n---\n${body}`;

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
    const a = article(doc('date: 2026-01-02'), 'x/Über uns.MD');
    expect(a.title).toBe('Über uns');
    expect(a.slug).toBe('ueber-uns');
    const b = article(doc('date: 2026-01-02'), 'x/a.md.md');
    expect(b.title).toBe('a.md');
  });

  it('uses a text or number title, trimmed', () => {
    expect(article(doc('title: "  T  "\ndate: 2026-01-02')).title).toBe('T');
    expect(article(doc('title: 42\ndate: 2026-01-02')).title).toBe('42');
    expect(article(doc('title: [a]\ndate: 2026-01-02')).title).toBe('My Post');
  });

  it('uses a given slug, warns about one that is not text', () => {
    expect(article(doc('slug: Eigener Weg\ndate: 2026-01-02')).slug).toBe(
      'eigener-weg',
    );
    const blank = parse(doc('slug: "  "\ndate: 2026-01-02'));
    expect(blank).toMatchObject({
      kind: 'article',
      article: { slug: 'my-post' },
      warnings: ['dir/My Post.md: slug is not text, the file name is used'],
    });
    const number = parse(doc('slug: 5\ndate: 2026-01-02'));
    expect(number).toMatchObject({
      article: { slug: 'my-post' },
      warnings: ['dir/My Post.md: slug is not text, the file name is used'],
    });
  });

  it('skips a file whose slug cannot be built', () => {
    expect(parse(doc('date: 2026-01-02'), '!!!.md')).toEqual({
      kind: 'skipped',
      warnings: ['!!!.md: skipped, no slug can be built from "!!!"'],
    });
  });

  it('warns about an unknown type', () => {
    expect(parse(doc('type: recipe\ndate: 2026-01-02'))).toMatchObject({
      article: { type: 'post' },
      warnings: [
        'dir/My Post.md: unknown type "recipe", treated as a post (known: glossary)',
      ],
    });
  });

  it('names a missing and an invalid date, but not for pages', () => {
    expect(parse(doc('title: x'))).toMatchObject({
      article: { dateSource: 'mtime', date: mtime },
      warnings: [
        'dir/My Post.md: no date, the modification date of the file is used',
      ],
    });
    expect(parse(doc('date: soon'))).toMatchObject({
      warnings: [
        'dir/My Post.md: invalid date "soon", the modification date of the file is used',
      ],
    });
    expect(parse(doc('type: page'))).toMatchObject({
      article: { type: 'page', dateSource: 'mtime' },
      warnings: [],
    });
    const a = article(doc('title: x'));
    expect(a.date).not.toBe(mtime);
  });

  it('reads tags from a list or one value, warns about non-text entries', () => {
    expect(article(doc('tags: Eins\ndate: 2026-01-02')).tags).toEqual(['eins']);
    expect(
      parse(doc('tags: [a, A, 3, "", b]\ndate: 2026-01-02')),
    ).toMatchObject({
      article: { tags: ['a', 'b'] },
      warnings: ['dir/My Post.md: tag 3 is not text and is ignored'],
    });
    expect(article(doc('date: 2026-01-02')).tags).toEqual([]);
  });

  it('keeps a trimmed description and leaves out an empty one', () => {
    expect(
      article(doc('description: "  d  "\ndate: 2026-01-02')).description,
    ).toBe('d');
    expect(
      article(doc('description: "  "\ndate: 2026-01-02')),
    ).not.toHaveProperty('description');
    expect(article(doc('description: 5\ndate: 2026-01-02'))).not.toHaveProperty(
      'description',
    );
  });

  it('keeps a term only for glossary entries', () => {
    expect(
      article(doc('type: glossary\nterm: " API "\ndate: 2026-01-02')).term,
    ).toBe('API');
    expect(article(doc('type: glossary\ndate: 2026-01-02'))).not.toHaveProperty(
      'term',
    );
  });

  it('skips files with wikilinks outside code only', () => {
    expect(parse(doc('date: 2026-01-02', 'See [[Other]].'))).toEqual({
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
      expect(parse(doc('date: 2026-01-02', body)).kind, body).toBe('article');
    }
    for (const body of [
      '```\ncode\n```\n[[a]]',
      '`a` [[b]] `c`',
      '```\ncode\n```x\n[[a]]',
    ]) {
      expect(parse(doc('date: 2026-01-02', body)).kind, body).toBe('skipped');
    }
  });
});

describe('parseArticle: what is ignored', () => {
  it('ignores hidden and non-Markdown paths before reading', () => {
    expect(parse(doc('date: 2026-01-02'), '.a/b.md')).toEqual({
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
    date: new Date(date),
    dateSource: 'frontmatter',
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
    await put('b.md', doc('date: 2026-01-01'));
    await put('a.md', doc('date: 2026-01-01'));
    await put('c/d.md', doc('date: 2026-02-01'));
    await put('c.md', doc('date: 2026-01-01'));
    const { articles } = await loadArticles(folder);
    expect(articles.map((a) => a.path)).toEqual([
      'c/d.md',
      'c.md',
      'b.md',
      'a.md',
    ]);
  });

  it('keeps slugs apart per type and reports a taken one', async () => {
    await put('x.md', doc('date: 2026-01-01'));
    await put('y/x.md', doc('date: 2026-01-02'));
    await put('g/x.md', doc('type: glossary\ndate: 2026-01-03'));
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
    await put('.hidden/a.md', doc('date: 2026-01-01'));
    await put('notes.txt', 'publish: true');
    await put('draft.md', '---\npublish: false\n---\nx');
    await put('bad.md', doc('', '[[x]]'));
    await put('real.md', doc('date: 2026-01-01'));
    await symlink(path.join(folder, 'real.md'), path.join(folder, 'link.md'));
    await utimes(path.join(folder, 'real.md'), mtime, mtime);
    const { articles, warnings } = await loadArticles(folder);
    expect(articles.map((a) => a.path)).toEqual(['real.md']);
    expect(warnings).toEqual([
      'bad.md: skipped, contains wikilinks ([[...]]); turn off "Use Wikilinks" in Obsidian',
    ]);
  });
});

describe('comments frontmatter', () => {
  it('defaults to enabled and accepts explicit booleans for posts and terms', () => {
    expect(article(doc('date: 2026-01-02')).comments).toBeUndefined();
    expect(article(doc('date: 2026-01-02\ncomments: false')).comments).toBe(
      false,
    );
    expect(article(doc('date: 2026-01-02\ncomments: true')).comments).toBe(
      true,
    );
    expect(
      article(doc('date: 2026-01-02\ntype: glossary\ncomments: false'))
        .comments,
    ).toBe(false);
  });
  it('warns about ambiguous settings instead of treating text as a boolean', () => {
    for (const value of ['"false"', 'no', '0', 'null', '[]']) {
      const result = parse(doc(`date: 2026-01-02\ncomments: ${value}`));
      expect(result).toMatchObject({
        kind: 'article',
        warnings: [expect.stringContaining('comments must be a boolean')],
      });
      if (result.kind === 'article')
        expect(result.article.comments).toBeUndefined();
    }
  });
});
