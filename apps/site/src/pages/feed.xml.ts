import type { APIRoute } from 'astro';
import { SITE_NAME } from '@muffelblog/core';
import { getContent } from '../lib/articles';
import { getFeed, siteUrl } from '../lib/feed';
import { messages } from '../i18n/messages';
import { rssXml } from '../lib/rss';
import type { RssItem } from '../lib/rss';
import { getSettings } from '../lib/settings';

// Feeds need absolute addresses: without SITE_URL (domain still open, O9) there is no feed.
export async function getStaticPaths() {
  return siteUrl() ? [{}] : [];
}

export const GET: APIRoute = async () => {
  const base = siteUrl();
  if (!base) return new Response(null, { status: 404 });
  const [feed, { articles }] = await Promise.all([getFeed(), getContent()]);
  const posts = new Map(articles.map((a) => [`${a.type}:${a.slug}`, a]));
  const items: RssItem[] = feed.map((entry) => ({
    id: entry.id,
    url: entry.url,
    title: entry.title,
    date: entry.created,
    summary: entry.excerpt,
    tags: entry.tags,
    // Posts and memos in full, terms with their short definition only.
    html:
      entry.kind === 'memo'
        ? entry.html
        : entry.kind === 'post'
          ? posts.get(entry.id)?.html
          : undefined,
  }));
  const xml = rssXml(base, items, {
    title: SITE_NAME,
    description: messages.rss.description,
    lang: messages.lang,
    limit: getSettings().rssItems,
  });
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
};
