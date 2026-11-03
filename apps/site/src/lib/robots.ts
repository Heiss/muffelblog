/** robots.txt: everything may be crawled; the sitemap is named once the domain is known. */
export function robotsTxt(base: string | undefined): string {
  const lines = ['User-agent: *', 'Allow: /'];
  if (base) lines.push('', `Sitemap: ${new URL('/sitemap.xml', base).href}`);
  return lines.join('\n') + '\n';
}
