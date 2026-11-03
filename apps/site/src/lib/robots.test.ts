import { describe, expect, it } from 'vitest';
import { robotsTxt } from './robots';

describe('robotsTxt', () => {
  it('allows everything and names no sitemap without a domain', () => {
    expect(robotsTxt(undefined)).toBe('User-agent: *\nAllow: /\n');
  });
  it('names the sitemap with the domain', () => {
    expect(robotsTxt('https://example.org')).toContain(
      'Sitemap: https://example.org/sitemap.xml',
    );
  });
});
