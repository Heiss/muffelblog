import { describe, expect, it } from 'vitest';
import {
  emptyReceiveState,
  mentionKey,
  mentionText,
  parseDeleted,
  parseMentions,
  planReceive,
  targetPage,
} from './webmention-receive.ts';

const SITE = 'https://blog.example.org';

const jf2 = (children: unknown[]) => ({
  type: 'feed',
  name: 'Webmentions',
  children,
});
const entry = (over: Record<string, unknown> = {}) => ({
  type: 'entry',
  author: {
    type: 'card',
    name: 'Ada',
    url: 'https://ada.example',
    photo: 'https://ada.example/a.jpg',
  },
  url: 'https://ada.example/post',
  'wm-id': 1001,
  'wm-source': 'https://ada.example/post',
  'wm-target': 'https://blog.example.org/p/hallo-welt/',
  'wm-property': 'mention-of',
  'wm-received': '2026-11-05T10:00:00Z',
  content: { text: 'Hallo', html: '<p>Hallo</p>' },
  ...over,
});

describe('parseMentions', () => {
  it('reads the fields of a jf2 feed of webmention.io', () => {
    const [m] = parseMentions(jf2([entry()]));
    expect(m).toEqual({
      id: 1001,
      source: 'https://ada.example/post',
      target: 'https://blog.example.org/p/hallo-welt/',
      property: 'mention-of',
      authorName: 'Ada',
    });
  });

  it('skips entries without id, source or target, and non-http sources', () => {
    const list = parseMentions(
      jf2([
        entry({ 'wm-id': 'x' }),
        entry({ 'wm-source': undefined }),
        entry({ 'wm-target': 5 }),
        entry({ 'wm-source': 'javascript:alert(1)' }),
        entry({ 'wm-id': 2 }),
      ]),
    );
    expect(list.map((m) => m.id)).toEqual([2]);
  });

  it('ignores private mentions', () => {
    expect(parseMentions(jf2([entry({ 'wm-private': true })]))).toEqual([]);
  });

  it('refuses something that is not a feed', () => {
    expect(() => parseMentions({ error: 'forbidden' })).toThrow(/feed/);
  });
});

describe('parseDeleted', () => {
  it('reads the deleted mentions', () => {
    expect(
      parseDeleted([
        {
          'wm-id': 7,
          'wm-source': 'https://a.example/',
          'wm-target': `${SITE}/p/x/`,
          'wm-deleted': '2026-11-05T11:00:00Z',
        },
        { 'wm-id': 'bad' },
      ]),
    ).toEqual([
      { id: 7, source: 'https://a.example/', target: `${SITE}/p/x/` },
    ]);
  });
});

describe('targetPage', () => {
  it('accepts posts, memos and terms of the own site', () => {
    expect(targetPage(`${SITE}/p/hallo-welt/`, SITE)).toBe(
      `${SITE}/p/hallo-welt/`,
    );
    expect(targetPage(`${SITE}/m/abc`, SITE)).toBe(`${SITE}/m/abc/`);
    expect(targetPage(`${SITE}/g/cache/#x`, SITE)).toBe(`${SITE}/g/cache/`);
  });

  it('refuses other pages and other hosts', () => {
    for (const t of [
      `${SITE}/`,
      `${SITE}/glossary/`,
      'https://other.example/p/x/',
      `${SITE}/p/a/b/`,
      'nonsense',
    ])
      expect(targetPage(t, SITE), t).toBeUndefined();
  });
});

describe('mentionText', () => {
  it('names the kind, the author and links the source', () => {
    expect(
      mentionText(
        {
          id: 1,
          source: 'https://ada.example/post',
          target: '',
          property: 'in-reply-to',
          authorName: 'Ada',
        },
        'en',
      ),
    ).toBe(
      'Reply from Ada: [https://ada.example/post](https://ada.example/post)',
    );
  });

  it('uses the host when there is no author name, and German texts', () => {
    expect(
      mentionText(
        {
          id: 1,
          source: 'https://ada.example/post',
          target: '',
          property: 'like-of',
        },
        'de',
      ),
    ).toBe(
      'Like von ada.example: [https://ada.example/post](https://ada.example/post)',
    );
  });

  it('escapes Markdown in the author name and in the link', () => {
    const text = mentionText(
      {
        id: 1,
        source: 'https://ada.example/a_(b)',
        target: '',
        property: 'mention-of',
        authorName: '*evil* [x](javascript:1) <b>',
      },
      'en',
    );
    expect(text).not.toContain('](javascript');
    expect(text).not.toContain('<b>');
    expect(text).toContain('https://ada.example/a_%28b%29');
  });
});

describe('planReceive', () => {
  const m = (
    id: number,
    target = `${SITE}/p/hallo-welt/`,
    source = `https://s${id}.example/`,
  ) => ({
    id,
    source,
    target,
    property: 'mention-of',
  });

  it('posts new mentions to their page and skips the ones already posted', () => {
    const state = emptyReceiveState();
    state.posted[mentionKey(m(1))] = {
      commentId: 'c1',
      page: `${SITE}/p/hallo-welt/`,
      wmId: 1,
    };
    const plan = planReceive(state, [m(1), m(2)], [], SITE);
    expect(plan.post.map((p) => p.mention.id)).toEqual([2]);
    expect(plan.post[0]?.page).toBe(`${SITE}/p/hallo-welt/`);
  });

  it('skips mentions of pages that are no post, memo or term', () => {
    const plan = planReceive(
      emptyReceiveState(),
      [m(3, `${SITE}/glossary/`)],
      [],
      SITE,
    );
    expect(plan.post).toEqual([]);
    expect(plan.skipped).toBe(1);
  });

  it('posts the same source and target only once, even with two ids', () => {
    const plan = planReceive(
      emptyReceiveState(),
      [
        m(4, undefined, 'https://a.example/'),
        m(5, undefined, 'https://a.example/'),
      ],
      [],
      SITE,
    );
    expect(plan.post).toHaveLength(1);
  });

  it('removes the comment of a deleted mention', () => {
    const state = emptyReceiveState();
    state.posted[mentionKey(m(6))] = {
      commentId: 'c6',
      page: `${SITE}/p/hallo-welt/`,
      wmId: 6,
    };
    const plan = planReceive(
      state,
      [],
      [{ id: 6, source: m(6).source, target: m(6).target }],
      SITE,
    );
    expect(plan.remove).toEqual([
      { key: mentionKey(m(6)), commentId: 'c6', page: `${SITE}/p/hallo-welt/` },
    ]);
  });

  it('moves the since id to the highest id seen', () => {
    const plan = planReceive(emptyReceiveState(), [m(9), m(12)], [], SITE);
    expect(plan.sinceId).toBe(12);
  });
});
