import { describe, expect, it } from 'vitest';
import { hasExtras, isHttp, isPlainOrigin, tryUrl } from './url-check.ts';

describe('url checks', () => {
  it('parses an address or gives null', () => {
    expect(tryUrl('https://a.example/')?.host).toBe('a.example');
    expect(tryUrl('no address')).toBeNull();
  });

  it('knows http and https only', () => {
    expect(isHttp(new URL('https://a.example'))).toBe(true);
    expect(isHttp(new URL('http://a.example'))).toBe(true);
    expect(isHttp(new URL('ftp://a.example'))).toBe(false);
  });

  it('finds a login, a query or a fragment', () => {
    for (const raw of [
      'https://u@a.example',
      'https://u:p@a.example',
      'https://a.example/?x=1',
      'https://a.example/#x',
    ])
      expect(hasExtras(new URL(raw)), raw).toBe(true);
    expect(hasExtras(new URL('https://a.example/path'))).toBe(false);
  });

  it('accepts a plain origin only', () => {
    expect(isPlainOrigin(new URL('https://a.example'))).toBe(true);
    expect(isPlainOrigin(new URL('https://a.example/x'))).toBe(false);
    expect(isPlainOrigin(new URL('ftp://a.example'))).toBe(false);
    expect(isPlainOrigin(new URL('https://a.example/?q'))).toBe(false);
  });
});
