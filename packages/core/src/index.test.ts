import { describe, expect, it } from 'vitest';
import { SITE_NAME, pageTitle } from './index.ts';

describe('pageTitle', () => {
  it('returns the site name if no title is given', () => {
    expect(pageTitle()).toBe(SITE_NAME);
  });

  it('appends the site name to a title', () => {
    expect(pageTitle('Hallo Welt')).toBe(`Hallo Welt – ${SITE_NAME}`);
  });

  it('ignores empty and whitespace-only titles', () => {
    expect(pageTitle('')).toBe(SITE_NAME);
    expect(pageTitle('   ')).toBe(SITE_NAME);
  });
});
