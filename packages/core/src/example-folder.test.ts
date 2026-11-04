import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadArticles } from './articles.ts';
import { createLocalImageResolver } from './media.ts';
import { renderMarkdown } from './render.ts';

// The example folder (examples/nextcloud-folder) is the starting point of the
// tutorial. It must always load and render without warnings, and the legal
// texts must stay templates: every personal detail is a marked placeholder.
const folder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'examples',
  'nextcloud-folder',
);

describe('example Nextcloud folder', () => {
  it('loads without warnings: one post, one term, two pages, the README ignored', async () => {
    const { articles, warnings } = await loadArticles(folder);
    expect(warnings).toEqual([]);
    expect(articles.map((a) => `${a.type}:${a.slug}`).sort()).toEqual([
      'glossary:webmention',
      'page:legal',
      'page:privacy',
      'post:hello-world',
    ]);
  });

  it('renders every file without warnings and finds the local image', async () => {
    const { articles } = await loadArticles(folder);
    const resolver = createLocalImageResolver({
      root: folder,
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
    expect(images).toBe(1);
  });

  it('gives the post what the tutorial needs: a date, tags, a description, an external link and a link to the term', async () => {
    const { articles } = await loadArticles(folder);
    const post = articles.find((a) => a.slug === 'hello-world');
    expect(post?.dateSource).toBe('frontmatter');
    expect(post?.tags).toEqual(['welcome', 'indieweb']);
    expect(post?.description?.length).toBeGreaterThan(20);
    expect(post?.body).toMatch(/\]\(https:\/\/indieweb\.org\//);
    expect(post?.body).toContain('](/g/webmention/)');
  });

  it('keeps the legal pages as templates: placeholders everywhere, no real data', async () => {
    for (const name of ['legal', 'privacy']) {
      const text = await readFile(
        path.join(folder, 'pages', `${name}.md`),
        'utf8',
      );
      expect(text, name).toMatch(/Template, not legal advice/);
      expect(text, name).toMatch(/\[YOUR FULL NAME\]/);
      expect(text, name).toMatch(/\[YOUR EMAIL ADDRESS\]/);
      // Outside the placeholders there is no email address, phone number or
      // street number that could be mistaken for real data.
      const bare = text.replace(/\[[^\]]*\]/g, '');
      expect(bare, name).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(bare, name).not.toMatch(/\+?\d[\d\s/-]{7,}\d/);
    }
  });

  it('names the checks of the privacy policy and the optional sections', async () => {
    const text = await readFile(
      path.join(folder, 'pages', 'privacy.md'),
      'utf8',
    );
    expect(text).toMatch(/\[CHECK: /);
    expect(text).toMatch(/\[DELETE this section if/);
  });
});
