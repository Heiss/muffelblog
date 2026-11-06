import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseArticle } from './articles.ts';
import { renderMarkdown } from './render.ts';

const guidePath = fileURLToPath(
  new URL('../../../apps/docs/public/authoring.md', import.meta.url),
);

// Validate the copyable files with the real content pipeline, including their
// cross-file link, rather than only checking whether their YAML is parseable.
describe('AI authoring examples', () => {
  it('keeps drafts unpublished and produces valid linked posts and terms when approved', async () => {
    const guide = await readFile(guidePath, 'utf8');
    const samples = [
      ...guide.matchAll(/File: `([^`]+)`\s+```markdown\n([\s\S]*?)\n```/g),
    ];
    expect(samples).toHaveLength(2);
    const articles = samples.map(([, path, text]) => {
      const input = {
        path: path!,
        text: text!,
        mtime: new Date('2026-11-06T12:00:00Z'),
      };
      expect(parseArticle(input)).toEqual({ kind: 'ignored' });
      const published = parseArticle({
        ...input,
        text: text!.replace('publish: false', 'publish: true'),
      });
      expect(published).toMatchObject({ kind: 'article', warnings: [] });
      if (published.kind !== 'article')
        throw new Error('Invalid authoring example');
      return published.article;
    });
    expect(articles.map((a) => [a.type, a.slug, a.comments])).toEqual([
      ['post', 'understanding-caches', true],
      ['glossary', 'cache', false],
    ]);
    expect(articles[1]?.term).toBe('Cache');
    const urls = new Map(
      articles.map((a) => [
        a.path,
        `/${a.type === 'glossary' ? 'g' : 'p'}/${a.slug}/`,
      ]),
    );
    for (const article of articles) {
      const rendered = await renderMarkdown(article.body, {
        articlePath: article.path,
        resolveLink: (path) => urls.get(path),
        resolveImage: async () => {
          throw new Error('Example references an unavailable image');
        },
      });
      expect(rendered.warnings).toEqual([]);
      expect(rendered.html).not.toContain('<h1');
      if (article.type === 'post')
        expect(rendered.html).toContain('href="/g/cache/"');
    }
  });
});
