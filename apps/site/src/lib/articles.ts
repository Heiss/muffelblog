import {
  createLocalImageResolver,
  loadArticles,
  renderMarkdown,
} from '@muffelblog/core';
import type { Article } from '@muffelblog/core';
import { contentDir } from './content';

export interface RenderedArticle extends Article {
  html: string;
}

interface Content {
  articles: RenderedArticle[];
  /** Erzeugte Bilddateien: Dateiname zu Inhalt. */
  media: Map<string, Buffer>;
}

async function build(): Promise<Content> {
  const root = contentDir();
  const { articles, warnings } = await loadArticles(root);
  const resolver = createLocalImageResolver({ root, urlPrefix: '/media/' });

  const rendered: RenderedArticle[] = [];
  for (const article of articles) {
    const result = await renderMarkdown(article.body, {
      articlePath: article.path,
      resolveImage: resolver.resolve,
    });
    warnings.push(...result.warnings);
    rendered.push({ ...article, html: result.html });
  }
  for (const warnung of warnings) console.warn(`[inhalt] ${warnung}`);
  return { articles: rendered, media: resolver.files() };
}

let inhalt: Promise<Content> | undefined;

/** Liest und rendert den Inhaltsordner einmal pro Build. */
export function getContent(): Promise<Content> {
  inhalt ??= build();
  return inhalt;
}
