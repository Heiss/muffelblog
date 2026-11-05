import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseDate } from './date.ts';
import { splitFrontmatter } from './frontmatter.ts';
import { normalizeTag, toSlug } from './slug.ts';

export type ArticleType = 'post' | 'glossary' | 'page';

/**
 * Names a static page must not take: they are routes or folders of the site.
 * Pages live at the root (`/<slug>/`), so these would shadow the real routes.
 */
export const RESERVED_PAGE_SLUGS: ReadonlySet<string> = new Set([
  'p',
  'm',
  'g',
  'tag',
  'page',
  'posts',
  'memos',
  'terms',
  'glossary',
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
]);

export interface Article {
  /** `glossary` for a term (frontmatter `type: glossary`), otherwise `post`. */
  type: ArticleType;
  slug: string;
  title: string;
  /** Glossary only: the term itself (`term:`), when the title is a question. */
  term?: string;
  date: Date;
  dateSource: 'frontmatter' | 'mtime';
  tags: string[];
  description?: string;
  body: string;
  /** Path relative to the content folder, with `/` as the separator. */
  path: string;
}

export type ParseResult =
  | { kind: 'ignored' }
  | { kind: 'skipped'; warnings: string[] }
  | { kind: 'article'; article: Article; warnings: string[] };

// Nextcloud names conflict copies after the UI language, so both forms occur.
const CONFLICT_COPY = [
  /\(conflicted copy[^)]*\)/i,
  /\(konfliktkopie[^)]*\)/i,
  /\.sync-conflict-/i,
];

/**
 * Paths that are never published: hidden files and folders (`.obsidian/`,
 * `.trash/`), conflict copies and everything except Markdown.
 */
export function isIgnoredPath(relPath: string): boolean {
  const parts = relPath.split('/');
  if (parts.some((part) => part.startsWith('.'))) return true;
  const name = parts[parts.length - 1] ?? '';
  if (!name.toLowerCase().endsWith('.md')) return true;
  return CONFLICT_COPY.some((pattern) => pattern.test(name));
}

function withoutCode(text: string): string {
  return text
    .replace(/^(```|~~~)[\s\S]*?(?:^\1[^\n]*$|(?![\s\S]))/gm, '')
    .replace(/`[^`\n]*`/g, '');
}

function hasWikilink(body: string): boolean {
  return /\[\[[^\]\n]+\]\]/.test(withoutCode(body));
}

function fileName(relPath: string): string {
  const name = relPath.split('/').pop() ?? relPath;
  return name.replace(/\.md$/i, '').normalize('NFC').trim();
}

export function parseArticle(input: {
  path: string;
  text: string;
  mtime: Date;
}): ParseResult {
  const { path: relPath, text, mtime } = input;
  if (isIgnoredPath(relPath)) return { kind: 'ignored' };

  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(`${relPath}: ${message}`);

  const split = splitFrontmatter(text);
  if (!split.ok) {
    // Only report if the file was clearly meant to be published.
    if (/^\s*publish:\s*true\s*$/m.test(text)) {
      warn(`skipped, ${split.error}`);
      return { kind: 'skipped', warnings };
    }
    return { kind: 'ignored' };
  }

  const { data, body } = split;
  if (data.publish !== true) return { kind: 'ignored' };

  if (hasWikilink(body)) {
    warn(
      'skipped, contains wikilinks ([[...]]); turn off "Use Wikilinks" in Obsidian',
    );
    return { kind: 'skipped', warnings };
  }

  const name = fileName(relPath);

  let slugSource = name;
  if (data.slug !== undefined) {
    if (typeof data.slug === 'string' && data.slug.trim() !== '') {
      slugSource = data.slug;
    } else {
      warn('slug is not text, the file name is used');
    }
  }
  const slug = toSlug(slugSource);
  if (slug === null) {
    warn(`skipped, no slug can be built from "${slugSource}"`);
    return { kind: 'skipped', warnings };
  }

  let type: ArticleType = 'post';
  if (data.type === 'glossary') {
    type = 'glossary';
  } else if (data.type === 'page') {
    type = 'page';
    if (RESERVED_PAGE_SLUGS.has(slug)) {
      warn(`skipped, "${slug}" is reserved for the site and cannot be a page`);
      return { kind: 'skipped', warnings };
    }
  } else if (data.type !== undefined) {
    warn(
      `unknown type ${JSON.stringify(data.type)}, treated as a post (known: glossary)`,
    );
  }

  const rawTitle =
    typeof data.title === 'string' || typeof data.title === 'number'
      ? String(data.title).trim()
      : '';
  const title = rawTitle !== '' ? rawTitle : name;
  if (title === '') {
    warn('skipped, no title');
    return { kind: 'skipped', warnings };
  }

  let date = parseDate(data.date);
  let dateSource: Article['dateSource'] = 'frontmatter';
  if (date === null && type === 'page') {
    // A static page has no place in time; the date is only a placeholder.
    date = new Date(mtime.getTime());
    dateSource = 'mtime';
  } else if (date === null) {
    warn(
      data.date === undefined
        ? 'no date, the modification date of the file is used'
        : `invalid date "${String(data.date)}", the modification date of the file is used`,
    );
    date = new Date(mtime.getTime());
    dateSource = 'mtime';
  }

  const rawTags = Array.isArray(data.tags)
    ? data.tags
    : data.tags === undefined
      ? []
      : [data.tags];
  const tags: string[] = [];
  for (const entry of rawTags) {
    if (typeof entry !== 'string') {
      warn(`tag ${JSON.stringify(entry)} is not text and is ignored`);
      continue;
    }
    const tag = normalizeTag(entry);
    if (tag !== null && !tags.includes(tag)) tags.push(tag);
  }

  const article: Article = {
    type,
    slug,
    title,
    date,
    dateSource,
    tags,
    body,
    path: relPath,
  };
  if (typeof data.description === 'string' && data.description.trim() !== '') {
    article.description = data.description.trim();
  }
  if (data.term !== undefined) {
    const term =
      typeof data.term === 'string' || typeof data.term === 'number'
        ? String(data.term).trim()
        : '';
    if (type !== 'glossary') {
      warn('term is only used for glossary entries (type: glossary), ignored');
    } else if (term === '') {
      warn('term is empty or not text, the title is used as the term');
    } else {
      article.term = term;
    }
  }
  return { kind: 'article', article, warnings };
}

/**
 * Assigns unique slugs. The article with the older date (on a tie, the path in
 * text order) keeps the slug, all others get -2, -3, ...
 * The result is sorted by date, ascending.
 */
export function assignUniqueSlugs(articles: Article[]): {
  articles: Article[];
  warnings: string[];
} {
  const sorted = [...articles].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  );
  const taken = new Set<string>();
  const warnings: string[] = [];
  const result = sorted.map((entry) => {
    let slug = entry.slug;
    for (let n = 2; taken.has(slug); n += 1) slug = `${entry.slug}-${n}`;
    taken.add(slug);
    if (slug !== entry.slug) {
      warnings.push(
        `${entry.path}: slug "${entry.slug}" is already taken, "${slug}" is used`,
      );
    }
    return { ...entry, slug };
  });
  return { articles: result, warnings };
}

async function listFiles(root: string, rel = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, rel), {
    withFileTypes: true,
  });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const result: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const relPath = rel === '' ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      result.push(...(await listFiles(root, relPath)));
    } else if (entry.isFile()) {
      result.push(relPath);
    }
  }
  return result;
}

/** Reads all publishable articles from a folder, newest first. */
export async function loadArticles(
  folder: string,
): Promise<{ articles: Article[]; warnings: string[] }> {
  const warnings: string[] = [];
  const found: Article[] = [];

  for (const relPath of await listFiles(folder)) {
    if (isIgnoredPath(relPath)) continue;
    const full = path.join(folder, relPath);
    const [text, info] = await Promise.all([
      readFile(full, 'utf8'),
      stat(full),
    ]);
    const result = parseArticle({ path: relPath, text, mtime: info.mtime });
    if (result.kind === 'ignored') continue;
    warnings.push(...result.warnings);
    if (result.kind === 'article') found.push(result.article);
  }

  // Slugs are unique per type: /p/ and /g/ are separate namespaces.
  const merged: Article[] = [];
  for (const type of ['post', 'glossary', 'page'] as const) {
    const unique = assignUniqueSlugs(found.filter((a) => a.type === type));
    warnings.push(...unique.warnings);
    merged.push(...unique.articles);
  }
  const articles = merged.sort(
    (a, b) =>
      b.date.getTime() - a.date.getTime() ||
      (a.path < b.path ? 1 : a.path > b.path ? -1 : 0),
  );
  return { articles, warnings };
}
