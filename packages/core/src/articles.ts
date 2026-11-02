import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseDate } from './date.ts';
import { splitFrontmatter } from './frontmatter.ts';
import { normalizeTag, toSlug } from './slug.ts';

export interface Article {
  slug: string;
  title: string;
  date: Date;
  dateSource: 'frontmatter' | 'mtime';
  tags: string[];
  description?: string;
  body: string;
  /** Pfad relativ zum Inhaltsordner, mit `/` als Trenner. */
  path: string;
}

export type ParseResult =
  | { kind: 'ignored' }
  | { kind: 'skipped'; warnings: string[] }
  | { kind: 'article'; article: Article; warnings: string[] };

const KONFLIKTKOPIE = [
  /\(conflicted copy[^)]*\)/i,
  /\(konfliktkopie[^)]*\)/i,
  /\.sync-conflict-/i,
];

/**
 * Pfade, die nie veröffentlicht werden: versteckte Dateien und Ordner
 * (`.obsidian/`, `.trash/`), Konfliktkopien und alles außer Markdown.
 */
export function isIgnoredPath(relPfad: string): boolean {
  const teile = relPfad.split('/');
  if (teile.some((teil) => teil.startsWith('.'))) return true;
  const name = teile[teile.length - 1] ?? '';
  if (!name.toLowerCase().endsWith('.md')) return true;
  return KONFLIKTKOPIE.some((muster) => muster.test(name));
}

function ohneCode(text: string): string {
  return text
    .replace(/^(```|~~~)[\s\S]*?(?:^\1[^\n]*$|(?![\s\S]))/gm, '')
    .replace(/`[^`\n]*`/g, '');
}

function hatWikilink(body: string): boolean {
  return /\[\[[^\]\n]+\]\]/.test(ohneCode(body));
}

function dateiname(relPfad: string): string {
  const name = relPfad.split('/').pop() ?? relPfad;
  return name.replace(/\.md$/i, '').normalize('NFC').trim();
}

export function parseArticle(eingabe: {
  path: string;
  text: string;
  mtime: Date;
}): ParseResult {
  const { path: relPfad, text, mtime } = eingabe;
  if (isIgnoredPath(relPfad)) return { kind: 'ignored' };

  const warnungen: string[] = [];
  const warn = (meldung: string) => warnungen.push(`${relPfad}: ${meldung}`);

  const geteilt = splitFrontmatter(text);
  if (!geteilt.ok) {
    // Nur melden, wenn die Datei erkennbar veröffentlicht werden sollte.
    if (/^\s*publish:\s*true\s*$/m.test(text)) {
      warn(`übersprungen, ${geteilt.error}`);
      return { kind: 'skipped', warnings: warnungen };
    }
    return { kind: 'ignored' };
  }

  const { data, body } = geteilt;
  if (data.publish !== true) return { kind: 'ignored' };

  if (hatWikilink(body)) {
    warn(
      'übersprungen, enthält Wikilinks ([[...]]); in Obsidian "Use Wikilinks" ausschalten',
    );
    return { kind: 'skipped', warnings: warnungen };
  }

  const name = dateiname(relPfad);

  let slugQuelle = name;
  if (data.slug !== undefined) {
    if (typeof data.slug === 'string' && data.slug.trim() !== '') {
      slugQuelle = data.slug;
    } else {
      warn('slug ist kein Text, der Dateiname wird verwendet');
    }
  }
  const slug = toSlug(slugQuelle);
  if (slug === null) {
    warn(`übersprungen, aus "${slugQuelle}" lässt sich kein Slug bilden`);
    return { kind: 'skipped', warnings: warnungen };
  }

  const titelRoh =
    typeof data.title === 'string' || typeof data.title === 'number'
      ? String(data.title).trim()
      : '';
  const title = titelRoh !== '' ? titelRoh : name;
  if (title === '') {
    warn('übersprungen, kein Titel');
    return { kind: 'skipped', warnings: warnungen };
  }

  let date = parseDate(data.date);
  let dateSource: Article['dateSource'] = 'frontmatter';
  if (date === null) {
    warn(
      data.date === undefined
        ? 'kein date, das Änderungsdatum der Datei wird verwendet'
        : `ungültiges date "${String(data.date)}", das Änderungsdatum der Datei wird verwendet`,
    );
    date = new Date(mtime.getTime());
    dateSource = 'mtime';
  }

  const rohTags = Array.isArray(data.tags)
    ? data.tags
    : data.tags === undefined
      ? []
      : [data.tags];
  const tags: string[] = [];
  for (const eintrag of rohTags) {
    if (typeof eintrag !== 'string') {
      warn(`Tag ${JSON.stringify(eintrag)} ist kein Text und wird ignoriert`);
      continue;
    }
    const tag = normalizeTag(eintrag);
    if (tag !== null && !tags.includes(tag)) tags.push(tag);
  }

  const article: Article = {
    slug,
    title,
    date,
    dateSource,
    tags,
    body,
    path: relPfad,
  };
  if (typeof data.description === 'string' && data.description.trim() !== '') {
    article.description = data.description.trim();
  }
  return { kind: 'article', article, warnings: warnungen };
}

/**
 * Vergibt eindeutige Slugs. Der Artikel mit dem älteren Datum (bei Gleichstand
 * der Pfad in Textreihenfolge) behält den Slug, alle weiteren bekommen -2, -3, ...
 * Das Ergebnis ist nach Datum aufsteigend sortiert.
 */
export function assignUniqueSlugs(artikel: Article[]): {
  articles: Article[];
  warnings: string[];
} {
  const sortiert = [...artikel].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  );
  const vergeben = new Set<string>();
  const warnings: string[] = [];
  const articles = sortiert.map((eintrag) => {
    let slug = eintrag.slug;
    for (let n = 2; vergeben.has(slug); n += 1) slug = `${eintrag.slug}-${n}`;
    vergeben.add(slug);
    if (slug !== eintrag.slug) {
      warnings.push(
        `${eintrag.path}: Slug "${eintrag.slug}" ist schon vergeben, verwendet wird "${slug}"`,
      );
    }
    return { ...eintrag, slug };
  });
  return { articles, warnings };
}

async function dateien(wurzel: string, rel = ''): Promise<string[]> {
  const eintraege = await readdir(path.join(wurzel, rel), {
    withFileTypes: true,
  });
  eintraege.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const ergebnis: string[] = [];
  for (const eintrag of eintraege) {
    if (eintrag.name.startsWith('.')) continue;
    const relPfad = rel === '' ? eintrag.name : `${rel}/${eintrag.name}`;
    if (eintrag.isDirectory()) {
      ergebnis.push(...(await dateien(wurzel, relPfad)));
    } else if (eintrag.isFile()) {
      ergebnis.push(relPfad);
    }
  }
  return ergebnis;
}

/** Liest alle veröffentlichbaren Artikel aus einem Ordner, neueste zuerst. */
export async function loadArticles(
  ordner: string,
): Promise<{ articles: Article[]; warnings: string[] }> {
  const warnings: string[] = [];
  const gefunden: Article[] = [];

  for (const relPfad of await dateien(ordner)) {
    if (isIgnoredPath(relPfad)) continue;
    const voll = path.join(ordner, relPfad);
    const [text, info] = await Promise.all([
      readFile(voll, 'utf8'),
      stat(voll),
    ]);
    const ergebnis = parseArticle({ path: relPfad, text, mtime: info.mtime });
    if (ergebnis.kind === 'ignored') continue;
    warnings.push(...ergebnis.warnings);
    if (ergebnis.kind === 'article') gefunden.push(ergebnis.article);
  }

  const eindeutig = assignUniqueSlugs(gefunden);
  warnings.push(...eindeutig.warnings);
  const articles = eindeutig.articles.reverse();
  return { articles, warnings };
}
