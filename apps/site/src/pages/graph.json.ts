import type { APIRoute } from 'astro';
import { getGraph } from '../lib/graph';

// The link graph for the drawings: only published pages and external domains.
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await getGraph()), {
    headers: { 'Content-Type': 'application/json' },
  });
