import {
  buildMemoEntries,
  createHeifConverter,
  createTermMatcher,
  createLocalImageResolver,
  heifAvailable,
  loadArticles,
  renderMarkdown,
} from '@muffelblog/core';
import type {
  Article,
  GlossaryLinking,
  MemoEntry,
  TermMatcher,
} from '@muffelblog/core';
import { contentConfig } from './content';
import { getSettings } from './settings';

export interface RenderedArticle extends Article {
  html: string;
}

interface Content {
  articles: RenderedArticle[];
  memos: MemoEntry[];
  /** Generated media files: file name to content (images, PDF, audio, video). */
  media: Map<string, Buffer>;
}

/** Links between files of the folder lead to the pages of published files (W20). */
function pageAddresses(articles: Article[]): Map<string, string> {
  return new Map(
    articles.map((a) => [
      a.path.normalize('NFC'),
      a.type === 'glossary'
        ? `/g/${a.slug}/`
        : a.type === 'page'
          ? `/${a.slug}/`
          : `/p/${a.slug}/`,
    ]),
  );
}

/**
 * Every glossary term (its `term:` or title, and `aliases:`) is linked on its
 * first mention in posts, memos and other terms.
 */
function glossaryMatcher(articles: Article[]): TermMatcher | null {
  return createTermMatcher(
    articles
      .filter((a) => a.type === 'glossary')
      .map((a) => ({
        slug: a.slug,
        names: [a.term ?? a.title, ...(a.aliases ?? [])],
        description: a.description,
      })),
  );
}

/** Pages (imprint and so on) are left alone; a term never links to itself. */
function glossaryFor(
  article: Article,
  matcher: TermMatcher | null,
): GlossaryLinking | undefined {
  if (article.type === 'page') return undefined;
  return {
    matcher,
    self: article.type === 'glossary' ? article.slug : undefined,
  };
}

async function build(): Promise<Content> {
  const config = contentConfig();
  const media = new Map<string, Buffer>();

  // HEIC photos need heif-convert (the builder image has it); without it they
  // are reported and skipped.
  const convertHeic = (await heifAvailable())
    ? createHeifConverter()
    : undefined;

  const { articles, warnings } = await loadArticles(config.contentDir);
  const resolver = createLocalImageResolver({
    convertHeic,
    root: config.contentDir,
    urlPrefix: '/media/',
    store: media,
  });

  const pageOf = pageAddresses(articles);
  const matcher = glossaryMatcher(articles);

  const rendered: RenderedArticle[] = [];
  for (const article of articles) {
    const result = await renderMarkdown(article.body, {
      articlePath: article.path,
      resolveImage: resolver.resolve,
      resolveLink: (p) => pageOf.get(p),
      glossary: glossaryFor(article, matcher),
      lang: getSettings().lang,
    });
    warnings.push(...result.warnings);
    rendered.push({ ...article, html: result.html });
  }

  // If fetching the memos fails, the build stops and the last good version stays online.
  const memoResult = await buildMemoEntries(config.memos, media, {
    convertHeic,
    maxFileBytes: getSettings().memosMaxFileBytes,
    descriptionChars: getSettings().memosDescriptionChars,
    lang: getSettings().lang,
    glossary: { matcher },
  });
  warnings.push(...memoResult.warnings);

  for (const warning of warnings) console.warn(`[content] ${warning}`);
  return { articles: rendered, memos: memoResult.memos, media };
}

let content: Promise<Content> | undefined;

/** Reads and renders articles and memos once per build. */
export function getContent(): Promise<Content> {
  content ??= build();
  return content;
}
