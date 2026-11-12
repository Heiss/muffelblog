import { describe, expect, it } from 'vitest';
import { memosFingerprint } from './memos.ts';
import type { MemoRaw } from './memos.ts';

const memo = (over: Partial<MemoRaw> = {}): MemoRaw => ({
  name: 'memos/a',
  content: 'Text #tag',
  visibility: 'PUBLIC',
  createTime: '2026-11-01T10:00:00Z',
  tags: ['tag'],
  attachments: [],
  ...over,
});

describe('memosFingerprint', () => {
  it('is the same for the same memos in any order', () => {
    const a = memo();
    const b = memo({ name: 'memos/b' });
    expect(memosFingerprint([a, b])).toBe(memosFingerprint([b, a]));
  });

  it('changes when a memo is edited, added, removed or its attachments change', () => {
    const base = memosFingerprint([memo()]);
    expect(
      memosFingerprint([memo({ content: 'Text geändert #tag' })]),
    ).not.toBe(base);
    expect(memosFingerprint([memo(), memo({ name: 'memos/b' })])).not.toBe(
      base,
    );
    expect(memosFingerprint([])).not.toBe(base);
    expect(
      memosFingerprint([
        memo({
          attachments: [
            { name: 'attachments/x', filename: 'x.jpg', type: 'image/jpeg' },
          ],
        }),
      ]),
    ).not.toBe(base);
    expect(
      memosFingerprint([memo({ createTime: '2026-11-01T11:00:00Z' })]),
    ).not.toBe(base);
    expect(
      memosFingerprint([memo({ updateTime: '2026-11-03T11:00:00Z' })]),
    ).not.toBe(base);
  });

  it('does not depend on field order of tags or noise fields', () => {
    expect(memosFingerprint([memo({ tags: ['a', 'b'] })])).toBe(
      memosFingerprint([memo({ tags: ['b', 'a'] })]),
    );
  });
});
