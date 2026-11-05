import type { ArticleType } from './articles.ts';

/** A published Markdown file in the tree, linked to its page. */
export interface TreeFile {
  /** File name as in the Nextcloud folder, for example `hello-world.md`. */
  name: string;
  title: string;
  url: string;
}

export interface TreeFolder {
  name: string;
  folders: TreeFolder[];
  files: TreeFile[];
  /** Files in this folder and all subfolders. */
  count: number;
}

interface TreeInput {
  /** Path relative to the content folder, with `/`. */
  path: string;
  type: ArticleType;
  slug: string;
  title: string;
}

const collator = new Intl.Collator('de', {
  sensitivity: 'base',
  numeric: true,
});

function urlOf(a: TreeInput): string {
  if (a.type === 'glossary') return `/g/${a.slug}/`;
  if (a.type === 'page') return `/${a.slug}/`;
  return `/p/${a.slug}/`;
}

/**
 * The folder structure of the published files (posts, terms, static pages), as
 * in the Nextcloud folder. Only published files are in it, so drafts and their
 * names stay hidden; folders without a published file do not appear.
 */
export function buildFileTree(articles: readonly TreeInput[]): TreeFolder {
  const root: TreeFolder = { name: '', folders: [], files: [], count: 0 };
  for (const article of articles) {
    const parts = article.path.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) continue;
    let folder = root;
    folder.count++;
    for (const part of parts) {
      let next = folder.folders.find((f) => f.name === part);
      if (!next) {
        next = { name: part, folders: [], files: [], count: 0 };
        folder.folders.push(next);
      }
      next.count++;
      folder = next;
    }
    folder.files.push({
      name: fileName,
      title: article.title,
      url: urlOf(article),
    });
  }
  const sort = (f: TreeFolder): TreeFolder => ({
    ...f,
    folders: [...f.folders]
      .sort((a, b) => collator.compare(a.name, b.name))
      .map(sort),
    files: [...f.files].sort((a, b) => collator.compare(a.name, b.name)),
  });
  return sort(root);
}
