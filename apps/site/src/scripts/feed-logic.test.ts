import { describe, expect, it } from 'vitest';
import { blockPath, freshIds, parseFilter, seriesPath } from './feed-logic';

describe('parseFilter', () => {
  it('knows all, post and memo', () => {
    expect(parseFilter('all')).toBe('all');
    expect(parseFilter('post')).toBe('post');
    expect(parseFilter('memo')).toBe('memo');
  });

  it('falls back to all for unknown values', () => {
    for (const raw of [null, undefined, '', 'Post', '__proto__', '{"a":1}']) {
      expect(parseFilter(raw)).toBe('all');
    }
  });
});

describe('seriesPath', () => {
  it('maps each filter to the first page of its series', () => {
    expect(seriesPath('all')).toBe('/');
    expect(seriesPath('post')).toBe('/posts/');
    expect(seriesPath('memo')).toBe('/memos/');
  });
});

describe('blockPath', () => {
  const origin = 'https://example.org';

  it('accepts blocks of the own site', () => {
    for (const route of [
      '/',
      '/page/2/',
      '/memos/',
      '/memos/page/3/',
      '/posts/page/12/',
      '/tag/rust/',
      '/tag/a-b/page/2/',
    ]) {
      expect(blockPath(route, origin)).toBe(route);
    }
  });

  it('accepts absolute addresses of the own origin and returns the path', () => {
    expect(blockPath('https://example.org/page/2/', origin)).toBe('/page/2/');
  });

  it('rejects foreign origins, schemes and detours', () => {
    for (const raw of [
      'https://evil.example/page/2/',
      '//evil.example/page/2/',
      'javascript:alert(1)',
      'data:text/html,x',
      '/p/hallo-welt/',
      '/page/1/',
      '/page/0/',
      '/page/2',
      '/page/2/?x=1',
      '/page/2/#x',
      '/tag/A B/',
      '/../page/2/',
      '',
    ]) {
      expect(blockPath(raw, origin)).toBeNull();
    }
  });
});

describe('freshIds', () => {
  it('returns only identifiers that are still missing, without duplicates', () => {
    const existing = new Set(['post:a', 'memo:x']);
    expect(
      freshIds(existing, ['post:a', 'post:b', 'post:b', 'memo:y']),
    ).toEqual(['post:b', 'memo:y']);
  });
});
