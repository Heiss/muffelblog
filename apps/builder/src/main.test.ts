import { describe, expect, it } from 'vitest';
import { SITE_NAME } from '@muffelblog/core';
import { describeBuilder } from './main.ts';

describe('describeBuilder', () => {
  it('names the site from the shared package', () => {
    expect(describeBuilder()).toBe(`Builder for ${SITE_NAME}`);
  });
});
