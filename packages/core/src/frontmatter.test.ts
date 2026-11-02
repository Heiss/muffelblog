import { describe, expect, it } from 'vitest';
import { splitFrontmatter } from './frontmatter.ts';

describe('splitFrontmatter', () => {
  it('trennt Frontmatter und Text', () => {
    const result = splitFrontmatter(
      '---\ntitle: A\npublish: true\n---\n\nText hier\n',
    );
    expect(result).toEqual({
      ok: true,
      data: { title: 'A', publish: true },
      body: '\nText hier\n',
    });
  });

  it('liefert leere Daten ohne Frontmatter', () => {
    expect(splitFrontmatter('Nur Text\n')).toEqual({
      ok: true,
      data: {},
      body: 'Nur Text\n',
    });
  });

  it('kommt mit Windows-Zeilenenden zurecht', () => {
    const result = splitFrontmatter('---\r\ntitle: A\r\n---\r\nText\r\n');
    expect(result).toEqual({ ok: true, data: { title: 'A' }, body: 'Text\n' });
  });

  it('ignoriert eine Byte-Order-Marke am Anfang', () => {
    const result = splitFrontmatter(
      String.fromCharCode(0xfeff) + '---\ntitle: A\n---\nText\n',
    );
    expect(result).toMatchObject({ ok: true, data: { title: 'A' } });
  });

  it('meldet ungültiges YAML', () => {
    const result = splitFrontmatter('---\ntitle: [offen\n---\nText\n');
    expect(result.ok).toBe(false);
  });

  it('meldet Frontmatter, das kein Objekt ist', () => {
    const result = splitFrontmatter('---\n- a\n- b\n---\nText\n');
    expect(result.ok).toBe(false);
  });

  it('meldet fehlende schließende Trennlinie', () => {
    const result = splitFrontmatter('---\ntitle: A\nText\n');
    expect(result.ok).toBe(false);
  });

  it('behandelt ein leeres Frontmatter als leeres Objekt', () => {
    expect(splitFrontmatter('---\n---\nText\n')).toEqual({
      ok: true,
      data: {},
      body: 'Text\n',
    });
  });
});
