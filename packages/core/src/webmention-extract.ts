import { createHash } from 'node:crypto';
import { parse, serialize } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function attr(el: Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

function hasToken(value: string | undefined, token: string): boolean {
  return (value ?? '').toLowerCase().split(/\s+/).includes(token);
}

function walk(node: Node, visit: (el: Element) => void): void {
  if (isElement(node)) visit(node);
  const children = 'childNodes' in node ? (node.childNodes as Node[]) : [];
  for (const child of children) walk(child, visit);
  // <template> keeps its content in a separate fragment
  if (isElement(node) && node.tagName === 'template' && 'content' in node)
    walk(node.content as unknown as Node, visit);
}

function httpUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export interface EntryContent {
  /** SHA-256 of the HTML of the content (`.e-content`) of the entry. */
  hash: string;
  /** Absolute http(s) links in the content, in order, without duplicates. */
  links: string[];
}

/**
 * Reads the content of an entry (`.e-content` inside `.h-entry`) from the HTML
 * of a built page. Returns null for pages that are no entry. Only the content
 * counts, so a change around it (header, footer, meta tags) sends nothing.
 */
export function extractEntry(
  html: string,
  pageUrl: string,
): EntryContent | null {
  const document = parse(html);
  let content: Element | undefined;
  const find = (node: Node, insideEntry: boolean): void => {
    if (content) return;
    let inside = insideEntry;
    if (isElement(node)) {
      if (hasToken(attr(node, 'class'), 'h-entry')) inside = true;
      if (inside && hasToken(attr(node, 'class'), 'e-content')) {
        content = node;
        return;
      }
    }
    for (const child of 'childNodes' in node ? (node.childNodes as Node[]) : [])
      find(child, inside);
  };
  find(document as unknown as Node, false);
  if (!content) return null;

  const links: string[] = [];
  walk(content, (el) => {
    if (el.tagName !== 'a') return;
    const href = attr(el, 'href');
    if (href === undefined) return;
    const url = httpUrl(href, pageUrl);
    if (url !== null && !links.includes(url)) links.push(url);
  });
  const hash = createHash('sha256').update(serialize(content)).digest('hex');
  return { hash, links };
}

// --- Endpoint discovery --------------------------------------------------------

export interface HeaderLink {
  url: string;
  rel: string[];
}

/** Reads an HTTP `Link` header (RFC 8288), as far as webmention needs it. */
export function parseLinkHeader(header: string): HeaderLink[] {
  const out: HeaderLink[] = [];
  const pattern = /<([^>]*)>([^<]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(header)) !== null) {
    const rel = /;\s*rel\s*=\s*(?:"([^"]*)"|([^\s;,]+))/i.exec(match[2] ?? '');
    if (!rel) continue;
    out.push({
      url: match[1] as string,
      rel: ((rel[1] ?? rel[2]) as string)
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    });
  }
  return out;
}

export interface FetchedPage {
  /** Address after redirects. */
  url: string;
  /** Header names in lower case. */
  headers: Record<string, string>;
  body: string;
}

/**
 * The webmention endpoint of a fetched page: the HTTP `Link` header first, then
 * the first `<link>` or `<a>` with `rel="webmention"` in document order. A
 * relative address is resolved against the final address of the page. Only
 * http(s) endpoints count. Returns null if there is none.
 */
export function findEndpoint(page: FetchedPage): string | null {
  for (const link of parseLinkHeader(page.headers.link ?? '')) {
    if (link.rel.includes('webmention')) return httpUrl(link.url, page.url);
  }
  if (!/html|xml/i.test(page.headers['content-type'] ?? '')) return null;
  let found: string | null | undefined;
  walk(parse(page.body) as unknown as Node, (el) => {
    if (found !== undefined) return;
    if (el.tagName !== 'link' && el.tagName !== 'a') return;
    if (!hasToken(attr(el, 'rel'), 'webmention')) return;
    const href = attr(el, 'href');
    if (href === undefined) return;
    found = httpUrl(href, page.url);
  });
  return found ?? null;
}
