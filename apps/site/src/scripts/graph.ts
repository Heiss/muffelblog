// Draws the link graph (/graph.json) as SVG with d3-force (layout), d3-zoom
// (zoom and pan like a map) and d3-drag (move a point): the neighbors of a page
// under the page, all nodes on /graph/. The libraries are part of the own
// bundle, nothing is loaded from elsewhere. The lists of links stay the access
// without JavaScript.
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { D3ZoomEvent, ZoomBehavior } from 'd3-zoom';
import { messages } from '../i18n/messages';
import {
  buildSimulation,
  fitTransform,
  labelVisible,
  neighborhood,
  type GNode,
  type Graph,
  type SimLink,
  type SimNode,
  type Simulated,
} from './graph-logic';

const SVG = 'http://www.w3.org/2000/svg';
const MAX_ZOOM = 8;
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

/** What is on the screen: the elements of the picture and how far it is zoomed. */
interface Picture {
  svg: SVGSVGElement;
  root: SVGGElement;
  center: string | undefined;
  sim: Simulated;
  /** The element of a node (moved to its position) and its body (kept at the same size). */
  nodes: Map<
    string,
    { shell: SVGElement; body: SVGGElement; label: SVGElement }
  >;
  lines: Array<{ line: SVGLineElement; link: SimLink }>;
  zoom: number;
}

const RADIUS: Record<SimNode['kind'], number> = {
  post: 8,
  glossary: 7,
  memo: 5,
  domain: 5,
};

function nodeElement(node: SimNode, isCenter: boolean) {
  const kind = messages.graph.kinds[node.kind];
  const label = `${kind}: ${node.title}`;
  // Pages are links; a website is only a point (the page loads nothing from
  // it), but it can be reached by keyboard and is read out.
  const shell =
    node.kind === 'domain'
      ? el('g', { tabindex: 0, role: 'img', 'aria-label': label })
      : el('a', { href: node.id, 'aria-label': label });
  shell.setAttribute(
    'class',
    `node node-${node.kind}${isCenter ? ' node-center' : ''}`,
  );
  const body = el('g', { class: 'node-body' });
  const title = el('title');
  title.textContent = label;
  const r = isCenter ? 11 : RADIUS[node.kind];
  const text = el('text', {
    y: -r - 5,
    'text-anchor': 'middle',
    class: 'node-label',
  });
  text.textContent =
    node.title.length > 36 ? `${node.title.slice(0, 35)}…` : node.title;
  body.append(el('circle', { r }), text);
  shell.append(title, body);
  return { shell, body, label: text };
}

function build(figure: HTMLElement, graph: Graph, center?: string): Picture {
  const svg = el('svg', {
    class: 'graph-svg',
    role: 'group',
    'aria-label': figure.querySelector('figcaption')?.textContent ?? '',
  });
  const root = el('g', { class: 'graph-root' });
  const edges = el('g', { class: 'edges' });
  const nodesLayer = el('g', { class: 'nodes' });
  root.append(edges, nodesLayer);
  svg.append(root);
  const sim = buildSimulation(graph, { center });
  const picture: Picture = {
    svg,
    root,
    center,
    sim,
    nodes: new Map(),
    lines: [],
    zoom: 1,
  };
  for (const link of sim.links) {
    const line = el('line', { class: 'edge' });
    edges.append(line);
    picture.lines.push({ line, link });
  }
  for (const node of sim.nodes) {
    const parts = nodeElement(node, node.id === center);
    nodesLayer.append(parts.shell);
    picture.nodes.set(node.id, parts);
  }
  return picture;
}

/** Puts every point and line where the simulation has it. */
function place(p: Picture): void {
  for (const node of p.sim.nodes)
    p.nodes
      .get(node.id)
      ?.shell.setAttribute('transform', `translate(${node.x},${node.y})`);
  for (const { line, link } of p.lines) {
    const a = link.source as SimNode;
    const b = link.target as SimNode;
    line.setAttribute('x1', String(a.x));
    line.setAttribute('y1', String(a.y));
    line.setAttribute('x2', String(b.x));
    line.setAttribute('y2', String(b.y));
  }
}

/** Points and text keep their size on the screen when zoomed; labels appear by zoom level. */
function applyZoom(p: Picture, k: number): void {
  p.zoom = k;
  for (const node of p.sim.nodes) {
    const parts = p.nodes.get(node.id);
    if (!parts) continue;
    parts.body.setAttribute('transform', `scale(${1 / k})`);
    parts.label.classList.toggle(
      'off',
      !labelVisible(node, k, node.id === p.center),
    );
  }
}

function enableDrag(p: Picture): void {
  const behavior = drag<SVGElement, SimNode>()
    .container(p.root)
    .on('start', (event, node) => {
      if (!event.active) p.sim.simulation.alphaTarget(0.3).restart();
      node.fx = node.x;
      node.fy = node.y;
    })
    .on('drag', (event, node) => {
      node.fx = event.x;
      node.fy = event.y;
    })
    .on('end', (event, node) => {
      if (!event.active) p.sim.simulation.alphaTarget(0);
      // A point stays where it was put down; "arrange again" lets all go.
      if (node.id !== p.center)
        p.nodes.get(node.id)?.shell.classList.add('pinned');
    });
  for (const node of p.sim.nodes) {
    const shell = p.nodes.get(node.id)?.shell;
    if (shell) select<SVGElement, SimNode>(shell).datum(node).call(behavior);
  }
  p.sim.simulation.on('tick', () => place(p));
}

/** Lets every moved point go and lets the picture settle again. */
function relayout(p: Picture): void {
  for (const node of p.sim.nodes) {
    if (node.id === p.center) continue;
    node.fx = null;
    node.fy = null;
    p.nodes.get(node.id)?.shell.classList.remove('pinned');
  }
  p.sim.simulation.alpha(0.9).restart();
}

interface Controls {
  zoomBy: (factor: number) => void;
  fit: () => void;
  arrange: () => void;
}

/** The buttons like on a map, in the corner of the picture. */
function addControls(figure: HTMLElement, controls: Controls): void {
  const box = document.createElement('div');
  box.className = 'graph-controls';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', messages.graph.zoomHint);
  const g = messages.graph;
  const buttons: Array<[string, string, () => void]> = [
    ['+', g.zoomIn, () => controls.zoomBy(1.6)],
    ['−', g.zoomOut, () => controls.zoomBy(1 / 1.6)],
    ['⤢', g.zoomReset, () => controls.fit()],
    ['⟲', g.arrange, () => controls.arrange()],
  ];
  for (const [text, label, run] of buttons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.addEventListener('click', run);
    box.append(b);
  }
  figure.append(box);
}

/**
 * Zoom with the mouse wheel at the pointer, pan by dragging the background,
 * pinch on touch screens. On the overall view the wheel always zooms; on the
 * small graphs under a page it zooms only after a click into the graph (and
 * touch is left to the page), so scrolling the page is not blocked.
 */
function enableZoom(figure: HTMLElement, p: Picture, always: boolean): void {
  let active = always;
  const behavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<
    SVGSVGElement,
    unknown
  >()
    .scaleExtent([0.15, MAX_ZOOM])
    .filter((event: Event) => {
      if (event.type === 'wheel') return active;
      if (event.type.startsWith('touch')) return always;
      return !(event as MouseEvent).button;
    })
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      const t = event.transform;
      p.root.setAttribute(
        'transform',
        `translate(${t.x},${t.y}) scale(${t.k})`,
      );
      applyZoom(p, t.k);
    });
  const view = select(p.svg);
  view.call(behavior);
  const fit = () => {
    const box = p.svg.getBoundingClientRect();
    const t = fitTransform(p.sim.nodes, box.width, box.height, {
      maxZoom: always ? 1.4 : 2,
    });
    view.call(behavior.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
  };
  addControls(figure, {
    zoomBy: (factor) => view.call(behavior.scaleBy, factor),
    fit,
    arrange: () => relayout(p),
  });
  p.svg.addEventListener('pointerdown', () => {
    active = true;
    figure.classList.add('graph-active');
  });
  if (!always)
    document.addEventListener('pointerdown', (event) => {
      if (figure.contains(event.target as Node)) return;
      active = false;
      figure.classList.remove('graph-active');
    });
  fit();
}

function draw(figure: HTMLElement, graph: Graph, center?: string): Picture {
  const p = build(figure, graph, center);
  figure.append(p.svg);
  // Visible before it is measured, so the picture knows its size.
  figure.hidden = false;
  place(p);
  enableDrag(p);
  enableZoom(figure, p, !center);
  return p;
}

/** The controls of the overall view in the sidebar (layout W24). */
interface FocusTools {
  box: HTMLElement;
  find: HTMLInputElement | null;
  name: HTMLElement | null;
  list: HTMLElement | null;
  all: HTMLButtonElement | null;
}

function focusTools(): FocusTools | null {
  const box = document.querySelector<HTMLElement>('[data-graph-tools]');
  if (!box) return null;
  return {
    box,
    find: box.querySelector('[data-graph-find]'),
    name: box.querySelector('[data-graph-focus-name]'),
    list: box.querySelector('[data-graph-neighbours]'),
    all: box.querySelector('[data-graph-all]'),
  };
}

const endsOf = (link: SimLink) => [
  (link.source as SimNode).id,
  (link.target as SimNode).id,
];

/** Fades everything but the focus and its neighbours; null shows all again. */
function markFocus(p: Picture, graph: Graph, id: string | null): GNode[] {
  const near = id ? neighborhood(graph, id).nodes : [];
  const keep = new Set(near.map((n) => n.id));
  for (const [nodeId, parts] of p.nodes) {
    parts.shell.classList.toggle('faded', id !== null && !keep.has(nodeId));
    parts.shell.classList.toggle('in-focus', keep.has(nodeId));
  }
  for (const { line, link } of p.lines) {
    const [a, b] = endsOf(link);
    const touches = a === id || b === id;
    line.classList.toggle('faded', id !== null && !touches);
  }
  return near.filter((n) => n.id !== id);
}

function listItem(node: GNode): HTMLLIElement {
  const li = document.createElement('li');
  if (node.kind === 'domain') li.textContent = node.title;
  else {
    const a = document.createElement('a');
    a.href = node.id;
    a.textContent = node.title;
    li.append(a);
  }
  return li;
}

function showFocus(
  p: Picture,
  graph: Graph,
  tools: FocusTools,
  id: string | null,
): void {
  const neighbours = markFocus(p, graph, id);
  const node = graph.nodes.find((n) => n.id === id);
  if (tools.name) tools.name.textContent = node?.title ?? '–';
  tools.list?.replaceChildren(...neighbours.map(listItem));
  if (tools.all)
    tools.all.textContent =
      (id ? tools.all.dataset.labelAll : tools.all.dataset.labelFocus) ?? '';
}

/** Hides the points of a kind (and their lines) when its box is unticked. */
function filterKinds(p: Picture, box: HTMLElement): void {
  const hidden = new Set(
    [...box.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
      .filter((c) => !c.checked)
      .map((c) => c.value),
  );
  const kindOf = new Map(p.sim.nodes.map((n) => [n.id, n.kind]));
  for (const [nodeId, parts] of p.nodes)
    parts.shell.classList.toggle(
      'hidden-kind',
      hidden.has(kindOf.get(nodeId) ?? ''),
    );
  for (const { line, link } of p.lines)
    line.classList.toggle(
      'hidden-kind',
      endsOf(link).some((end) => hidden.has(kindOf.get(end) ?? '')),
    );
}

function enableFocus(p: Picture, graph: Graph, start: string): void {
  const tools = focusTools();
  if (!tools) return;
  tools.box.hidden = false;
  let focus: string | null = start;
  let last = start;
  showFocus(p, graph, tools, focus);
  tools.all?.addEventListener('click', () => {
    focus = focus ? null : last;
    showFocus(p, graph, tools, focus);
  });
  tools.find?.addEventListener('change', () => {
    const word = tools.find?.value.trim().toLocaleLowerCase() ?? '';
    const node = graph.nodes.find((n) => n.title.toLocaleLowerCase() === word);
    if (!node) return;
    focus = last = node.id;
    showFocus(p, graph, tools, focus);
  });
  const kinds = tools.box.querySelector<HTMLElement>('[data-graph-kinds]');
  kinds?.addEventListener('change', () => filterKinds(p, kinds));
}

/**
 * Draws once the figure can be seen: the picture measures itself, so a graph
 * in a folded band (layout W24) waits until the band is opened.
 */
function drawWhenShown(figure: HTMLElement, show: () => void): void {
  const details = figure.closest('details');
  let done = false;
  const run = () => {
    if (done || (details && !details.open)) return;
    done = true;
    show();
  };
  details?.addEventListener('toggle', run);
  run();
}

for (const figure of document.querySelectorAll<HTMLElement>('[data-graph]')) {
  load()
    .then((graph) => {
      const center = figure.dataset.graphNode;
      const part = center ? neighborhood(graph, center) : graph;
      const focus = figure.dataset.graphFocus;
      if (part.nodes.length > (center ? 1 : 0))
        drawWhenShown(figure, () => {
          const p = draw(figure, part, center);
          if (!center && focus) enableFocus(p, part, focus);
        });
    })
    .catch(() => {
      // The lists of links are there without the drawing.
    });
}
