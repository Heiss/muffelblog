// Draws the link graph (/graph.json) as SVG: the neighbors of a page under the
// page, all nodes on /graph/. No library, no foreign request. The lists of
// links stay the access without JavaScript.
import { messages } from '../i18n/messages';
import {
  fullView,
  layout,
  neighborhood,
  panBy,
  wheelFactor,
  zoomAt,
  type Graph,
  type Placed,
  type View,
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
  figure.append(svg, zoomControls());
  figure.hidden = false;
  enableZoom(figure, svg, size, !center);
}

type Button = { label: string; text: string; run: () => void };

/** The zoom buttons; filled with their actions by `enableZoom`. */
function zoomControls(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'graph-controls';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', messages.graph.zoomHint);
  return box;
}

function addButton(box: HTMLElement, { label, text, run }: Button): void {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', run);
  box.append(b);
}

/** The current view of a drawing and the ways to change it. */
interface Zoom {
  size: number;
  svg: SVGSVGElement;
  view: () => View;
  apply: (next: View) => void;
  /** Pointer position in drawing units. */
  point: (event: { clientX: number; clientY: number }) => {
    x: number;
    y: number;
  };
}

function newZoom(svg: SVGSVGElement, size: number): Zoom {
  let view: View = fullView(size);
  return {
    size,
    svg,
    view: () => view,
    apply: (next) => {
      view = next;
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.w}`);
    },
    point: (event) => {
      const box = svg.getBoundingClientRect();
      return {
        x: view.x + ((event.clientX - box.left) / box.width) * view.w,
        y: view.y + ((event.clientY - box.top) / box.height) * view.w,
      };
    },
  };
}

/** Buttons: zoom around the middle of the visible part, and reset. */
function addZoomButtons(controls: HTMLElement, zoom: Zoom): void {
  const step = (factor: number) => () => {
    const v = zoom.view();
    zoom.apply(zoomAt(v, zoom.size, factor, v.x + v.w / 2, v.y + v.w / 2));
  };
  const g = messages.graph;
  addButton(controls, { label: g.zoomIn, text: '+', run: step(1.5) });
  addButton(controls, { label: g.zoomOut, text: '−', run: step(1 / 1.5) });
  addButton(controls, {
    label: g.zoomReset,
    text: '⟲',
    run: () => zoom.apply(fullView(zoom.size)),
  });
}

/** The wheel zooms at the pointer while `isActive()` says so. */
function addWheelZoom(zoom: Zoom, isActive: () => boolean): void {
  zoom.svg.addEventListener(
    'wheel',
    (event) => {
      if (!isActive()) return;
      event.preventDefault();
      const at = zoom.point(event);
      const factor = wheelFactor(event.deltaY, event.deltaMode);
      zoom.apply(zoomAt(zoom.view(), zoom.size, factor, at.x, at.y));
    },
    { passive: false },
  );
}

/** Drag with the mouse; links and points keep their click. */
function addDrag(zoom: Zoom, onPress: () => void): void {
  const { svg } = zoom;
  let drag: { x: number; y: number } | null = null;
  svg.addEventListener('pointerdown', (event) => {
    onPress();
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if ((event.target as Element).closest('.node')) return;
    drag = { x: event.clientX, y: event.clientY };
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('graph-dragging');
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const scale = zoom.view().w / svg.getBoundingClientRect().width;
    const dx = (drag.x - event.clientX) * scale;
    const dy = (drag.y - event.clientY) * scale;
    zoom.apply(panBy(zoom.view(), zoom.size, dx, dy));
    drag = { x: event.clientX, y: event.clientY };
  });
  const stop = () => {
    drag = null;
    svg.classList.remove('graph-dragging');
  };
  svg.addEventListener('pointerup', stop);
  svg.addEventListener('pointercancel', stop);
}

/**
 * Zoom with the mouse wheel (at the pointer), move by dragging, buttons for
 * keyboard and touch. On the overall view the wheel always zooms; on the small
 * graphs under a page it zooms only after a click into the graph, so scrolling
 * the page is not blocked.
 */
function enableZoom(
  figure: HTMLElement,
  svg: SVGSVGElement,
  size: number,
  always: boolean,
): void {
  const zoom = newZoom(svg, size);
  let active = always;
  const controls = figure.querySelector<HTMLElement>('.graph-controls');
  if (controls) addZoomButtons(controls, zoom);
  addWheelZoom(zoom, () => active);
  addDrag(zoom, () => {
    active = true;
    figure.classList.add('graph-active');
  });
  // A small graph under a page stops capturing the wheel when the visitor leaves it.
  if (!always)
    document.addEventListener('pointerdown', (event) => {
      if (figure.contains(event.target as Node)) return;
      active = false;
      figure.classList.remove('graph-active');
    });
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
