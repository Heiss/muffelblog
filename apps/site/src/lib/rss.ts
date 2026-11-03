export interface RssItem {
  /** Stable identifier (`post:<slug>`, `memo:<uid>`, `glossary:<slug>`), used as GUID. */
  id: string;
  /** Path on the site, starting with `/`. */
  url: string;
  title: string;
  date: Date;
  /** Plain text for the description. */
  summary: string;
  /** Complete, sanitized HTML with root-relative addresses; omitted for terms. */
  html?: string;
  tags: string[];
}

export interface RssOptions {
  title: string;
  description: string;
  lang: string;
  limit?: number;
}

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** CDATA section that survives the end marker inside the text. */
const cdata = (text: string): string =>
  `<![CDATA[${text.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

/**
 * Makes root-relative addresses in `src`, `href` and `srcset` absolute.
 * Feed readers show the text outside the site, so relative paths would break.
 */
export function absolutizeHtml(html: string, origin: string): string {
  const abs = (value: string): string =>
    value.startsWith('/') && !value.startsWith('//') ? origin + value : value;
  return html
    .replace(
      /\b(src|href)="([^"]*)"/g,
      (_m, attr: string, value: string) => `${attr}="${abs(value)}"`,
    )
    .replace(
      /\bsrcset="([^"]*)"/g,
      (_m, value: string) =>
        `srcset="${value
          .split(',')
          .map((candidate) => {
            const trimmed = candidate.trim();
            const space = trimmed.indexOf(' ');
            return space === -1
              ? abs(trimmed)
              : abs(trimmed.slice(0, space)) + trimmed.slice(space);
          })
          .join(', ')}"`,
    );
}

export function rssXml(
  base: string,
  items: readonly RssItem[],
  options: RssOptions,
): string {
  let root: URL;
  try {
    root = new URL(base);
  } catch {
    throw new Error(`SITE_URL is not an address: ${base}`);
  }
  if (root.protocol !== 'https:' && root.protocol !== 'http:') {
    throw new Error(`SITE_URL must start with http:// or https://: ${base}`);
  }
  const origin = root.origin;
  const shown = items.slice(0, options.limit ?? items.length);
  const newest = shown[0]?.date;
  const entries = shown.map((item) => {
    const link = escapeXml(origin + item.url);
    return [
      '    <item>',
      `      <title>${escapeXml(item.title)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="false">${escapeXml(item.id)}</guid>`,
      `      <pubDate>${item.date.toUTCString()}</pubDate>`,
      ...item.tags.map((t) => `      <category>${escapeXml(t)}</category>`),
      `      <description>${escapeXml(item.summary)}</description>`,
      ...(item.html !== undefined
        ? [
            `      <content:encoded>${cdata(absolutizeHtml(item.html, origin))}</content:encoded>`,
          ]
        : []),
      '    </item>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '  <channel>',
    `    <title>${escapeXml(options.title)}</title>`,
    `    <link>${escapeXml(origin)}/</link>`,
    `    <description>${escapeXml(options.description)}</description>`,
    `    <language>${escapeXml(options.lang)}</language>`,
    `    <atom:link href="${escapeXml(origin)}/feed.xml" rel="self" type="application/rss+xml" />`,
    ...(newest
      ? [`    <lastBuildDate>${newest.toUTCString()}</lastBuildDate>`]
      : []),
    ...entries,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
