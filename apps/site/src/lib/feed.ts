import { buildFeed } from '@muffelblog/core';
import type { FeedItem } from '@muffelblog/core';
import { getContent } from './articles';
import { getSettings } from './settings';

/** The shared feed of articles and memos, newest first. */
export async function getFeed(): Promise<FeedItem[]> {
  const { articles, memos } = await getContent();
  return buildFeed(articles, memos, {
    excerptChars: getSettings().feedExcerptChars,
  });
}

/** The most recent `updated` of the entries, undefined for none. */
export function latestUpdate(items: readonly FeedItem[]): Date | undefined {
  return items.reduce<Date | undefined>(
    (max, item) =>
      max === undefined || item.updated > max ? item.updated : max,
    undefined,
  );
}

/** Page numbers from 2: page 1 lives at the base and is not a route of its own. */
export function restPages(count: number, size: number): number[] {
  const pages = Math.max(1, Math.ceil(count / size));
  return Array.from({ length: pages - 1 }, (_, i) => i + 2);
}

/** Address of the site, once the domain is known (O9). Without it there is no sitemap. */
export function siteUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.SITE_URL || undefined;
}

/** Absolute canonical address. Without a known domain (O9) there is none. */
export function canonicalUrl(
  base: string | undefined,
  pathname: string,
): string | undefined {
  return base ? new URL(pathname, base).href : undefined;
}

export interface SitemapEntry {
  path: string;
  lastmod?: Date;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function sitemapXml(base: string, entries: SitemapEntry[]): string {
  let root: URL;
  try {
    root = new URL(base);
  } catch {
    throw new Error(`SITE_URL is not an address: ${base}`);
  }
  if (root.protocol !== 'https:' && root.protocol !== 'http:') {
    throw new Error(`SITE_URL must start with http:// or https://: ${base}`);
  }
  const origin = root.origin;
  const lines = entries.map((e) => {
    const loc = escapeXml(`${origin}${e.path}`);
    const mod = e.lastmod
      ? `<lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>`
      : '';
    return `  <url><loc>${loc}</loc>${mod}</url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...lines,
    '</urlset>',
    '',
  ].join('\n');
}
