import { describe, expect, it } from 'vitest';
import { renderMarkdown, type ImageResolveResult } from './render.ts';

const bild: ImageResolveResult = {
  ok: true,
  image: {
    src: '/media/abc-960.webp',
    srcset: '/media/abc-480.webp 480w, /media/abc-960.webp 960w',
    width: 960,
    height: 540,
  },
};

function optionen(
  pfad = 'a.md',
  called: string[] = [],
  response: (p: string) => ImageResolveResult = () => bild,
) {
  return {
    articlePath: pfad,
    resolveImage: async (p: string) => {
      called.push(p);
      return response(p);
    },
  };
}

const render = (md: string, opt = optionen()) => renderMarkdown(md, opt);

describe('Markdown', () => {
  it('renders paragraphs, emphasis and lists', async () => {
    const { html } = await render(
      'Ein **fetter** und *kursiver* Text.\n\n- eins\n- zwei\n',
    );
    expect(html).toContain('<strong>fetter</strong>');
    expect(html).toContain('<em>kursiver</em>');
    expect(html).toContain('<li>zwei</li>');
  });

  it('renders GFM: tables, strikethrough and tasks', async () => {
    const md =
      '| a | b |\n|---|---|\n| 1 | 2 |\n\n~~weg~~\n\n- [x] fertig\n- [ ] offen\n';
    const { html } = await render(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<del>weg</del>');
    expect(html).toContain('type="checkbox"');
  });

  it('keeps code blocks with a language and colors them through classes', async () => {
    const { html } = await render('```ts\nconst x = 1;\n```\n');
    expect(html).toContain('<pre><code class="language-ts');
    expect(html).toContain('<span class="hljs-keyword">const</span>');
    expect(html).toContain('<span class="hljs-number">1</span>');
  });

  it('leaves code without a language or with an unknown one unchanged', async () => {
    const ohne = await render('```\nconst x = 1;\n```\n');
    expect(ohne.html).toContain('<pre><code>const x = 1;\n</code></pre>');
    const fremd = await render('```gibtsnicht\nconst x = 1;\n```\n');
    expect(fremd.html).not.toContain('hljs-');
    expect(fremd.html).toContain('const x = 1;');
  });

  it('escapes HTML in colored code and does not take over own classes', async () => {
    const md =
      '```html\n<script>alert(1)</script>\n```\n\n<span class="hljs-keyword" style="color:red" onclick="x()">raw</span>\n';
    const { html } = await render(md);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&#x3C;');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('style=');
    // The raw class from the text does not stay, only the one from the coloring.
    expect(html).not.toContain('<span class="hljs-keyword">raw</span>');
  });

  it('also colors in the strict memos mode', async () => {
    const { html } = await renderMarkdown('```js\nlet a;\n```', {
      ...optionen(),
      remoteContent: 'none',
    });
    expect(html).toContain('hljs-keyword');
  });

  it('moves headings down one level because the page carries the h1', async () => {
    const { html } = await render('# Eins\n\n## Zwei\n\n###### Sechs\n');
    expect(html).toContain('<h2>Eins</h2>');
    expect(html).toContain('<h3>Zwei</h3>');
    expect(html).toContain('<h6>Sechs</h6>');
    expect(html).not.toContain('<h1');
  });
});

describe('Sanitizing', () => {
  it('removes scripts', async () => {
    const { html } = await render(
      'Text\n\n<script>window.pwned = 1</script>\n',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('pwned');
  });

  it('removes event attributes', async () => {
    const { html } = await render(
      '<img src="x" onerror="alert(1)">\n\n<p onclick="alert(1)">Hallo</p>\n',
    );
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('onclick');
    expect(html).toContain('Hallo');
  });

  it('removes dangerous links', async () => {
    const { html } = await render(
      '[a](javascript:alert(1)) und [b](data:text/html;base64,AAAA) und [c](vbscript:x)\n',
    );
    expect(html).not.toMatch(/href="(javascript|data|vbscript):/i);
  });

  it('removes forms, styles, SVG, objects and other kinds of embeds', async () => {
    const md = [
      '<form action="https://evil.example"><input name="x"></form>',
      '<style>body{display:none}</style>',
      '<svg onload="alert(1)"><circle r="1"/></svg>',
      '<object data="https://evil.example/x"></object>',
      '<embed src="https://evil.example/x">',
      '<base href="https://evil.example/">',
      '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    ].join('\n\n');
    const { html } = await render(md);
    for (const tag of [
      '<form',
      '<style',
      '<svg',
      '<object',
      '<embed',
      '<base',
      '<meta',
    ]) {
      expect(html).not.toContain(tag);
    }
  });

  it('keeps harmless HTML', async () => {
    const { html } = await render(
      'Text mit <b>fett</b> und <kbd>Strg</kbd>.\n',
    );
    expect(html).toContain('<b>fett</b>');
    expect(html).toContain('<kbd>Strg</kbd>');
  });

  it('removes HTML comments', async () => {
    const { html } = await render('Text <!-- geheim --> Ende\n');
    expect(html).not.toContain('geheim');
  });

  it('gives external links noopener and noreferrer', async () => {
    const { html } = await render('[Seite](https://example.org/a)\n');
    expect(html).toContain('href="https://example.org/a"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('leaves internal links without rel', async () => {
    const { html } = await render('[Start](/)\n');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('rel=');
  });
});

describe('Remote images', () => {
  it('keeps images from allowed hosts and loads them lazily without referrer', async () => {
    const { html, warnings } = await render(
      '![Alt](https://upload.wikimedia.org/a/b.jpg)\n',
    );
    expect(html).toContain('src="https://upload.wikimedia.org/a/b.jpg"');
    expect(html).toContain('alt="Alt"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(warnings).toEqual([]);
  });

  it('removes images from other hosts with a warning and keeps the alt text', async () => {
    const { html, warnings } = await render(
      '![Tracker](https://tracker.example/pixel.png)\n',
    );
    expect(html).not.toContain('tracker.example');
    expect(html).not.toContain('<img');
    expect(html).toContain('Tracker');
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('tracker.example');
  });

  it('removes images with a data address and plain http', async () => {
    const { html, warnings } = await render(
      '![a](data:image/png;base64,AAAA)\n\n![b](http://upload.wikimedia.org/x.png)\n',
    );
    expect(html).not.toContain('<img');
    expect(warnings.length).toBe(2);
  });
});

describe('Embeds', () => {
  const yt = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';

  it('replaces an allowed iframe with a placeholder without a foreign request', async () => {
    const { html, warnings } = await render(
      `<iframe src="${yt}" width="560" height="315" allow="autoplay"></iframe>\n`,
    );
    expect(html).not.toContain('<iframe');
    expect(html).toContain(`data-embed-src="${yt}"`);
    expect(html).toContain('class="embed-start"');
    expect(html).toContain('YouTube');
    expect(html).toContain(
      'href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"',
    );
    expect(warnings).toEqual([]);
  });

  it('writes the texts of the placeholder in English and, on request, in German', async () => {
    const md = `<iframe src="${yt}"></iframe>\n`;
    const en = (await render(md)).html;
    expect(en).toContain(
      'This content is loaded from YouTube once you start it.',
    );
    expect(en).toContain('Load content');
    expect(en).toContain('Open on YouTube');
    const de = (await renderMarkdown(md, { ...optionen(), lang: 'de' })).html;
    expect(de).toContain(
      'Dieser Inhalt wird von YouTube geladen, sobald du ihn startest.',
    );
    expect(de).toContain('Inhalt laden');
    expect(de).toContain('Auf YouTube öffnen');
  });

  it('removes iframes from other hosts with a warning', async () => {
    const { html, warnings } = await render(
      '<iframe src="https://evil.example/x"></iframe>\n',
    );
    expect(html).not.toContain('evil.example');
    expect(html).not.toContain('data-embed-src');
    expect(warnings.length).toBe(1);
  });

  it('removes iframes without src and look-alike hosts', async () => {
    const md =
      '<iframe></iframe>\n\n<iframe src="https://www.youtube-nocookie.com.evil.example/embed/dQw4w9WgXcQ"></iframe>\n';
    const { html, warnings } = await render(md);
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('data-embed-src');
    expect(warnings.length).toBe(2);
  });

  it('does not take over attributes of the author into the placeholder', async () => {
    const { html } = await render(
      `<iframe src="${yt}" onload="alert(1)" style="x" sandbox="" srcdoc="<script>1</script>"></iframe>\n`,
    );
    expect(html).not.toContain('onload');
    expect(html).not.toContain('srcdoc');
    expect(html).not.toContain('sandbox');
  });
});

describe('Missing images in German', () => {
  it('uses the German marker for lang de', async () => {
    const response = (): ImageResolveResult => ({
      ok: false,
      code: 'not-found',
      reason: 'not found',
    });
    const { html } = await renderMarkdown('![Fehlt](weg.png)\n', {
      ...optionen('a.md', [], response),
      lang: 'de',
    });
    expect(html).toContain('[Bild fehlt: Fehlt]');
  });
});

describe('Local images', () => {
  it('resolves paths relative to the article and writes srcset and dimensions', async () => {
    const called: string[] = [];
    const { html, warnings } = await render(
      '![Foto](bilder/foto.png)\n',
      optionen('ordner/artikel.md', called),
    );
    expect(called).toEqual(['ordner/bilder/foto.png']);
    expect(html).toContain('src="/media/abc-960.webp"');
    expect(html).toContain(
      'srcset="/media/abc-480.webp 480w, /media/abc-960.webp 960w"',
    );
    expect(html).toContain('width="960"');
    expect(html).toContain('height="540"');
    expect(html).toContain('alt="Foto"');
    expect(html).toContain('loading="lazy"');
    expect(warnings).toEqual([]);
  });

  it('writes an image without variants (SVG) without srcset and sizes', async () => {
    const { html } = await render(
      '![Logo](logo.svg)\n',
      optionen('a.md', [], () => ({
        ok: true,
        image: { src: '/media/abc.svg', srcset: '', width: 40, height: 20 },
      })),
    );
    expect(html).toContain('src="/media/abc.svg"');
    expect(html).toContain('width="40"');
    expect(html).not.toContain('srcset');
    expect(html).not.toContain('sizes');
  });

  it('understands ./, ../ and encoded spaces', async () => {
    const called: string[] = [];
    await render(
      '![a](./bild%20eins.png)\n\n![b](../anhang/bild.png)\n',
      optionen('x/y/artikel.md', called),
    );
    expect(called).toEqual(['x/y/bild eins.png', 'x/anhang/bild.png']);
  });

  it('tries the path from the folder root if the path is not found (Obsidian)', async () => {
    const called: string[] = [];
    const response = (p: string): ImageResolveResult =>
      p === 'bilder/foto.png'
        ? bild
        : { ok: false, code: 'not-found', reason: 'not found' };
    const { html, warnings } = await render(
      '![Foto](bilder/foto.png)\n',
      optionen('ordner/artikel.md', called, response),
    );
    expect(called).toEqual(['ordner/bilder/foto.png', 'bilder/foto.png']);
    expect(html).toContain('src="/media/abc-960.webp"');
    expect(warnings).toEqual([]);
  });

  it('rejects paths out of the folder without calling the resolver', async () => {
    const called: string[] = [];
    const { html, warnings } = await render(
      '![a](../../../etc/passwd)\n\n![b](/etc/passwd)\n\n![c](..%2F..%2Fgeheim.png)\n\n![d](.obsidian/x.png)\n',
      optionen('artikel.md', called),
    );
    expect(called).toEqual([]);
    expect(html).not.toContain('<img');
    expect(warnings.length).toBe(4);
  });

  it('warns about a missing image but does not abort and shows the alt text', async () => {
    const response = (): ImageResolveResult => ({
      ok: false,
      code: 'not-found',
      reason: 'not found',
    });
    const { html, warnings } = await render(
      'Vorher ![Fehlt](weg.png) nachher\n',
      optionen('a.md', [], response),
    );
    expect(html).toContain('Vorher');
    expect(html).toContain('nachher');
    expect(html).toContain('class="image-missing"');
    expect(html).toContain('[Image missing: Fehlt]');
    expect(html).not.toContain('<img');
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('weg.png');
  });

  it('reports unsupported image types', async () => {
    const response = (): ImageResolveResult => ({
      ok: false,
      code: 'unsupported',
      reason: 'SVG is not supported',
    });
    const { html, warnings } = await render(
      '![Logo](logo.svg)\n',
      optionen('a.md', [], response),
    );
    expect(html).not.toContain('<img');
    expect(warnings[0]).toContain('SVG');
  });
});

describe('Strict mode (remoteContent: none), for example for memos', () => {
  const streng = { ...optionen(), remoteContent: 'none' as const };

  it('also removes images from allowed hosts', async () => {
    const { html, warnings } = await renderMarkdown(
      '![Alt](https://upload.wikimedia.org/a/b.jpg)\n',
      streng,
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('wikimedia');
    expect(html).toContain('Alt');
    expect(warnings.length).toBe(1);
  });

  it('also removes allowed embeds', async () => {
    const { html, warnings } = await renderMarkdown(
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>\n',
      streng,
    );
    expect(html).not.toContain('data-embed-src');
    expect(html).not.toContain('<iframe');
    expect(warnings.length).toBe(1);
  });

  it('keeps local calls through the resolver if it delivers them', async () => {
    const { html } = await renderMarkdown('![Foto](bild.png)\n', streng);
    expect(html).toContain('src="/media/abc-960.webp"');
  });
});

describe('Links to other files of the folder (W20)', () => {
  const pages: Record<string, string> = {
    'glossar/cache.md': '/g/cache/',
    'hallo welt.md': '/p/hallo-welt/',
    'ordner/größe.md': '/p/groesse/',
  };
  const withLinks = (articlePath = 'beitrag.md') => ({
    ...optionen(articlePath),
    resolveLink: (p: string) => pages[p],
  });

  it('turns a relative path to a published file into the address of its page', async () => {
    const { html, warnings } = await render(
      '[Cache](glossar/cache.md) und [Hallo](hallo%20welt.md#teil)',
      withLinks(),
    );
    expect(html).toContain('<a href="/g/cache/">Cache</a>');
    expect(html).toContain('<a href="/p/hallo-welt/#teil">Hallo</a>');
    expect(warnings).toEqual([]);
  });

  it('resolves paths relative to the article, and decomposed umlauts', async () => {
    const { html } = await render(
      '[Größe](../ordner/größe.md)',
      withLinks('glossar/x.md'),
    );
    expect(html).toContain('<a href="/p/groesse/">Größe</a>');
  });

  it('makes a link to an unknown or unpublished file plain text, with a warning', async () => {
    const { html, warnings } = await render(
      'Siehe [Entwurf](entwurf.md) bitte.',
      withLinks(),
    );
    expect(html).toContain('Siehe Entwurf bitte.');
    expect(html).not.toContain('entwurf.md');
    expect(warnings.join()).toMatch(/entwurf\.md/);
  });

  it('leaves external links, anchors and other files alone', async () => {
    const { html } = await render(
      '[a](https://example.org/x.md) [b](#oben) [c](datei.pdf)',
      withLinks(),
    );
    expect(html).toContain('href="https://example.org/x.md"');
    expect(html).toContain('href="#oben"');
    expect(html).toContain('href="datei.pdf"');
  });

  it('does nothing without a resolver (memos)', async () => {
    const { html } = await render('[a](b.md)');
    expect(html).toContain('href="b.md"');
  });
});
