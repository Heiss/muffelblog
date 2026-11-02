import { contentTypeForMediaFile } from '@muffelblog/core';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getContent } from '../../lib/articles';

export const getStaticPaths: GetStaticPaths = async () => {
  const { media } = await getContent();
  return [...media.keys()].map((file) => ({ params: { file } }));
};

export const GET: APIRoute = async ({ params }) => {
  const { media } = await getContent();
  const file = params.file ?? '';
  const data = media.get(file);
  const contentType = contentTypeForMediaFile(file);
  // Nur bekannte Typen ausliefern, damit nie ein aktiver Inhaltstyp entsteht.
  if (!data || contentType === null) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': contentType },
  });
};
