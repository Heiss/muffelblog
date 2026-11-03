import { PAGE_SIZE, buildFeed } from '@muffelblog/core';
import type { FeedItem } from '@muffelblog/core';
import { getContent } from './articles';

/** Der gemeinsame Feed aus Artikeln und Memos, neueste zuerst. */
export async function getFeed(): Promise<FeedItem[]> {
  const { articles, memos } = await getContent();
  return buildFeed(articles, memos);
}

/**
 * Einträge pro Block. Eine kleinere Größe gilt nur mit Beispieldaten
 * (`MUFFEL_FIXTURES=1`), damit E2E-Tests mehrere Blöcke sehen. Ein Build mit
 * echten Inhalten ignoriert sie.
 */
export function pageSize(
  env: Record<string, string | undefined> = process.env,
): number {
  if (env.MUFFEL_FIXTURES !== '1') return PAGE_SIZE;
  const wert = env.MUFFEL_PAGE_SIZE;
  if (wert === undefined || !/^[1-9]\d*$/.test(wert)) return PAGE_SIZE;
  return Number(wert);
}

/** Seitenzahlen ab 2: Seite 1 liegt an der Basis und ist keine eigene Route. */
export function restSeiten(anzahl: number, size: number): number[] {
  const seiten = Math.max(1, Math.ceil(anzahl / size));
  return Array.from({ length: seiten - 1 }, (_, i) => i + 2);
}

/** Adresse der Seite, sobald die Domain feststeht (O9). Ohne sie gibt es keine Sitemap. */
export function siteUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.SITE_URL || undefined;
}

/** Absolute Canonical-Adresse. Ohne bekannte Domain (O9) gibt es keine. */
export function canonicalUrl(
  base: string | undefined,
  pathname: string,
): string | undefined {
  return base ? new URL(pathname, base).href : undefined;
}

export interface SitemapEintrag {
  path: string;
  lastmod?: Date;
}

function maskiere(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function sitemapXml(base: string, eintraege: SitemapEintrag[]): string {
  let wurzel: URL;
  try {
    wurzel = new URL(base);
  } catch {
    throw new Error(`SITE_URL ist keine Adresse: ${base}`);
  }
  if (wurzel.protocol !== 'https:' && wurzel.protocol !== 'http:') {
    throw new Error(
      `SITE_URL muss mit http:// oder https:// beginnen: ${base}`,
    );
  }
  const origin = wurzel.origin;
  const zeilen = eintraege.map((e) => {
    const loc = maskiere(`${origin}${e.path}`);
    const mod = e.lastmod
      ? `<lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>`
      : '';
    return `  <url><loc>${loc}</loc>${mod}</url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...zeilen,
    '</urlset>',
    '',
  ].join('\n');
}
