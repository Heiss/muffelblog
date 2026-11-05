// Draws the link graph (/graph.json) as SVG: the neighbors of a page under the
// page, all nodes on /graph/. No library, no foreign request. The lists of
// links stay the access without JavaScript.
import { messages } from '../i18n/messages';
import { layout, neighborhood, type Graph, type Placed } from './graph-logic';

const SVG = 'http://www.w3.org/2000/svg';
let loaded: Promise<Graph> | undefined;

function load(): Promise<Graph> {
  loaded ??= fetch('/graph.json').then((r) => {
    if (!r.ok) throw new Error(`graph.json: ${r.status}`);
    return r.json() as Promise<Graph>;
  });
  return loaded;
}

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function draw(figure: HTMLElement, graph: Graph, center?: string): void {
  const size = center ? 420 : 900;
  const placed = layout(graph, { size, center });
  const at = new Map(placed.map((p) => [p.id, p]));
  const svg = el('svg', {
    viewBox: `0 0 ${size} ${size}`,
    class: 'graph-svg',
    role: 'group',
    'aria-label': figure.querySelector('figcaption')?.textContent ?? '',
  });
  const edges = el('g', { class: 'edges' });
  for (const e of graph.edges) {
    const a = at.get(e.from);
    const b = at.get(e.to);
    if (!a || !b) continue;
    edges.append(
      el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'edge' }),
    );
  }
  svg.append(edges);
  for (const node of placed) svg.append(nodeElement(node, node.id === center));
  figure.append(svg);
  figure.hidden = false;
}

function nodeElement(node: Placed, isCenter: boolean): SVGElement {
  const kind = messages.graph.kinds[node.kind];
  const label = `${kind}: ${node.title}`;
  // Pages are links; a website is only a point (the page loads nothing from
  // it), but it can be reached by keyboard and is read out.
  const group =
    node.kind === 'domain'
      ? el('g', { tabindex: 0, role: 'img', 'aria-label': label })
      : el('a', { href: node.id, 'aria-label': label });
  group.setAttribute(
    'class',
    `node node-${node.kind}${isCenter ? ' node-center' : ''}`,
  );
  const title = el('title');
  title.textContent = label;
  const r = isCenter ? 9 : node.kind === 'domain' ? 5 : 7;
  const text = el('text', {
    x: node.x,
    y: node.y - r - 4,
    'text-anchor': 'middle',
  });
  text.textContent =
    node.title.length > 32 ? `${node.title.slice(0, 31)}…` : node.title;
  group.append(title, el('circle', { cx: node.x, cy: node.y, r }), text);
  return group;
}

for (const figure of document.querySelectorAll<HTMLElement>('[data-graph]')) {
  load()
    .then((graph) => {
      const center = figure.dataset.graphNode;
      const part = center ? neighborhood(graph, center) : graph;
      if (part.nodes.length > (center ? 1 : 0)) draw(figure, part, center);
    })
    .catch(() => {
      // The lists of links are there without the drawing.
    });
}
