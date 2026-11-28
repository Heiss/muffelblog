import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import type { Simulation, SimulationLinkDatum } from 'd3-force';

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

/** A node in the simulation: position and the number of links. */
export interface SimNode extends GNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  degree: number;
}
export type SimLink = SimulationLinkDatum<SimNode>;

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

/** The parts of a click that decide what it does with a point. */
export interface PointClick {
  button: number;
  detail: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * What a click on a point of the overall view does (owner, 2026-11-28): a
 * click makes the point the focus, the second click of a double click opens
 * its page, and a click with Ctrl, Cmd, Shift or Alt or another button stays
 * with the browser (a new tab or window). Enter on a point is a click with
 * detail 0 and makes it the focus too.
 */
export function pointAction(click: PointClick): 'focus' | 'open' | 'browser' {
  const modified =
    click.ctrlKey || click.metaKey || click.shiftKey || click.altKey;
  if (modified || click.button !== 0) return 'browser';
  return click.detail >= 2 ? 'open' : 'focus';
}

// Distances are in drawing units (one unit is one pixel at zoom 1).
const LINK_DISTANCE = 120;
const CHARGE = 520;
const COLLIDE = 34;
const GRAVITY = 0.035;
const WARM_UP_TICKS = 400;

export interface Simulated {
  nodes: SimNode[];
  links: SimLink[];
  simulation: Simulation<SimNode, SimLink>;
}

function degrees(graph: Graph): Map<string, number> {
  const count = new Map<string, number>();
  for (const e of graph.edges) {
    count.set(e.from, (count.get(e.from) ?? 0) + 1);
    count.set(e.to, (count.get(e.to) ?? 0) + 1);
  }
  return count;
}

/**
 * The force layout: nodes repel each other and keep a distance, edges are
 * springs, a weak pull to the middle keeps separate groups together. It is
 * warmed up here, so the first picture is settled, and returned stopped; the
 * caller restarts it when a node is dragged. The same graph gives the same
 * picture (d3-force uses its own deterministic random numbers). `center` is
 * fixed in the middle.
 */
export function buildSimulation(
  graph: Graph,
  options: { center?: string } = {},
): Simulated {
  const degree = degrees(graph);
  const nodes: SimNode[] = graph.nodes.map((n, i) => {
    // The start position on a spiral; d3 would use the same, this is explicit.
    const angle = i * 2.399963;
    const radius = 30 * Math.sqrt(i + 1);
    const fixed = n.id === options.center;
    return {
      ...n,
      x: fixed ? 0 : radius * Math.cos(angle),
      y: fixed ? 0 : radius * Math.sin(angle),
      ...(fixed ? { fx: 0, fy: 0 } : {}),
      degree: degree.get(n.id) ?? 0,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: SimLink[] = graph.edges.flatMap((e) => {
    const source = byId.get(e.from);
    const target = byId.get(e.to);
    return source && target ? [{ source, target }] : [];
  });
  const simulation = forceSimulation<SimNode>(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((n) => n.id)
        .distance(LINK_DISTANCE),
    )
    .force('charge', forceManyBody<SimNode>().strength(-CHARGE))
    .force('collide', forceCollide<SimNode>(COLLIDE))
    .force('x', forceX<SimNode>(0).strength(GRAVITY))
    .force('y', forceY<SimNode>(0).strength(GRAVITY))
    .stop();
  simulation.tick(WARM_UP_TICKS);
  return { nodes, links, simulation };
}

/** The zoom level from which a node's label is shown (semantic zoom). */
export function labelThreshold(node: SimNode, isCenter: boolean): number {
  if (isCenter) return 0;
  if (node.kind === 'memo') return 2.4;
  if (node.kind === 'domain') return 1.8;
  // Hubs first, then every other post and term.
  return node.degree >= 3 ? 0 : 1.15;
}

export const labelVisible = (
  node: SimNode,
  zoom: number,
  isCenter: boolean,
): boolean => zoom >= labelThreshold(node, isCenter);

export interface Transform {
  x: number;
  y: number;
  k: number;
}

/**
 * The zoom and shift that show all nodes inside `width` x `height` with a
 * margin. It zooms in at most to `maxZoom`, so a small graph is not blown up.
 */
export function fitTransform(
  nodes: ReadonlyArray<{ x: number; y: number }>,
  width: number,
  height: number,
  options: { padding?: number; maxZoom?: number } = {},
): Transform {
  const padding = options.padding ?? 48;
  const maxZoom = options.maxZoom ?? 1.6;
  if (nodes.length === 0) return { x: width / 2, y: height / 2, k: 1 };
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const boxW = Math.max(maxX - minX, 1);
  const boxH = Math.max(maxY - minY, 1);
  const k = Math.min(
    maxZoom,
    (width - 2 * padding) / boxW,
    (height - 2 * padding) / boxH,
  );
  return {
    k,
    x: width / 2 - ((minX + maxX) / 2) * k,
    y: height / 2 - ((minY + maxY) / 2) * k,
  };
}
