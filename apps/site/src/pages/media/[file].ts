import type { APIRoute, GetStaticPaths } from 'astro';
import { getContent } from '../../lib/articles';

export const getStaticPaths: GetStaticPaths = async () => {
  const { media } = await getContent();
  return [...media.keys()].map((file) => ({ params: { file } }));
};

export const GET: APIRoute = async ({ params }) => {
  const { media } = await getContent();
  const data = media.get(params.file ?? '');
  if (!data) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': 'image/webp' },
  });
};
