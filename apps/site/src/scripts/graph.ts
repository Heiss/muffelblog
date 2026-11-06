// Draws the link graph (/graph.json) as SVG: the neighbors of a page under the
// page, all nodes on /graph/. No library, no foreign request. The lists of
// links stay the access without JavaScript.
import { messages } from '../i18n/messages';
import {
  graphUrl,
  layout,
  neighborhood,
  type Graph,
  type Placed,
} from './graph-logic';

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
  const size = figure.classList.contains('graph-local') ? 420 : 900;
  figure.querySelector('svg')?.remove();
  const placed = layout(graph, { size, center });
  const at = new Map(placed.map((p) => [p.id, p]));
  const svg = el('svg', {
    viewBox: `0 0 ${size} ${size}`,
    class: 'graph-svg',
    role: 'group',
    'aria-label': figure.querySelector('figcaption')?.textContent ?? '',
  });
  const markerId = addArrow(svg, figure.classList.contains('graph-local'));
  const edges = el('g', { class: 'edges' });
  for (const e of graph.edges) {
    const a = at.get(e.from);
    const b = at.get(e.to);
    if (!a || !b) continue;
    edges.append(edgeElement(a, b, markerId));
  }
  svg.append(edges);
  for (const node of placed) svg.append(nodeElement(node, node.id === center));
  figure.append(svg);
  figure.hidden = false;
  if (figure.classList.contains('graph-local')) fitLocalCanvas(svg, size);
}

/** Keep node positions and text scale, trimming unused canvas around the drawing. */
function fitLocalCanvas(svg: SVGSVGElement, size: number): void {
  const bounds = svg.getBBox();
  const padding = 20;
  const left = Math.min(0, bounds.x - padding);
  const right = Math.max(size, bounds.x + bounds.width + padding);
  svg.setAttribute(
    'viewBox',
    [left, bounds.y - padding, right - left, bounds.height + 2 * padding].join(
      ' ',
    ),
  );
}

function addArrow(svg: SVGSVGElement, local: boolean): string {
  const id = local ? 'local-arrow' : 'all-arrow';
  const defs = el('defs');
  const marker = el('marker', {
    id,
    viewBox: '0 0 10 10',
    refX: 10,
    refY: 5,
    markerWidth: 8,
    markerHeight: 8,
    orient: 'auto-start-reverse',
  });
  marker.append(
    el('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'edge-arrow' }),
  );
  defs.append(marker);
  svg.append(defs);
  return id;
}

function edgeElement(a: Placed, b: Placed, marker: string): SVGLineElement {
  const distance = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1);
  const inset = 11;
  const line = el('line', {
    x1: a.x,
    y1: a.y,
    x2: b.x - ((b.x - a.x) / distance) * inset,
    y2: b.y - ((b.y - a.y) / distance) * inset,
    class: 'edge',
    'marker-end': `url(#${marker})`,
  });
  const title = el('title');
  title.textContent = `${a.title} → ${b.title}`;
  line.append(title);
  return line;
}

function nodeElement(node: Placed, isCenter: boolean): SVGElement {
  const kind = messages.graph.kinds[node.kind];
  const label = `${kind}: ${node.title}`;
  const group = el('a', {
    href: node.kind === 'domain' ? graphUrl(node.id) : node.id,
    tabindex: 0,
    'aria-label': label,
  });
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

function configure(figure: HTMLElement, graph: Graph): void {
  const select = figure.querySelector<HTMLSelectElement>('[data-graph-center]');
  const depth = figure.querySelector<HTMLInputElement>('[data-graph-depth]')!;
  const params = new URLSearchParams(location.search);
  let center = figure.dataset.graphNode ?? params.get('node') ?? '';
  if (!graph.nodes.some((n) => n.id === center)) center = '';
  if (select) {
    for (const node of graph.nodes) select.add(new Option(node.title, node.id));
    select.value = center;
    const requested = Number(params.get('depth'));
    if (Number.isInteger(requested) && requested >= 1)
      depth.value = String(requested);
  }
  depth.max = String(Math.max(1, graph.nodes.length));
  depth.value = String(Math.min(Number(depth.value), Number(depth.max)));
  const refresh = () => {
    if (!depth.checkValidity()) return;
    center = select?.value ?? center;
    const part = center
      ? neighborhood(graph, center, Number(depth.value))
      : graph;
    draw(figure, part, center);
    depth.disabled = !center;
    if (select) updateOverview(part, center, depth.value);
  };
  select?.addEventListener('change', refresh);
  depth.addEventListener('change', refresh);
  refresh();
}

function updateOverview(part: Graph, center: string, depth: string): void {
  const ids = new Set(part.nodes.map((n) => n.id));
  for (const entry of document.querySelectorAll<HTMLElement>(
    '[data-graph-entry]',
  )) {
    entry.hidden = !ids.has(entry.dataset.graphEntry!);
  }
  const url = new URL(location.href);
  if (center) {
    url.searchParams.set('node', center);
    url.searchParams.set('depth', depth);
  } else {
    url.searchParams.delete('node');
    url.searchParams.delete('depth');
  }
  history.replaceState(null, '', url);
}

for (const figure of document.querySelectorAll<HTMLElement>('[data-graph]')) {
  load()
    .then((graph) => configure(figure, graph))
    .catch(() => {
      // The lists of links are there without the drawing.
    });
}
