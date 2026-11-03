import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadArticles } from './articles.ts';
import { splitFrontmatter } from './frontmatter.ts';
import { createLocalImageResolver } from './media.ts';
import { buildMemoEntries, createFixtureMemosSource } from './memos.ts';
import { renderMarkdown } from './render.ts';

// The demo set is realistic sample content (IT, photography, timber
// construction) for screenshots and development. The edge-case fixtures stay
// in ../fixtures/content and ../fixtures/memos.
const demo = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'demo',
);
const content = path.join(demo, 'content');
const TOPICS = ['it', 'fotografie', 'holzbau'] as const;

async function termFiles(): Promise<string[]> {
  const names = await readdir(path.join(content, 'glossar'));
  return names.filter((n) => n.endsWith('.md')).sort();
}

describe('demo set: articles and terms', () => {
  it('has 9 articles and 15 glossary terms, all publishable, without warnings', async () => {
    const { articles, warnings } = await loadArticles(content);
    expect(warnings).toEqual([]);
    expect(articles.filter((a) => a.type !== 'page')).toHaveLength(24);
    expect((await termFiles()).length).toBe(15);
  });

  it('has 3 articles and 5 terms per topic', async () => {
    const { articles } = await loadArticles(content);
    const terms = new Set((await termFiles()).map((n) => `glossar/${n}`));
    for (const topic of TOPICS) {
      const mine = articles.filter((a) => a.tags.includes(topic));
      expect(
        mine.filter((a) => !terms.has(a.path)),
        `${topic}: articles`,
      ).toHaveLength(3);
      expect(
        mine.filter((a) => terms.has(a.path)),
        `${topic}: terms`,
      ).toHaveLength(5);
    }
  });

  it('marks every glossary term with type: glossary and a short definition', async () => {
    for (const name of await termFiles()) {
      const raw = await readFile(path.join(content, 'glossar', name), 'utf8');
      const split = splitFrontmatter(raw);
      expect(split.ok, name).toBe(true);
      if (!split.ok) continue;
      expect(split.data.type, name).toBe('glossary');
      expect(split.data.publish, name).toBe(true);
      expect(String(split.data.description ?? '').length, name).toBeGreaterThan(
        30,
      );
    }
  });

  it('has unique slugs and dates that spread over several months', async () => {
    const loaded = await loadArticles(content);
    // Static pages have no date of their own.
    const articles = loaded.articles.filter((a) => a.type !== 'page');
    expect(new Set(articles.map((a) => a.slug)).size).toBe(articles.length);
    const months = new Set(
      articles.map((a) => a.date.toISOString().slice(0, 7)),
    );
    expect(months.size).toBeGreaterThanOrEqual(3);
    for (const a of articles) expect(a.dateSource, a.path).toBe('frontmatter');
  });

  it('renders every article without warnings, with all local images found', async () => {
    const { articles } = await loadArticles(content);
    const resolver = createLocalImageResolver({
      root: content,
      urlPrefix: '/media/',
    });
    let images = 0;
    for (const article of articles) {
      const result = await renderMarkdown(article.body, {
        articlePath: article.path,
        resolveImage: resolver.resolve,
      });
      expect(result.warnings, article.path).toEqual([]);
      images += (result.html.match(/<img /g) ?? []).length;
    }
    expect(images).toBeGreaterThanOrEqual(6);
  });
});

describe('demo set: memos', () => {
  it('has 9 memos, 3 per topic, without warnings', async () => {
    const source = createFixtureMemosSource(path.join(demo, 'memos'));
    const { memos, warnings } = await buildMemoEntries(
      source,
      new Map<string, Buffer>(),
    );
    expect(warnings).toEqual([]);
    expect(memos).toHaveLength(9);
    for (const topic of TOPICS) {
      expect(
        memos.filter((m) => m.tags.includes(topic)),
        topic,
      ).toHaveLength(3);
    }
    expect(memos.filter((m) => m.html.includes('<img ')).length).toBe(3);
  });
});
