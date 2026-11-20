import { describe, expect, it } from 'vitest';
import { parseDocumentComment } from './margin-notes.ts';
import { renderMarkdown } from './render.ts';

const render = async (markdown: string, lang: 'en' | 'de' = 'de') =>
  (
    await renderMarkdown(markdown, {
      articlePath: 'a.md',
      lang,
      resolveImage: async () => ({ ok: false, code: 'not-found', reason: 'x' }),
    })
  ).html;

const THREAD = `Wir sollten <!--c:k3f9-->am Freitag veröffentlichen<!--/c:k3f9--> unabhängig von QA.
<!--co:k3f9 by:peter at:2026-06-17T10:00:00.000Z status:open quote:"am Freitag veröffentlichen"
peter (2026-06-17T10:00:00.000Z): Ich dachte **Donnerstag**?
sam (2026-06-17T10:05:00.000Z): Donnerstag ist besser für QA.
-->
`;

describe('parseDocumentComment', () => {
  it('reads status and the thread, with continuation lines and without reactions', () => {
    const found = parseDocumentComment(
      'co:k3f9 by:kyle at:2026-06-17T10:00:00.000Z status:open quote:"x"\nkyle (2026-06-17T10:00:00.000Z): Zeile eins\nZeile zwei\n+👍 sam\nsam (2026-06-17T10:05:00.000Z): Antwort\n',
    );
    expect(found).toEqual({
      id: 'k3f9',
      status: 'open',
      messages: [
        {
          author: 'kyle',
          at: '2026-06-17T10:00:00.000Z',
          text: 'Zeile eins\nZeile zwei',
        },
        { author: 'sam', at: '2026-06-17T10:05:00.000Z', text: 'Antwort' },
      ],
    });
  });

  it('reads a resolved and an empty comment, and ignores other comments', () => {
    expect(parseDocumentComment('co:h7k2 by:kyle status:resolved\n')).toEqual({
      id: 'h7k2',
      status: 'resolved',
      messages: [],
    });
    expect(parseDocumentComment('c:k3f9')).toBeNull();
    expect(parseDocumentComment(' just a note ')).toBeNull();
  });
});

describe('document comments', () => {
  it('highlights the passage and puts the thread next to the paragraph', async () => {
    const html = await render(THREAD);
    expect(html).toMatch(
      /^<div class="annotated"><p>Wir sollten <mark class="doc-comment">am Freitag veröffentlichen<\/mark> unabhängig von QA\.<\/p>/,
    );
    expect(html).toContain(
      '<aside class="margin-note margin-comment" role="note">',
    );
    expect(html).toContain(
      '<details open><summary>Kommentar von peter</summary>',
    );
    expect(html).toContain('<strong>peter</strong> · 17. Juni');
    expect(html).toContain('<strong>Donnerstag</strong>');
    expect(html).toContain(
      '<div class="mn-reply"><p class="mn-meta"><strong>sam</strong>',
    );
    expect(html).not.toContain('<!--');
  });

  it('uses the language of the page', async () => {
    const html = await render(THREAD, 'en');
    expect(html).toContain('Comment by peter');
    expect(html).toContain('17 Jun');
  });

  it('shows nothing of a resolved comment, but keeps its text', async () => {
    const html = await render(
      'Ein <!--c:ab12-->gelöster Satz<!--/c:ab12--> bleibt.\n<!--co:ab12 by:peter at:2026-06-17T10:00:00.000Z status:resolved\npeter (2026-06-17T10:00:00.000Z): erledigt\n-->\n',
    );
    expect(html).toBe('<p>Ein gelöster Satz bleibt.</p>\n');
  });

  it('removes the zero width space at the start of a paragraph', async () => {
    const html = await render(
      '​<!--c:zz99-->Anfang<!--/c:zz99--> des Absatzes.\n<!--co:zz99 by:p at:2026-06-17T10:00:00.000Z status:open\np (2026-06-17T10:00:00.000Z): Hinweis\n-->\n',
    );
    expect(html).toContain(
      '<p><mark class="doc-comment">Anfang</mark> des Absatzes.</p>',
    );
    expect(html).not.toContain('​');
  });

  it('keeps several notes of a paragraph in the order of the text, in one wrapper', async () => {
    const html = await render(
      [
        'Erst <!--c:a1-->eins<!--/c:a1--> dann<sup></sup> <!--c:b2-->zwei<!--/c:b2-->.',
        '<!--co:a1 by:p at:2026-06-17T10:00:00.000Z status:open',
        'p (2026-06-17T10:00:00.000Z): Erster',
        '-->',
        '<!--co:b2 by:p at:2026-06-17T10:00:00.000Z status:open',
        'p (2026-06-17T10:00:00.000Z): Zweiter',
        '-->',
        '',
      ].join('\n'),
    );
    expect(html.match(/class="annotated"/g)).toHaveLength(1);
    expect(html.indexOf('Erster')).toBeLessThan(html.indexOf('Zweiter'));
  });

  it('writes the text of a comment through the sanitizer: no HTML, no script links', async () => {
    const html = await render(
      'Satz <!--c:q1-->hier<!--/c:q1-->.\n<!--co:q1 by:p at:2026-06-17T10:00:00.000Z status:open\np (2026-06-17T10:00:00.000Z): Siehe <script>alert(1)</script> <img src=x onerror=alert(2)> [böse](javascript:alert(3)) [gut](https://example.org/x)\n-->\n',
    );
    expect(html).not.toMatch(/<script|<img|onerror|javascript:/);
    expect(html).toContain('<a href="https://example.org/x">gut</a>');
  });

  it('drops a marker without its end and a comment without a thread block', async () => {
    const html = await render(
      'Ein <!--c:x1-->offener Marker bleibt Text.\n\n<!--co:y2 by:p status:open\np (2026-06-17T10:00:00.000Z): ohne Markierung\n-->\n',
    );
    expect(html).toContain('Ein offener Marker bleibt Text.');
    expect(html).not.toContain('mark');
    expect(html).not.toContain('<!--');
  });

  it('puts the note next to the list for a comment in a list item', async () => {
    const html = await render(
      '- Eins <!--c:l1-->mit Hinweis<!--/c:l1-->\n- Zwei\n\n<!--co:l1 by:p at:2026-06-17T10:00:00.000Z status:open\np (2026-06-17T10:00:00.000Z): Zur Liste\n-->\n',
    );
    expect(html).toMatch(/<div class="annotated"><ul>/);
    expect(html).toContain('<mark class="doc-comment">mit Hinweis</mark>');
    expect(html).toContain('Zur Liste');
  });

  it('removes every other HTML comment from the page', async () => {
    const html = await render(
      'Text <!-- geheim --> und mehr.\n\n<!-- noch ein Kommentar -->\n\nEnde.\n',
    );
    expect(html).not.toContain('<!--');
    expect(html).not.toContain('geheim');
    expect(html).not.toContain('Kommentar');
  });
});

describe('footnotes in the margin', () => {
  it('shows the footnote next to its paragraph and keeps the list at the end', async () => {
    const html = await render(
      'Eine Behauptung.[^1] Danach mehr.\n\n[^1]: Die Quelle dazu.\n',
    );
    expect(html).toContain(
      '<aside class="margin-note margin-footnote" role="note">',
    );
    expect(html).toContain(
      '<summary>Fußnote 1</summary><p><strong class="mn-number">1</strong> Die Quelle dazu.</p>',
    );
    // The list at the end stays, with its way back.
    expect(html).toContain('<section data-footnotes');
    expect(html).toContain('data-footnote-backref');
    // The note itself has no way back.
    const note = html.slice(html.indexOf('<aside'), html.indexOf('</aside>'));
    expect(note).not.toContain('backref');
  });

  it('links the reference and the list at the end to each other (the ids carry the prefix once)', async () => {
    const html = await render('Text.[^1]\n\n[^1]: Quelle.\n');
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(targets).toHaveLength(2);
    for (const target of targets) expect(ids).toContain(target);
    expect(html).not.toContain('user-content-user-content');
  });

  it('leaves a footnote that is more than paragraphs to the list at the end', async () => {
    const html = await render(
      'Text.[^1]\n\n[^1]: Erster Absatz.\n\n    - eine Liste\n',
    );
    expect(html).not.toContain('margin-footnote');
    expect(html).toContain('data-footnotes');
  });

  it('adds nothing to a page without comments and footnotes', async () => {
    const html = await render('Nur ein Absatz.\n');
    expect(html).toBe('<p>Nur ein Absatz.</p>');
  });
});
