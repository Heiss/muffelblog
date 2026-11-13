import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  fullView,
  layout,
  neighborhood,
  panBy,
  wheelFactor,
  zoomAt,
  type Graph,
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

describe('zoom', () => {
  const size = 900;

  it('starts with the whole drawing', () => {
    expect(fullView(size)).toEqual({ x: 0, y: 0, w: 900 });
  });

  it('keeps the point under the pointer where it is', () => {
    const before = fullView(size);
    const px = 300;
    const py = 600;
    const after = zoomAt(before, size, 2, px, py);
    expect(after.w).toBe(450);
    // The point stays at the same relative position inside the view.
    expect((px - after.x) / after.w).toBeCloseTo((px - before.x) / before.w);
    expect((py - after.y) / after.w).toBeCloseTo((py - before.y) / before.w);
  });

  it('does not zoom out beyond the drawing or in beyond the limit', () => {
    expect(zoomAt(fullView(size), size, 0.5, 450, 450)).toEqual(fullView(size));
    const far = zoomAt(fullView(size), size, 1000, 450, 450);
    expect(far.w).toBe(size / MAX_ZOOM);
  });

  it('zooming out again returns to the whole drawing', () => {
    const zoomed = zoomAt(fullView(size), size, 4, 100, 100);
    expect(zoomAt(zoomed, size, 1 / 4, 100, 100)).toEqual(fullView(size));
  });

  it('keeps the view inside the drawing at the edges', () => {
    const zoomed = zoomAt(fullView(size), size, 2, 0, 0);
    expect(zoomed.x).toBe(0);
    expect(zoomed.y).toBe(0);
    const corner = zoomAt(fullView(size), size, 2, 900, 900);
    expect(corner.x + corner.w).toBeLessThanOrEqual(size);
    expect(corner.y + corner.w).toBeLessThanOrEqual(size);
  });

  it('pans within the drawing and not beyond', () => {
    const zoomed = { x: 100, y: 100, w: 450 };
    expect(panBy(zoomed, size, 50, -30)).toEqual({ x: 150, y: 70, w: 450 });
    expect(panBy(zoomed, size, -500, -500)).toEqual({ x: 0, y: 0, w: 450 });
    expect(panBy(zoomed, size, 5000, 5000)).toEqual({ x: 450, y: 450, w: 450 });
    // Nothing to move when the whole drawing is visible.
    expect(panBy(fullView(size), size, 40, 40)).toEqual(fullView(size));
  });

  it('turns the wheel into a factor: up zooms in, down zooms out, lines count more', () => {
    expect(wheelFactor(-100, 0)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0)).toBeLessThan(1);
    expect(wheelFactor(0, 0)).toBe(1);
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-48, 0));
    // A huge delta is limited.
    expect(wheelFactor(-100000, 0)).toBeCloseTo(Math.exp(300 * 0.0015));
  });
});
