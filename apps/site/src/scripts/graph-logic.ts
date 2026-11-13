export interface GNode {
  id: string;
  kind: 'post' | 'glossary' | 'memo' | 'domain';
  title: string;
}
export interface GEdge {
  from: string;
  to: string;
}
export interface Graph {
  nodes: GNode[];
  edges: GEdge[];
}
const REPULSION = 4;
const GRAVITY = 0.6;

export interface Placed extends GNode {
  x: number;
  y: number;
}

/** The node, its direct neighbors (both directions) and the edges between them. */
export function neighborhood(graph: Graph, id: string): Graph {
  const ids = new Set([id]);
  for (const e of graph.edges) {
    if (e.from === id) ids.add(e.to);
    if (e.to === id) ids.add(e.from);
  }
  return {
    nodes: graph.nodes.filter((n) => ids.has(n.id)),
    edges: graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
  };
}

type Point = { x: number; y: number };

/** Every pair of nodes pushes apart. */
function repel(pos: Point[], disp: Point[], k: number): void {
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const a = pos[i] as Point;
      const b = pos[j] as Point;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      if (Math.hypot(dx, dy) < 1e-6) {
        dx = 1e-3 * (i - j);
        dy = 1e-3;
      }
      const dist = Math.hypot(dx, dy);
      const force = (REPULSION * k * k) / dist;
      shift(disp[i] as Point, dx, dy, dist, force);
      shift(disp[j] as Point, dx, dy, dist, -force);
    }
  }
}

/** Every edge pulls its two nodes together. */
function attract(graph: Graph, pos: Point[], disp: Point[], k: number): void {
  const index = new Map(graph.nodes.map((node, i) => [node.id, i]));
  for (const e of graph.edges) {
    const i = index.get(e.from);
    const j = index.get(e.to);
    if (i === undefined || j === undefined) continue;
    const a = pos[i] as Point;
    const b = pos[j] as Point;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.max(Math.hypot(dx, dy), 1e-6);
    const force = (dist * dist) / k;
    shift(disp[i] as Point, dx, dy, dist, -force);
    shift(disp[j] as Point, dx, dy, dist, force);
  }
}

function shift(d: Point, dx: number, dy: number, dist: number, force: number) {
  d.x += (dx / dist) * force;
  d.y += (dy / dist) * force;
}

/**
 * Moves every node (not the center) by its displacement, at most
 * `temperature`. Gravity keeps unlinked nodes near the middle instead of
 * drifting away and squeezing the linked groups together.
 */
function move(
  graph: Graph,
  pos: Point[],
  disp: Point[],
  temperature: number,
  center?: string,
): void {
  pos.forEach((p, i) => {
    if (graph.nodes[i]?.id === center) return;
    const d = disp[i] as Point;
    d.x -= p.x * GRAVITY;
    d.y -= p.y * GRAVITY;
    const len = Math.max(Math.hypot(d.x, d.y), 1e-9);
    p.x += (d.x / len) * Math.min(len, temperature);
    p.y += (d.y / len) * Math.min(len, temperature);
  });
}

/** Scales the positions into the square, with a margin for the labels. */
function fit(graph: Graph, pos: Point[], size: number): Placed[] {
  if (pos.length === 1)
    return graph.nodes.map((node) => ({ ...node, x: size / 2, y: size / 2 }));
  const minX = Math.min(...pos.map((p) => p.x));
  const minY = Math.min(...pos.map((p) => p.y));
  const span = Math.max(
    Math.max(...pos.map((p) => p.x)) - minX,
    Math.max(...pos.map((p) => p.y)) - minY,
    1e-6,
  );
  const margin = size * 0.12;
  const scale = (size - 2 * margin) / span;
  return graph.nodes.map((node, i) => ({
    ...node,
    x: margin + ((pos[i] as Point).x - minX) * scale,
    y: margin + ((pos[i] as Point).y - minY) * scale,
  }));
}

/**
 * A small force layout (repulsion between all nodes, springs along edges,
 * gravity), deterministic: the same graph gives the same picture. Coordinates
 * in a square of `size`.
 */
export function layout(
  graph: Graph,
  options: { size?: number; iterations?: number; center?: string } = {},
): Placed[] {
  const n = graph.nodes.length;
  if (n === 0) return [];
  // Start on a circle; the center (if any) in the middle.
  const pos: Point[] = graph.nodes.map((node, i) =>
    node.id === options.center
      ? { x: 0, y: 0 }
      : {
          x: Math.cos((2 * Math.PI * i) / n),
          y: Math.sin((2 * Math.PI * i) / n),
        },
  );
  const k = Math.sqrt(1 / n);
  let temperature = 0.1;
  for (let step = 0; step < (options.iterations ?? 300); step++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    repel(pos, disp, k);
    attract(graph, pos, disp, k);
    move(graph, pos, disp, temperature, options.center);
    temperature *= 0.985;
  }
  return fit(graph, pos, options.size ?? 600);
}

/** The visible part of the square drawing, in drawing units (the SVG `viewBox`). */
export interface View {
  x: number;
  y: number;
  /** Width = height; `size / w` is the zoom factor. */
  w: number;
}

/** Furthest zoom: the visible part is a 1/MAX_ZOOM of the drawing. */
export const MAX_ZOOM = 8;

/** The whole drawing. */
export const fullView = (size: number): View => ({ x: 0, y: 0, w: size });

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Keeps the view inside the drawing. */
function inside(view: View, size: number): View {
  const w = clamp(view.w, size / MAX_ZOOM, size);
  return {
    w,
    x: clamp(view.x, 0, size - w),
    y: clamp(view.y, 0, size - w),
  };
}

/**
 * Zooms by `factor` (> 1 in, < 1 out) and keeps the point (`px`, `py`, in
 * drawing units) where it is on the screen.
 */
export function zoomAt(
  view: View,
  size: number,
  factor: number,
  px: number,
  py: number,
): View {
  const w = clamp(view.w / factor, size / MAX_ZOOM, size);
  const ratio = w / view.w;
  return inside(
    { w, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio },
    size,
  );
}

/** Moves the view by `dx`, `dy` drawing units. */
export function panBy(view: View, size: number, dx: number, dy: number): View {
  return inside({ ...view, x: view.x + dx, y: view.y + dy }, size);
}

/** Zoom factor of a wheel turn; lines count as 16 pixels, pages as 100. */
export function wheelFactor(deltaY: number, deltaMode: number): number {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1);
  return Math.exp(clamp(-pixels, -300, 300) * 0.0015);
}
