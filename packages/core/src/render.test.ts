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
  aufgerufen: string[] = [],
  antwort: (p: string) => ImageResolveResult = () => bild,
) {
  return {
    articlePath: pfad,
    resolveImage: async (p: string) => {
      aufgerufen.push(p);
      return antwort(p);
    },
  };
}

const render = (md: string, opt = optionen()) => renderMarkdown(md, opt);

describe('Markdown', () => {
  it('rendert Absätze, Hervorhebungen und Listen', async () => {
    const { html } = await render(
      'Ein **fetter** und *kursiver* Text.\n\n- eins\n- zwei\n',
    );
    expect(html).toContain('<strong>fetter</strong>');
    expect(html).toContain('<em>kursiver</em>');
    expect(html).toContain('<li>zwei</li>');
  });

  it('rendert GFM: Tabellen, Durchgestrichenes und Aufgaben', async () => {
    const md =
      '| a | b |\n|---|---|\n| 1 | 2 |\n\n~~weg~~\n\n- [x] fertig\n- [ ] offen\n';
    const { html } = await render(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<del>weg</del>');
    expect(html).toContain('type="checkbox"');
  });

  it('behält Code-Blöcke mit Sprachangabe', async () => {
    const { html } = await render('```ts\nconst x = 1;\n```\n');
    expect(html).toContain('<pre><code class="language-ts">');
  });

  it('schiebt Überschriften eine Ebene nach unten, weil die Seite das h1 trägt', async () => {
    const { html } = await render('# Eins\n\n## Zwei\n\n###### Sechs\n');
    expect(html).toContain('<h2>Eins</h2>');
    expect(html).toContain('<h3>Zwei</h3>');
    expect(html).toContain('<h6>Sechs</h6>');
    expect(html).not.toContain('<h1');
  });
});

describe('Bereinigung', () => {
  it('entfernt Skripte', async () => {
    const { html } = await render(
      'Text\n\n<script>window.pwned = 1</script>\n',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('pwned');
  });

  it('entfernt Ereignis-Attribute', async () => {
    const { html } = await render(
      '<img src="x" onerror="alert(1)">\n\n<p onclick="alert(1)">Hallo</p>\n',
    );
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('onclick');
    expect(html).toContain('Hallo');
  });

  it('entfernt gefährliche Verweise', async () => {
    const { html } = await render(
      '[a](javascript:alert(1)) und [b](data:text/html;base64,AAAA) und [c](vbscript:x)\n',
    );
    expect(html).not.toMatch(/href="(javascript|data|vbscript):/i);
  });

  it('entfernt Formulare, Stile, SVG, Objekte und Einbettungen anderer Art', async () => {
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

  it('lässt harmloses HTML stehen', async () => {
    const { html } = await render(
      'Text mit <b>fett</b> und <kbd>Strg</kbd>.\n',
    );
    expect(html).toContain('<b>fett</b>');
    expect(html).toContain('<kbd>Strg</kbd>');
  });

  it('entfernt HTML-Kommentare', async () => {
    const { html } = await render('Text <!-- geheim --> Ende\n');
    expect(html).not.toContain('geheim');
  });

  it('versieht externe Links mit noopener und noreferrer', async () => {
    const { html } = await render('[Seite](https://example.org/a)\n');
    expect(html).toContain('href="https://example.org/a"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('lässt interne Links ohne rel', async () => {
    const { html } = await render('[Start](/)\n');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('rel=');
  });
});

describe('Remote-Bilder', () => {
  it('behält Bilder freigegebener Hosts und lädt sie verzögert ohne Referrer', async () => {
    const { html, warnings } = await render(
      '![Alt](https://upload.wikimedia.org/a/b.jpg)\n',
    );
    expect(html).toContain('src="https://upload.wikimedia.org/a/b.jpg"');
    expect(html).toContain('alt="Alt"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(warnings).toEqual([]);
  });

  it('entfernt Bilder anderer Hosts mit Warnung und behält den Alt-Text', async () => {
    const { html, warnings } = await render(
      '![Tracker](https://tracker.example/pixel.png)\n',
    );
    expect(html).not.toContain('tracker.example');
    expect(html).not.toContain('<img');
    expect(html).toContain('Tracker');
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('tracker.example');
  });

  it('entfernt Bilder mit data-Adresse und unverschlüsseltes http', async () => {
    const { html, warnings } = await render(
      '![a](data:image/png;base64,AAAA)\n\n![b](http://upload.wikimedia.org/x.png)\n',
    );
    expect(html).not.toContain('<img');
    expect(warnings.length).toBe(2);
  });
});

describe('Einbettungen', () => {
  const yt = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';

  it('ersetzt ein erlaubtes iframe durch einen Platzhalter ohne Fremdaufruf', async () => {
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

  it('entfernt iframes anderer Hosts mit Warnung', async () => {
    const { html, warnings } = await render(
      '<iframe src="https://evil.example/x"></iframe>\n',
    );
    expect(html).not.toContain('evil.example');
    expect(html).not.toContain('data-embed-src');
    expect(warnings.length).toBe(1);
  });

  it('entfernt iframes ohne src und ähnlich aussehende Hosts', async () => {
    const md =
      '<iframe></iframe>\n\n<iframe src="https://www.youtube-nocookie.com.evil.example/embed/dQw4w9WgXcQ"></iframe>\n';
    const { html, warnings } = await render(md);
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('data-embed-src');
    expect(warnings.length).toBe(2);
  });

  it('übernimmt keine Attribute des Autors in den Platzhalter', async () => {
    const { html } = await render(
      `<iframe src="${yt}" onload="alert(1)" style="x" sandbox="" srcdoc="<script>1</script>"></iframe>\n`,
    );
    expect(html).not.toContain('onload');
    expect(html).not.toContain('srcdoc');
    expect(html).not.toContain('sandbox');
  });
});

describe('Lokale Bilder', () => {
  it('löst relative Pfade zum Artikel auf und schreibt srcset und Maße', async () => {
    const aufgerufen: string[] = [];
    const { html, warnings } = await render(
      '![Foto](bilder/foto.png)\n',
      optionen('ordner/artikel.md', aufgerufen),
    );
    expect(aufgerufen).toEqual(['ordner/bilder/foto.png']);
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

  it('versteht ./, ../ und kodierte Leerzeichen', async () => {
    const aufgerufen: string[] = [];
    await render(
      '![a](./bild%20eins.png)\n\n![b](../anhang/bild.png)\n',
      optionen('x/y/artikel.md', aufgerufen),
    );
    expect(aufgerufen).toEqual(['x/y/bild eins.png', 'x/anhang/bild.png']);
  });

  it('probiert bei nicht gefundenem Pfad den Pfad ab Ordnerwurzel (Obsidian)', async () => {
    const aufgerufen: string[] = [];
    const antwort = (p: string): ImageResolveResult =>
      p === 'bilder/foto.png'
        ? bild
        : { ok: false, code: 'not-found', reason: 'nicht gefunden' };
    const { html, warnings } = await render(
      '![Foto](bilder/foto.png)\n',
      optionen('ordner/artikel.md', aufgerufen, antwort),
    );
    expect(aufgerufen).toEqual(['ordner/bilder/foto.png', 'bilder/foto.png']);
    expect(html).toContain('src="/media/abc-960.webp"');
    expect(warnings).toEqual([]);
  });

  it('weist Pfade aus dem Ordner heraus ab, ohne den Auflöser aufzurufen', async () => {
    const aufgerufen: string[] = [];
    const { html, warnings } = await render(
      '![a](../../../etc/passwd)\n\n![b](/etc/passwd)\n\n![c](..%2F..%2Fgeheim.png)\n\n![d](.obsidian/x.png)\n',
      optionen('artikel.md', aufgerufen),
    );
    expect(aufgerufen).toEqual([]);
    expect(html).not.toContain('<img');
    expect(warnings.length).toBe(4);
  });

  it('warnt bei fehlendem Bild, bricht aber nicht ab und zeigt den Alt-Text', async () => {
    const antwort = (): ImageResolveResult => ({
      ok: false,
      code: 'not-found',
      reason: 'nicht gefunden',
    });
    const { html, warnings } = await render(
      'Vorher ![Fehlt](weg.png) nachher\n',
      optionen('a.md', [], antwort),
    );
    expect(html).toContain('Vorher');
    expect(html).toContain('nachher');
    expect(html).toContain('class="bild-fehlt"');
    expect(html).toContain('Fehlt');
    expect(html).not.toContain('<img');
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('weg.png');
  });

  it('meldet nicht unterstützte Bildtypen', async () => {
    const antwort = (): ImageResolveResult => ({
      ok: false,
      code: 'unsupported',
      reason: 'SVG wird nicht unterstützt',
    });
    const { html, warnings } = await render(
      '![Logo](logo.svg)\n',
      optionen('a.md', [], antwort),
    );
    expect(html).not.toContain('<img');
    expect(warnings[0]).toContain('SVG');
  });
});

describe('Strenger Modus (remoteContent: none), zum Beispiel für Memos', () => {
  const streng = { ...optionen(), remoteContent: 'none' as const };

  it('entfernt auch Bilder freigegebener Hosts', async () => {
    const { html, warnings } = await renderMarkdown(
      '![Alt](https://upload.wikimedia.org/a/b.jpg)\n',
      streng,
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('wikimedia');
    expect(html).toContain('Alt');
    expect(warnings.length).toBe(1);
  });

  it('entfernt auch erlaubte Einbettungen', async () => {
    const { html, warnings } = await renderMarkdown(
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>\n',
      streng,
    );
    expect(html).not.toContain('data-embed-src');
    expect(html).not.toContain('<iframe');
    expect(warnings.length).toBe(1);
  });

  it('behält lokale Aufrufe über den Auflöser bei, wenn er sie liefert', async () => {
    const { html } = await renderMarkdown('![Foto](bild.png)\n', streng);
    expect(html).toContain('src="/media/abc-960.webp"');
  });
});
