import {
  buildMemoEntries,
  createHeifConverter,
  createLocalImageResolver,
  heifAvailable,
  loadArticles,
  renderMarkdown,
} from '@muffelblog/core';
import type { Article, MemoEntry } from '@muffelblog/core';
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

  const rendered: RenderedArticle[] = [];
  for (const article of articles) {
    const result = await renderMarkdown(article.body, {
      articlePath: article.path,
      resolveImage: resolver.resolve,
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
