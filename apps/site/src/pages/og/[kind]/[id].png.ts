import type { APIRoute, GetStaticPaths } from 'astro';
import { SITE_NAME } from '@muffelblog/core';
import type { FeedItem } from '@muffelblog/core';
import { messages } from '../../../i18n/messages';
import { getFeed } from '../../../lib/feed';
import { ogImagePath, renderOgCard } from '../../../lib/og';

// One social preview image per post, memo and term, made at build time.
export const getStaticPaths = (async () => {
  const items = await getFeed();
  return items.flatMap((item) => {
    const m = ogImagePath(item.url)?.match(/^\/og\/([pmg])\/(.+)\.png$/);
    return m ? [{ params: { kind: m[1], id: m[2] }, props: { item } }] : [];
  });
}) satisfies GetStaticPaths;

const LABEL = {
  post: messages.og.post,
  memo: messages.og.memo,
  glossary: messages.og.term,
} as const;

export const GET: APIRoute<{ item: FeedItem }> = async ({ props }) => {
  const { item } = props;
  const png = await renderOgCard({
    siteName: SITE_NAME,
    kindLabel: LABEL[item.kind],
    title: item.title,
    date: new Intl.DateTimeFormat(messages.locale, {
      dateStyle: 'long',
      timeZone: 'Europe/Berlin',
    }).format(item.created),
    excerpt: item.excerpt,
  });
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
