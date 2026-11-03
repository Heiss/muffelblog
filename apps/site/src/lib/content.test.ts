import { describe, expect, it } from 'vitest';
import { contentConfig } from './content.ts';

describe('contentConfig', () => {
  it('requires explicit configuration and never silently delivers sample data', () => {
    expect(() => contentConfig({})).toThrow(/CONTENT_DIR/);
    expect(() => contentConfig({})).toThrow(/MEMOS_URL/);
    expect(() => contentConfig({})).toThrow(/MUFFEL_FIXTURES/);
  });

  it('names the missing variable if only one is set', () => {
    expect(() => contentConfig({ CONTENT_DIR: '/content' })).toThrow(
      /MEMOS_URL/,
    );
    expect(() => contentConfig({ MEMOS_URL: 'http://memos:5230' })).toThrow(
      /CONTENT_DIR/,
    );
  });

  it('uses the sample data only with MUFFEL_FIXTURES=1', () => {
    const config = contentConfig({ MUFFEL_FIXTURES: '1' });
    expect(config.contentDir).toMatch(/packages\/core\/fixtures\/content$/);
    expect(typeof config.memos.listPublicMemos).toBe('function');
    expect(() => contentConfig({ MUFFEL_FIXTURES: 'true' })).toThrow(
      /CONTENT_DIR/,
    );
  });

  it('stops on an invalid time limit instead of ignoring it', () => {
    const env = { CONTENT_DIR: '/content', MEMOS_URL: 'http://memos:5230' };
    expect(() =>
      contentConfig({ ...env, MUFFEL_MEMOS_TIMEOUT_MS: 'fast' }),
    ).toThrow(/MUFFEL_MEMOS_TIMEOUT_MS/);
    expect(() =>
      contentConfig({ ...env, MUFFEL_MEMOS_TIMEOUT_MS: '5000' }),
    ).not.toThrow();
  });

  it('takes folder and Memos address from the environment', () => {
    const config = contentConfig({
      CONTENT_DIR: '/content',
      MEMOS_URL: 'http://memos:5230',
    });
    expect(config.contentDir).toBe('/content');
  });

  it('rejects an invalid Memos address', () => {
    expect(() =>
      contentConfig({ CONTENT_DIR: '/content', MEMOS_URL: 'not a url' }),
    ).toThrow();
  });
});
