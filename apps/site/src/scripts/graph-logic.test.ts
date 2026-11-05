import { describe, expect, it } from 'vitest';
import { layout, neighborhood, type Graph } from './graph-logic';

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

describe('neighborhood', () => {
  it('keeps the node, its neighbors in both directions and their edges', () => {
    const g = neighborhood(graph, '/p/a/');
    expect(g.nodes.map((n) => n.id)).toEqual(['/p/a/', '/g/b/', '/m/c/']);
    expect(g.edges).toHaveLength(2);
  });
});

describe('layout', () => {
  it('places every node inside the square, the same way every time', () => {
    const a = layout(graph, { size: 400 });
    const b = layout(graph, { size: 400 });
    expect(a).toEqual(b);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(400);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(400);
    }
  });

  it('keeps nodes apart', () => {
    const placed = layout(graph, { size: 400 });
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const p = placed[i] as { x: number; y: number };
        const q = placed[j] as { x: number; y: number };
        expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(20);
      }
  });

  it('handles one node and no nodes', () => {
    expect(
      layout({ nodes: [graph.nodes[0] as never], edges: [] })[0],
    ).toMatchObject({ x: 300, y: 300 });
    expect(layout({ nodes: [], edges: [] })).toEqual([]);
  });
});
