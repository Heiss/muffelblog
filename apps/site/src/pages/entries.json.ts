import type { APIRoute } from 'astro';
import { getFeed } from '../lib/feed';
import { liveEntries } from '../lib/live';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(liveEntries(await getFeed())), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
