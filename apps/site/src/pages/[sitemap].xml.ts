import type { APIRoute } from 'astro';
import { groupByTag } from '@muffelblog/core';
import { getContent } from '../lib/articles';
import { getFeed, latestUpdate, siteUrl, sitemapXml } from '../lib/feed';

// Without SITE_URL (domain still open, O9) there is no sitemap.
export async function getStaticPaths() {
  return siteUrl() ? [{ params: { sitemap: 'sitemap' } }] : [];
}

export const GET: APIRoute = async () => {
  const base = siteUrl();
  if (!base) return new Response(null, { status: 404 });
  const feed = await getFeed();
  const { articles } = await getContent();
  const newest = latestUpdate(feed);
  const xml = sitemapXml(base, [
    { path: '/', lastmod: newest },
    { path: '/posts/' },
    { path: '/memos/' },
    { path: '/terms/' },
    { path: '/glossary/' },
    { path: '/tag/' },
    ...groupByTag(feed).map((g) => ({
      path: `/tag/${g.slug}/`,
      lastmod: latestUpdate(g.items),
    })),
    ...articles
      .filter((a) => a.type === 'page')
      .map((a) => ({ path: `/${a.slug}/` })),
    ...feed.map((e) => ({ path: e.url, lastmod: e.updated })),
  ]);
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
