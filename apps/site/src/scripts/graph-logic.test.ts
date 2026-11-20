import { describe, expect, it } from 'vitest';
import {
  buildSimulation,
  fitTransform,
  labelThreshold,
  labelVisible,
  neighborhood,
  type Graph,
  type SimNode,
} from './graph-logic';

const graph: Graph = {
  nodes: [
    { id: '/p/a/', kind: 'post', title: 'A' },
    { id: '/g/b/', kind: 'glossary', title: 'B' },
    { id: '/m/c/', kind: 'memo', title: 'C' },
    { id: 'domain:x.org', kind: 'domain', title: 'x.org' },
  ],
  edges: [
    { from: '/p/a/', to: '/g/b/' },
    { from: '/m/c/', to: '/p/a/' },
    { from: '/g/b/', to: 'domain:x.org' },
  ],
};

/** Two groups that are not linked, plus loose nodes: the hard case for a layout. */
function bigGraph(): Graph {
  const nodes: Graph['nodes'] = [];
  const edges: Graph['edges'] = [];
  for (let group = 0; group < 3; group++) {
    const hub = `/p/hub${group}/`;
    nodes.push({ id: hub, kind: 'post', title: `Hub ${group}` });
    for (let i = 0; i < 6; i++) {
      const id = `/g/t${group}-${i}/`;
      nodes.push({ id, kind: 'glossary', title: `T ${group}-${i}` });
      edges.push({ from: hub, to: id });
    }
  }
  for (let i = 0; i < 8; i++)
    nodes.push({ id: `/m/loose${i}/`, kind: 'memo', title: `Memo ${i}` });
  return { nodes, edges };
}

const distance = (a: SimNode, b: SimNode) => Math.hypot(a.x - b.x, a.y - b.y);

describe('neighborhood', () => {
  it('keeps the node, its neighbors in both directions and their edges', () => {
    const g = neighborhood(graph, '/p/a/');
    expect(g.nodes.map((n) => n.id)).toEqual(['/p/a/', '/g/b/', '/m/c/']);
    expect(g.edges).toHaveLength(2);
  });
});

describe('buildSimulation', () => {
  it('gives the same picture every time and leaves the simulation stopped', () => {
    const a = buildSimulation(bigGraph());
    const b = buildSimulation(bigGraph());
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(
      b.nodes.map((n) => [n.x, n.y]),
    );
    expect(a.links).toHaveLength(18);
    a.simulation.stop();
    b.simulation.stop();
  });

  it('counts the links of every node', () => {
    const { nodes, simulation } = buildSimulation(graph);
    const degree = Object.fromEntries(nodes.map((n) => [n.id, n.degree]));
    expect(degree).toEqual({
      '/p/a/': 2,
      '/g/b/': 2,
      '/m/c/': 1,
      'domain:x.org': 1,
    });
    simulation.stop();
  });

  it('keeps every node clearly apart (room for the points and their labels)', () => {
    const { nodes, simulation } = buildSimulation(bigGraph());
    let closest = Infinity;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        closest = Math.min(closest, distance(nodes[i]!, nodes[j]!));
    expect(closest).toBeGreaterThan(30);
    simulation.stop();
  });

  it('keeps groups that are not linked together, not flung apart', () => {
    const { nodes, simulation } = buildSimulation(bigGraph());
    const far = Math.max(...nodes.map((n) => Math.hypot(n.x, n.y)));
    expect(far).toBeLessThan(900);
    simulation.stop();
  });

  it('fixes the center node in the middle', () => {
    const { nodes, simulation } = buildSimulation(
      neighborhood(graph, '/p/a/'),
      {
        center: '/p/a/',
      },
    );
    const center = nodes.find((n) => n.id === '/p/a/');
    expect([center?.x, center?.y]).toEqual([0, 0]);
    simulation.stop();
  });

  it('ignores edges to nodes that do not exist', () => {
    const { links, simulation } = buildSimulation({
      nodes: [{ id: 'a', kind: 'post', title: 'a' }],
      edges: [{ from: 'a', to: 'gone' }],
    });
    expect(links).toEqual([]);
    simulation.stop();
  });
});

describe('semantic zoom of the labels', () => {
  const node = (kind: SimNode['kind'], degree: number): SimNode => ({
    id: 'x',
    kind,
    title: 'x',
    x: 0,
    y: 0,
    degree,
  });

  it('shows hubs from the start, other posts and terms a bit later, websites and memos last', () => {
    expect(labelThreshold(node('post', 5), false)).toBe(0);
    expect(labelThreshold(node('glossary', 1), false)).toBeGreaterThan(1);
    expect(labelThreshold(node('domain', 1), false)).toBeGreaterThan(
      labelThreshold(node('post', 1), false),
    );
    expect(labelThreshold(node('memo', 1), false)).toBeGreaterThan(
      labelThreshold(node('domain', 1), false),
    );
  });

  it('always shows the label of the center node', () => {
    expect(labelVisible(node('memo', 0), 0.2, true)).toBe(true);
  });

  it('shows more labels the further one zooms in', () => {
    const nodes = [
      node('post', 4),
      node('post', 1),
      node('domain', 1),
      node('memo', 1),
    ];
    const shown = (zoom: number) =>
      nodes.filter((n) => labelVisible(n, zoom, false)).length;
    expect([shown(0.5), shown(1.2), shown(2), shown(3)]).toEqual([1, 2, 3, 4]);
  });
});

describe('fitTransform', () => {
  it('centers all nodes with a margin and zooms to fit', () => {
    const t = fitTransform(
      [
        { x: -100, y: -50 },
        { x: 300, y: 150 },
      ],
      800,
      400,
      { padding: 50, maxZoom: 5 },
    );
    // 700 / 400 = 1.75 wide, 300 / 200 = 1.5 high: the smaller wins.
    expect(t.k).toBeCloseTo(1.5);
    // The middle of the box (100, 50) lands in the middle of the view.
    expect(100 * t.k + t.x).toBeCloseTo(400);
    expect(50 * t.k + t.y).toBeCloseTo(200);
  });

  it('does not blow a small graph up beyond the maximum', () => {
    const t = fitTransform(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      800,
      600,
      { maxZoom: 1.6 },
    );
    expect(t.k).toBe(1.6);
  });

  it('handles no nodes and a single node', () => {
    expect(fitTransform([], 800, 600)).toEqual({ x: 400, y: 300, k: 1 });
    const one = fitTransform([{ x: 5, y: 5 }], 800, 600);
    expect(5 * one.k + one.x).toBeCloseTo(400);
  });
});
