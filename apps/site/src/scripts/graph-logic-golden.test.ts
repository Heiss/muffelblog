import { describe, expect, it } from 'vitest';
import { layout, neighborhood, type GNode } from './graph-logic.ts';

// The layout is deterministic: these pictures are fixed, so any change of the
// forces, the cooling or the scaling shows up here.

const node = (id: string): GNode => ({ id, kind: 'post', title: id });
const graph = {
  nodes: ['a', 'b', 'c', 'd', 'e'].map(node),
  edges: [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
    { from: 'c', to: 'd' },
    { from: 'x', to: 'a' },
  ],
};

const rounded = (placed: { x: number; y: number }[]) =>
  placed.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);

describe('layout: fixed pictures', () => {
  it('places a small graph the same way every time', () => {
    expect(rounded(layout(graph))).toEqual([
      [354.9, 523.3],
      [493.1, 528],
      [207.1, 504.6],
      [72, 474.8],
      [336.8, 72],
    ]);
  });

  it('keeps the center fixed and uses size and iterations', () => {
    expect(
      rounded(layout(graph, { center: 'a', size: 100, iterations: 40 })),
    ).toEqual([
      [51.2, 49.9],
      [66.6, 63.2],
      [32.4, 49.4],
      [12, 51],
      [88, 12],
    ]);
  });

  it('starts on a circle and scales it into the square', () => {
    const two = { nodes: [node('a'), node('b')], edges: [] };
    expect(rounded(layout(two, { iterations: 0 }))).toEqual([
      [528, 72],
      [72, 72],
    ]);
    expect(rounded(layout(two, { center: 'a', iterations: 5 }))).toEqual([
      [528, 72],
      [72, 72],
    ]);
  });

  it('puts a single node in the middle and nothing for an empty graph', () => {
    expect(layout({ nodes: [node('a')], edges: [] }, { size: 50 })).toEqual([
      { ...node('a'), x: 25, y: 25 },
    ]);
    expect(layout({ nodes: [], edges: [] })).toEqual([]);
  });
});

describe('neighborhood', () => {
  it('takes neighbors in both directions and only edges between them', () => {
    const near = neighborhood(graph, 'c');
    expect(near.nodes.map((n) => n.id)).toEqual(['a', 'c', 'd']);
    expect(near.edges).toEqual([
      { from: 'a', to: 'c' },
      { from: 'c', to: 'd' },
    ]);
  });
});
