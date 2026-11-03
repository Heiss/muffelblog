import { describe, expect, it } from 'vitest';
import { SITE_NAME } from '@muffelblog/core';
import { describeBuilder } from './main.ts';

describe('describeBuilder', () => {
  it('nennt den Seitennamen aus dem gemeinsamen Paket', () => {
    expect(describeBuilder()).toBe(`Builder for ${SITE_NAME}`);
  });
});
