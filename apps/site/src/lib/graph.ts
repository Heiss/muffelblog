import { buildGraph, type LinkGraph } from '@muffelblog/core';
import { getContent } from './articles';
import { siteUrl } from './feed';

let graph: Promise<LinkGraph> | undefined;

/** The link graph of all posts, terms and memos, once per build. */
export function getGraph(): Promise<LinkGraph> {
  graph ??= (async () => {
    const { articles, memos } = await getContent();
    return buildGraph(
      [
        ...articles
          .filter((a) => a.type !== 'page')
          .map((a) => ({
            url: a.type === 'glossary' ? `/g/${a.slug}/` : `/p/${a.slug}/`,
            title: a.term ?? a.title,
            kind:
              a.type === 'glossary' ? ('glossary' as const) : ('post' as const),
            html: a.html,
          })),
        ...memos.map((m) => ({
          url: `/m/${m.uid}/`,
          title: m.title,
          kind: 'memo' as const,
          html: m.html,
        })),
      ],
      siteUrl(),
    );
  })();
  return graph;
}
