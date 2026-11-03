import type { APIRoute } from 'astro';
import { themeInitScript } from '../lib/themes';

export const GET: APIRoute = () =>
  new Response(themeInitScript(), {
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  });
