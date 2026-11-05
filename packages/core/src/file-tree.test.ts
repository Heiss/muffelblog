import { describe, expect, it } from 'vitest';
import { buildFileTree } from './file-tree.ts';

const a = (
  path: string,
  type: 'post' | 'glossary' | 'page',
  slug: string,
  title = slug,
) => ({
  path,
  type,
  slug,
  title,
});

describe('buildFileTree', () => {
  it('rebuilds the folders of the published files, folders first, sorted', () => {
    const tree = buildFileTree([
      a('zebra.md', 'post', 'zebra'),
      a('glossar/cache.md', 'glossary', 'cache', 'Was ist ein Cache?'),
      a('Äpfel.md', 'post', 'aepfel'),
      a('seiten/impressum.md', 'page', 'impressum'),
      a('glossar/tief/abbund.md', 'glossary', 'abbund'),
    ]);
    expect(tree.folders.map((f) => f.name)).toEqual(['glossar', 'seiten']);
    expect(tree.files.map((f) => f.name)).toEqual(['Äpfel.md', 'zebra.md']);
    const glossar = tree.folders[0];
    expect(glossar?.folders.map((f) => f.name)).toEqual(['tief']);
    expect(glossar?.files).toEqual([
      { name: 'cache.md', title: 'Was ist ein Cache?', url: '/g/cache/' },
    ]);
    expect(tree.folders[1]?.files[0]?.url).toBe('/impressum/');
  });

  it('links each kind to its own address', () => {
    const tree = buildFileTree([a('x.md', 'post', 'x')]);
    expect(tree.files[0]?.url).toBe('/p/x/');
  });

  it('counts the files of a folder and its subfolders', () => {
    const tree = buildFileTree([
      a('a/b/c.md', 'post', 'c'),
      a('a/d.md', 'post', 'd'),
    ]);
    expect(tree.folders[0]?.count).toBe(2);
    expect(tree.count).toBe(2);
  });

  it('is empty without files', () => {
    expect(buildFileTree([])).toEqual({
      name: '',
      folders: [],
      files: [],
      count: 0,
    });
  });
});
