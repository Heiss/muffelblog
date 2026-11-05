/**
 * The link graph (W20, W21): pages (posts, terms, memos) and the domains of
 * external links as nodes, links between them as directed edges. Built from the
 * finished HTML, so it contains only what a reader can click.
 */

export type GraphNodeKind = 'post' | 'glossary' | 'memo' | 'domain';

export interface GraphNode {
  /** The address of a page, or `domain:<host>`. */
  id: string;
  kind: GraphNodeKind;
  title: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface LinkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const PAGE_PATH = /^\/([pmg])\/([^/?#]+)\/?/;

function hrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/gi)].map((m) =>
    (m[1] ?? '').replace(/&amp;/g, '&'),
  );
}

/** One node per domain: the host without a leading `www.`. */
function domainOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

function siteOf(siteUrl?: string): URL | undefined {
  try {
    return siteUrl ? new URL(siteUrl) : undefined;
  } catch {
    return undefined;
  }
}

/** A link as a path of the own site, a foreign domain, or nothing. */
function classify(
  href: string,
  site: URL | undefined,
): { path: string } | { domain: string } | null {
  if (href.startsWith('/') && !href.startsWith('//')) return { path: href };
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (site && url.origin === site.origin) return { path: url.pathname };
  return { domain: domainOf(url) };
}

/** Pages of the own site and external domains a piece of HTML links to, in order, without duplicates. */
export function extractLinks(
  html: string,
  siteUrl?: string,
): { pages: string[]; domains: string[] } {
  const site = siteOf(siteUrl);
  const pages = new Set<string>();
  const domains = new Set<string>();
  for (const href of hrefs(html)) {
    const link = classify(href, site);
    if (link === null) continue;
    if ('domain' in link) {
      domains.add(link.domain);
      continue;
    }
    const m = link.path.match(PAGE_PATH);
    if (m) pages.add(`/${m[1]}/${m[2]}/`);
  }
  return { pages: [...pages], domains: [...domains] };
}

type GraphEntry = {
  url: string;
  title: string;
  kind: 'post' | 'glossary' | 'memo';
  html: string;
};

/** Collects edges without self links and duplicates, and the domain nodes. */
function edgeCollector() {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const domains = new Map<string, GraphNode>();
  return {
    edges,
    domains,
    add(from: string, to: string) {
      const key = `${from} ${to}`;
      if (from === to || seen.has(key)) return;
      seen.add(key);
      edges.push({ from, to });
    },
    domain(name: string): string {
      const id = `domain:${name}`;
      if (!domains.has(id))
        domains.set(id, { id, kind: 'domain', title: name });
      return id;
    },
  };
}

/** The graph of all entries. Edges to pages that do not exist (unpublished) never arise. */
export function buildGraph(
  entries: readonly GraphEntry[],
  siteUrl?: string,
): LinkGraph {
  const nodes: GraphNode[] = entries.map((e) => ({
    id: e.url,
    kind: e.kind,
    title: e.title,
  }));
  const known = new Set(nodes.map((n) => n.id));
  const c = edgeCollector();
  for (const e of entries) {
    const links = extractLinks(e.html, siteUrl);
    for (const page of links.pages.filter((p) => known.has(p)))
      c.add(e.url, page);
    for (const domain of links.domains) c.add(e.url, c.domain(domain));
  }
  return { nodes: [...nodes, ...c.domains.values()], edges: c.edges };
}

/** What a node links to and what links to it (backlinks). */
export function linksOf(
  graph: LinkGraph,
  id: string,
): { to: GraphNode[]; from: GraphNode[] } {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const pick = (ids: string[]) =>
    ids.map((i) => byId.get(i)).filter((n): n is GraphNode => n !== undefined);
  return {
    to: pick(graph.edges.filter((e) => e.from === id).map((e) => e.to)),
    from: pick(graph.edges.filter((e) => e.to === id).map((e) => e.from)),
  };
}
