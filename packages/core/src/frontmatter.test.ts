import { describe, expect, it } from 'vitest';
import { splitFrontmatter } from './frontmatter.ts';

describe('splitFrontmatter', () => {
  it('splits frontmatter and text', () => {
    const result = splitFrontmatter(
      '---\ntitle: A\npublish: true\n---\n\nText hier\n',
    );
    expect(result).toEqual({
      ok: true,
      data: { title: 'A', publish: true },
      body: '\nText hier\n',
    });
  });

  it('returns empty data without frontmatter', () => {
    expect(splitFrontmatter('Nur Text\n')).toEqual({
      ok: true,
      data: {},
      body: 'Nur Text\n',
    });
  });

  it('copes with Windows line endings', () => {
    const result = splitFrontmatter('---\r\ntitle: A\r\n---\r\nText\r\n');
    expect(result).toEqual({ ok: true, data: { title: 'A' }, body: 'Text\n' });
  });

  it('ignores a byte order mark at the start', () => {
    const result = splitFrontmatter(
      String.fromCharCode(0xfeff) + '---\ntitle: A\n---\nText\n',
    );
    expect(result).toMatchObject({ ok: true, data: { title: 'A' } });
  });

  it('reports invalid YAML', () => {
    const result = splitFrontmatter('---\ntitle: [offen\n---\nText\n');
    expect(result.ok).toBe(false);
  });

  it('reports frontmatter that is not an object', () => {
    const result = splitFrontmatter('---\n- a\n- b\n---\nText\n');
    expect(result.ok).toBe(false);
  });

  it('reports a missing closing separator', () => {
    const result = splitFrontmatter('---\ntitle: A\nText\n');
    expect(result.ok).toBe(false);
  });

  it('treats empty frontmatter as an empty object', () => {
    expect(splitFrontmatter('---\n---\nText\n')).toEqual({
      ok: true,
      data: {},
      body: 'Text\n',
    });
  });
});
