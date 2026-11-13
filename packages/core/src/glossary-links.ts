import type { Element, ElementContent, Root, RootContent } from 'hast';

/**
 * Links glossary terms in the text of a page automatically. The term is the
 * `term:` of a glossary entry (else its title) and its `aliases:`. Rules:
 * whole words only, upper and lower case do not matter, the longest term wins at
 * a position, every term is linked once per page (the first occurrence, also
 * counting a link written by hand), never inside links, code or headings, and
 * a term never links to its own page.
 */

export interface GlossaryTerm {
  slug: string;
  /** The term and its aliases. */
  names: string[];
  /** Short definition, shown as the tooltip of the link. */
  description?: string;
}

export interface TermMatcher {
  regex: RegExp;
  byName: Map<string, GlossaryTerm>;
}

/** Where the plugin links; `self` is the slug of the glossary entry being rendered. */
export interface GlossaryLinking {
  matcher: TermMatcher | null;
  self?: string;
}

const SKIP: ReadonlySet<string> = new Set([
  'a',
  'code',
  'pre',
  'kbd',
  'samp',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'button',
  'script',
  'style',
  'textarea',
  'svg',
  'iframe',
]);

const WORD = String.raw`[\p{L}\p{N}_]`;
const MIN_LENGTH = 2;

const key = (name: string): string =>
  name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The pattern of one name: spaces match any run of white space. */
const pattern = (name: string): string =>
  escapeRegExp(name.normalize('NFC').trim()).replace(/\s+/g, String.raw`\s+`);

/**
 * The matcher for a list of terms, or null when there is nothing to link. If two
 * terms share a name, the first by slug wins.
 */
export function createTermMatcher(
  terms: readonly GlossaryTerm[],
): TermMatcher | null {
  const byName = new Map<string, GlossaryTerm>();
  const names: string[] = [];
  const ordered = [...terms].sort((a, b) => a.slug.localeCompare(b.slug));
  for (const term of ordered) {
    for (const raw of term.names) {
      const name = raw.normalize('NFC').trim();
      if (name.length < MIN_LENGTH || byName.has(key(name))) continue;
      byName.set(key(name), term);
      names.push(name);
    }
  }
  if (names.length === 0) return null;
  // Longest first, so "Reverse Proxy" wins over "Proxy".
  names.sort((a, b) => b.length - a.length);
  const alternatives = names.map(pattern).join('|');
  const regex = new RegExp(`(?<!${WORD})(?:${alternatives})(?!${WORD})`, 'giu');
  return { regex, byName };
}

interface Run {
  matcher: TermMatcher;
  self: string | undefined;
  /** Slugs that are already linked on the page. */
  linked: Set<string>;
}

const TERM_HREF = /^\/g\/([^/]+)\/$/;

/** Terms that the author linked by hand count as linked. */
function collectLinked(node: Root | Element, linked: Set<string>): void {
  for (const child of node.children as RootContent[]) {
    if (child.type !== 'element') continue;
    const href = child.tagName === 'a' ? child.properties?.href : undefined;
    const match = typeof href === 'string' ? TERM_HREF.exec(href) : null;
    if (match?.[1]) linked.add(match[1]);
    collectLinked(child, linked);
  }
}

function linkElement(term: GlossaryTerm, text: string): Element {
  const properties: Element['properties'] = {
    href: `/g/${term.slug}/`,
    className: ['glossary-link'],
  };
  if (term.description) properties.title = term.description;
  return {
    type: 'element',
    tagName: 'a',
    properties,
    children: [{ type: 'text', value: text }],
  };
}

/** The term for a matched text, unless it is the page's own term or already linked. */
function linkableTerm(run: Run, matched: string): GlossaryTerm | undefined {
  const term = run.matcher.byName.get(key(matched));
  const skip = !term || term.slug === run.self || run.linked.has(term.slug);
  return skip ? undefined : term;
}

/** The pieces of a text with its first mentions linked, or null if nothing is linked. */
function linkText(value: string, run: Run): ElementContent[] | null {
  const parts: ElementContent[] = [];
  let last = 0;
  for (const match of value.matchAll(run.matcher.regex)) {
    const term = linkableTerm(run, match[0]);
    if (!term) continue;
    run.linked.add(term.slug);
    if (match.index > last)
      parts.push({ type: 'text', value: value.slice(last, match.index) });
    parts.push(linkElement(term, match[0]));
    last = match.index + match[0].length;
  }
  if (parts.length === 0) return null;
  if (last < value.length)
    parts.push({ type: 'text', value: value.slice(last) });
  return parts;
}

/** The replacement for a child: itself (its inside is handled), or the pieces of a linked text. */
function replacement(child: RootContent, run: Run): RootContent[] | null {
  if (child.type === 'element') {
    if (!SKIP.has(child.tagName)) walk(child, run);
    return null;
  }
  return child.type === 'text' ? linkText(child.value, run) : null;
}

function walk(node: Root | Element, run: Run): void {
  const children = node.children as RootContent[];
  const out = children.flatMap((child) => replacement(child, run) ?? [child]);
  if (out.length !== children.length || out.some((c, i) => c !== children[i]))
    node.children = out as never;
}

/** Links the first mention of every glossary term in the tree. */
export function linkGlossaryTerms(tree: Root, options: GlossaryLinking): void {
  if (!options.matcher) return;
  const linked = new Set<string>();
  collectLinked(tree, linked);
  walk(tree, { matcher: options.matcher, self: options.self, linked });
}
