import type { APIRoute } from 'astro';
import { groupByTag } from '@muffelblog/core';
import { getFeed, siteUrl, sitemapXml } from '../lib/feed';

// Without SITE_URL (domain still open, O9) there is no sitemap.
export async function getStaticPaths() {
  return siteUrl() ? [{ params: { sitemap: 'sitemap' } }] : [];
}

export const GET: APIRoute = async () => {
  const base = siteUrl();
  if (!base) return new Response(null, { status: 404 });
  const feed = await getFeed();
  const newest = feed[0]?.date;
  const xml = sitemapXml(base, [
    { path: '/', lastmod: newest },
    { path: '/posts/' },
    { path: '/memos/' },
    { path: '/terms/' },
    { path: '/glossary/' },
    { path: '/tag/' },
    ...groupByTag(feed).map((g) => ({
      path: `/tag/${g.slug}/`,
      lastmod: g.items[0]?.date,
    })),
    ...feed.map((e) => ({ path: e.url, lastmod: e.date })),
  ]);
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
