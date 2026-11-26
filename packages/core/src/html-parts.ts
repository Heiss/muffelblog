import { parseFragment, serialize } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import { toSlug } from './slug.ts';

/**
 * Parts of the finished, sanitized HTML of a page for the layout (W24): the
 * lead of a post for the feed and the outline of a post for its table of
 * contents. Both work on the HTML the renderer produced, so they never see
 * anything the sanitizer would not let through.
 */

interface Attr {
  name: string;
  value: string;
}

interface Node {
  nodeName: string;
  tagName?: string;
  attrs?: Attr[];
  childNodes?: Node[];
  value?: string;
}

const HEADING = /^h([1-6])$/;

function parse(html: string): Node {
  return parseFragment(html) as unknown as Node;
}

function toHtml(root: Node): string {
  return serialize(
    root as unknown as DefaultTreeAdapterMap['documentFragment'],
  );
}

function attr(node: Node, name: string): string | undefined {
  return node.attrs?.find((a) => a.name === name)?.value;
}

function hasClass(node: Node, name: string): boolean {
  return (attr(node, 'class') ?? '').split(/\s+/).includes(name);
}

function setAttr(node: Node, name: string, value: string): void {
  const rest = (node.attrs ?? []).filter((a) => a.name !== name);
  node.attrs = [...rest, { name, value }];
}

function textOf(node: Node): string {
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(textOf).join('');
}

/** Heading level 1 to 6, or 0 for anything that is no heading. */
function levelOf(node: Node): number {
  const match = HEADING.exec(node.tagName ?? '');
  return match ? Number(match[1]) : 0;
}

export interface Lead {
  /** The HTML before the first heading, without notes, footnotes and ids. */
  html: string;
  /** The text of the first heading, null when the page has none. */
  next: string | null;
}

/** Margin notes and the list of footnotes are no part of the lead. */
function isDropped(node: Node): boolean {
  if (node.tagName === 'aside') return true;
  return (
    node.tagName === 'section' &&
    (hasClass(node, 'footnotes') || attr(node, 'data-footnotes') !== undefined)
  );
}

/** The wrapper of an annotated paragraph and the highlight of a comment go, their content stays. */
function isUnwrapped(node: Node): boolean {
  return (
    (node.tagName === 'div' && hasClass(node, 'annotated')) ||
    (node.tagName === 'mark' && hasClass(node, 'doc-comment'))
  );
}

/** Ids would repeat in a list of leads; jumps inside the page now lead to the page. */
function cleanAttrs(node: Node, pageUrl: string): void {
  if (!node.attrs) return;
  node.attrs = node.attrs
    .filter((a) => a.name !== 'id')
    .map((a) =>
      a.name === 'href' && a.value.startsWith('#')
        ? { name: a.name, value: `${pageUrl}${a.value}` }
        : a,
    );
}

function cleanChildren(node: Node, pageUrl: string): void {
  const kept: Node[] = [];
  for (const child of node.childNodes ?? []) {
    if (isDropped(child)) continue;
    cleanChildren(child, pageUrl);
    cleanAttrs(child, pageUrl);
    if (isUnwrapped(child)) kept.push(...(child.childNodes ?? []));
    else kept.push(child);
  }
  node.childNodes = kept;
}

/**
 * The lead of a page for the feed: everything before the first heading at the
 * top level, and the text of that heading for the link "Continue with …".
 * A page without a heading is its lead in full.
 */
export function leadOf(html: string, pageUrl: string): Lead {
  const root = parse(html);
  const children = root.childNodes ?? [];
  const index = children.findIndex((c) => levelOf(c) > 0);
  const heading = index >= 0 ? children[index] : undefined;
  root.childNodes = heading ? children.slice(0, index) : children;
  cleanChildren(root, pageUrl);
  const next = heading ? textOf(heading).replace(/\s+/g, ' ').trim() : '';
  return { html: toHtml(root).trim(), next: next || null };
}

export interface TocEntry {
  id: string;
  text: string;
  /** 1 for the upper, 2 for the lower of the two levels in the table. */
  depth: 1 | 2;
}

export interface Outline {
  /** The HTML with an id on every heading of the table. */
  html: string;
  toc: TocEntry[];
}

/** The list of footnotes and headings only for screen readers are no part of the table. */
function isOutside(node: Node): boolean {
  return isDropped(node) || hasClass(node, 'sr-only');
}

function collect(node: Node, out: { headings: Node[]; ids: Set<string> }) {
  for (const child of node.childNodes ?? []) {
    const id = attr(child, 'id');
    if (id) out.ids.add(id);
    if (levelOf(child) >= 2 && !isOutside(child)) out.headings.push(child);
    if (!isOutside(child)) collect(child, out);
  }
}

function uniqueId(text: string, used: Set<string>): string {
  const base = toSlug(text) ?? 'section';
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/**
 * The table of contents of a page: the two highest heading levels that occur
 * (the page's own h1 is not part of the text). Every heading of the table
 * gets an id the table links to; ids that are already there stay.
 */
export function outlineOf(html: string): Outline {
  const root = parse(html);
  const found = { headings: [] as Node[], ids: new Set<string>() };
  collect(root, found);
  if (found.headings.length === 0) return { html, toc: [] };
  const top = Math.min(...found.headings.map(levelOf));
  const toc: TocEntry[] = [];
  for (const heading of found.headings) {
    const depth = levelOf(heading) - top + 1;
    if (depth > 2) continue;
    const text = textOf(heading).replace(/\s+/g, ' ').trim();
    const id = attr(heading, 'id') ?? uniqueId(text, found.ids);
    setAttr(heading, 'id', id);
    toc.push({ id, text, depth: depth as 1 | 2 });
  }
  return { html: toHtml(root), toc };
}
