import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/feed';
import { robotsTxt } from '../lib/robots';

export const GET: APIRoute = () =>
  new Response(robotsTxt(siteUrl()), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
