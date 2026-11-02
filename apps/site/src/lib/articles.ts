import {
  buildMemoEntries,
  createLocalImageResolver,
  loadArticles,
  renderMarkdown,
} from '@muffelblog/core';
import type { Article, MemoEntry } from '@muffelblog/core';
import { contentConfig } from './content';

export interface RenderedArticle extends Article {
  html: string;
}

interface Content {
  articles: RenderedArticle[];
  memos: MemoEntry[];
  /** Erzeugte Mediendateien: Dateiname zu Inhalt (Bilder, PDF, Audio, Video). */
  media: Map<string, Buffer>;
}

async function build(): Promise<Content> {
  const config = contentConfig();
  const media = new Map<string, Buffer>();

  const { articles, warnings } = await loadArticles(config.contentDir);
  const resolver = createLocalImageResolver({
    root: config.contentDir,
    urlPrefix: '/media/',
    store: media,
  });

  const rendered: RenderedArticle[] = [];
  for (const article of articles) {
    const result = await renderMarkdown(article.body, {
      articlePath: article.path,
      resolveImage: resolver.resolve,
    });
    warnings.push(...result.warnings);
    rendered.push({ ...article, html: result.html });
  }

  // Scheitert der Abruf der Memos, bricht der Build ab und die letzte gute Version bleibt online.
  const memoErgebnis = await buildMemoEntries(config.memos, media);
  warnings.push(...memoErgebnis.warnings);

  for (const warnung of warnings) console.warn(`[inhalt] ${warnung}`);
  return { articles: rendered, memos: memoErgebnis.memos, media };
}

let inhalt: Promise<Content> | undefined;

/** Liest und rendert Artikel und Memos einmal pro Build. */
export function getContent(): Promise<Content> {
  inhalt ??= build();
  return inhalt;
}
