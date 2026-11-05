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

/**
 * A small force layout (repulsion between all nodes, springs along edges),
 * deterministic: the same graph gives the same picture. Coordinates in a
 * square of `size`.
 */
export function layout(
  graph: Graph,
  options: { size?: number; iterations?: number; center?: string } = {},
): Placed[] {
  const size = options.size ?? 600;
  const n = graph.nodes.length;
  if (n === 0) return [];
  const pos = graph.nodes.map((node, i) => {
    if (node.id === options.center) return { x: 0, y: 0 };
    const angle = (2 * Math.PI * i) / n;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  const index = new Map(graph.nodes.map((node, i) => [node.id, i]));
  const k = Math.sqrt(1 / n);
  let temperature = 0.1;
  const iterations = options.iterations ?? 300;
  for (let step = 0; step < iterations; step++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos[i] as { x: number; y: number };
        const b = pos[j] as { x: number; y: number };
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) {
          dx = 1e-3 * (i - j);
          dy = 1e-3;
          dist = Math.hypot(dx, dy);
        }
        const force = (REPULSION * k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        (disp[i] as { x: number }).x += fx;
        (disp[i] as { y: number }).y += fy;
        (disp[j] as { x: number }).x -= fx;
        (disp[j] as { y: number }).y -= fy;
      }
    }
    for (const e of graph.edges) {
      const i = index.get(e.from);
      const j = index.get(e.to);
      if (i === undefined || j === undefined) continue;
      const a = pos[i] as { x: number; y: number };
      const b = pos[j] as { x: number; y: number };
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.max(Math.hypot(dx, dy), 1e-6);
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      (disp[i] as { x: number }).x -= fx;
      (disp[i] as { y: number }).y -= fy;
      (disp[j] as { x: number }).x += fx;
      (disp[j] as { y: number }).y += fy;
    }
    for (let i = 0; i < n; i++) {
      if (graph.nodes[i]?.id === options.center) continue;
      const d = disp[i] as { x: number; y: number };
      // Gravity: unlinked nodes stay near the middle instead of drifting away
      // and squeezing the linked groups together.
      const p0 = pos[i] as { x: number; y: number };
      d.x -= p0.x * GRAVITY;
      d.y -= p0.y * GRAVITY;
      const len = Math.max(Math.hypot(d.x, d.y), 1e-9);
      const p = pos[i] as { x: number; y: number };
      p.x += (d.x / len) * Math.min(len, temperature);
      p.y += (d.y / len) * Math.min(len, temperature);
    }
    temperature *= 0.985;
  }
  // Fit into the square with a margin for the labels.
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 1e-6);
  const margin = size * 0.12;
  const scale = (size - 2 * margin) / span;
  return graph.nodes.map((node, i) => ({
    ...node,
    x: n === 1 ? size / 2 : margin + ((pos[i]?.x ?? 0) - minX) * scale,
    y: n === 1 ? size / 2 : margin + ((pos[i]?.y ?? 0) - minY) * scale,
  }));
}
