import { describe, expect, it } from 'vitest';
import { blockPfad, frischeIds, parseFilter, reihePfad } from './feed-logic';

describe('parseFilter', () => {
  it('kennt alle, post und memo', () => {
    expect(parseFilter('alle')).toBe('alle');
    expect(parseFilter('post')).toBe('post');
    expect(parseFilter('memo')).toBe('memo');
  });

  it('fällt bei Unbekanntem auf alle zurück', () => {
    for (const roh of [null, undefined, '', 'Post', '__proto__', '{"a":1}']) {
      expect(parseFilter(roh)).toBe('alle');
    }
  });
});

describe('reihePfad', () => {
  it('ordnet jedem Filter die erste Seite seiner Reihe zu', () => {
    expect(reihePfad('alle')).toBe('/');
    expect(reihePfad('post')).toBe('/posts/');
    expect(reihePfad('memo')).toBe('/memos/');
  });
});

describe('blockPfad', () => {
  const origin = 'https://example.org';

  it('akzeptiert Blöcke der eigenen Seite', () => {
    for (const pfad of [
      '/',
      '/seite/2/',
      '/memos/',
      '/memos/seite/3/',
      '/posts/seite/12/',
      '/tag/rust/',
      '/tag/a-b/seite/2/',
    ]) {
      expect(blockPfad(pfad, origin)).toBe(pfad);
    }
  });

  it('akzeptiert absolute Adressen der eigenen Herkunft und liefert den Pfad', () => {
    expect(blockPfad('https://example.org/seite/2/', origin)).toBe('/seite/2/');
  });

  it('lehnt fremde Herkunft, Schemas und Umwege ab', () => {
    for (const roh of [
      'https://evil.example/seite/2/',
      '//evil.example/seite/2/',
      'javascript:alert(1)',
      'data:text/html,x',
      '/p/hallo-welt/',
      '/seite/1/',
      '/seite/0/',
      '/seite/2',
      '/seite/2/?x=1',
      '/seite/2/#x',
      '/tag/A B/',
      '/../seite/2/',
      '',
    ]) {
      expect(blockPfad(roh, origin)).toBeNull();
    }
  });
});

describe('frischeIds', () => {
  it('liefert nur Kennungen, die noch fehlen, ohne Doppelte', () => {
    const vorhanden = new Set(['post:a', 'memo:x']);
    expect(
      frischeIds(vorhanden, ['post:a', 'post:b', 'post:b', 'memo:y']),
    ).toEqual(['post:b', 'memo:y']);
  });
});
