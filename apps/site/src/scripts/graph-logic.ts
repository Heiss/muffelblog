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

/** Nodes within `depth` hops, following incoming and outgoing edges. */
export function neighborhood(graph: Graph, id: string, depth = 1): Graph {
  const adjacent = new Map(graph.nodes.map((n) => [n.id, new Set<string>()]));
  for (const e of graph.edges) {
    adjacent.get(e.from)?.add(e.to);
    adjacent.get(e.to)?.add(e.from);
  }
  const ids = new Set<string>();
  let frontier = [id];
  for (let hop = 0; hop <= Math.min(depth, graph.nodes.length); hop++) {
    const next: string[] = [];
    for (const node of frontier) {
      if (ids.has(node)) continue;
      ids.add(node);
      next.push(...(adjacent.get(node) ?? []));
    }
    frontier = next;
  }
  return {
    nodes: graph.nodes.filter((n) => ids.has(n.id)),
    edges: graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
  };
}

/** A domain opens its referring entries; pages open their two-hop graph. */
export function graphUrl(id: string): string {
  const depth = id.startsWith('domain:') ? 1 : 2;
  return `/graph/?${new URLSearchParams({ node: id, depth: String(depth) })}`;
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
