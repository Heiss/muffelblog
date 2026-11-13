import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './svg.ts';
import type { SvgResult } from './svg.ts';

function clean(source: string): SvgResult {
  const result = sanitizeSvg(source);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

const SVG_XMLNS = 'xmlns="http://www.w3.org/2000/svg"';
const wrap = (inner: string, attrs = 'viewBox="0 0 100 50"') =>
  `<?xml version="1.0"?><!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

describe('sanitizeSvg: what stays', () => {
  it('keeps shapes, groups, gradients and writes the namespace itself', () => {
    const r = clean(
      wrap(
        '<defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs>' +
          '<g><rect x="1" y="2" width="3" height="4" fill="url(#g)"/><path d="M0 0L10 10"/></g>',
      ),
    );
    expect(r.svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(r.svg).toContain(
      '<rect x="1" y="2" width="3" height="4" fill="url(#g)"/>',
    );
    expect(r.svg).toContain('<linearGradient id="g">');
    expect(r.svg).not.toContain('<?xml');
    expect(r.removed).toEqual([]);
  });

  it('keeps SMIL animations and CSS animations', () => {
    const r = clean(
      wrap(
        '<style>@keyframes spin { to { transform: rotate(360deg) } } .a { animation: spin 2s infinite }</style>' +
          '<circle r="5"><animate attributeName="r" values="5;10;5" dur="1s" repeatCount="indefinite"/></circle>' +
          '<rect><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s"/></rect>' +
          '<rect><set attributeName="fill" to="red" begin="1s"/></rect>',
      ),
    );
    expect(r.svg).toContain('@keyframes spin');
    expect(r.svg).toContain('<animate attributeName="r"');
    expect(r.svg).toContain('<animateTransform attributeName="transform"');
    expect(r.svg).toContain('<set attributeName="fill"');
    expect(r.removed).toEqual([]);
  });

  it('keeps references inside the file: use, mpath and gradients by #id', () => {
    const r = clean(
      wrap(
        '<defs><path id="p" d="M0 0L9 9"/></defs><use href="#p"/><use xlink:href="#p" xmlns:xlink="http://www.w3.org/1999/xlink"/>',
      ),
    );
    expect(r.svg).toContain('<use href="#p"/>');
    expect(r.svg).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(r.svg).toContain('<use xlink:href="#p"/>');
  });

  it('keeps text, escaped as XML, and unwraps links', () => {
    const r = clean(
      wrap('<a href="https://evil.example/"><text>1 &lt; 2 &amp; 3</text></a>'),
    );
    expect(r.svg).toContain('<text>1 &lt; 2 &amp; 3</text>');
    expect(r.svg).not.toContain('<a');
    expect(r.svg).not.toContain('evil.example');
  });
});

describe('sanitizeSvg: what goes', () => {
  it('removes scripts, foreignObject, images and HTML elements', () => {
    const r = clean(
      wrap(
        '<script>alert(1)</script><foreignObject><div>x</div><iframe src="//e"></iframe></foreignObject>' +
          '<image href="https://e/x.png"/><rect/>' +
          '<svg><iframe src="//e"/></svg>',
      ),
    );
    expect(r.svg).not.toMatch(/script|foreignObject|<image|iframe|alert|<div/i);
    expect(r.svg).toContain('<rect/>');
    expect(r.removed).toEqual(
      expect.arrayContaining([
        'element script',
        'element foreignObject',
        'element image',
      ]),
    );
  });

  it('removes event handlers in every spelling', () => {
    const r = clean(
      wrap('<rect onload="x()" onclick="x()" ONMOUSEOVER="x()" width="1"/>'),
    );
    expect(r.svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="1"/></svg>\n',
    );
  });

  it('removes links that leave the file or run code', () => {
    const r = clean(
      wrap(
        '<use href="https://e/x.svg#a"/><use href="data:image/svg+xml,x"/><use href="javascript:alert(1)"/>' +
          '<use href="  #ok "/><rect fill="url(https://e/x)"/><rect style="fill:url(//e/x)"/>',
      ),
    );
    expect(r.svg.replace(SVG_XMLNS, '')).not.toMatch(
      /https?:|data:|javascript:|\/\/e/,
    );
    expect(r.svg).toContain('<use href="#ok"/>');
  });

  it('removes href on elements that may not link at all', () => {
    const r = clean(
      wrap(
        '<rect href="#a"/><path xlink:href="#a" xmlns:xlink="http://www.w3.org/1999/xlink"/>',
      ),
    );
    expect(r.svg).not.toContain('href');
    expect(r.svg).not.toContain('xmlns:xlink');
  });

  it('removes an animation that would set a link or a handler', () => {
    const r = clean(
      wrap(
        '<a><set attributeName="href" to="javascript:alert(1)"/></a>' +
          '<use href="#x"><set attributeName="xlink:href" to="//e"/></use>' +
          '<rect><animate attributeName="onclick" to="x()"/></rect><rect><animate attributeName="width" to="5"/></rect>',
      ),
    );
    expect(r.svg).not.toMatch(/javascript|\/\/e|onclick|set /);
    expect(r.svg).toContain('<animate attributeName="width" to="5"/>');
  });

  it('removes a style element or attribute that loads or runs something', () => {
    for (const css of [
      '@import url(https://e/x.css);',
      'rect { fill: url(https://e/x) }',
      'rect { background: url("//e/x") }',
      'rect { width: expression(alert(1)) }',
      'rect { -moz-binding: url(x) }',
      'r\\65 ct { fill: red }',
      'rect { fill: url(data:image/svg+xml,x) }',
    ]) {
      const r = clean(
        wrap(`<style>${css}</style><rect style="${css.replace(/"/g, "'")}"/>`),
      );
      expect(r.svg, css).not.toContain('<style');
      expect(r.svg, css).not.toContain('style=');
      expect(r.removed, css).toContain('style element');
    }
  });

  it('drops comments, processing instructions, doctype and entities that could smuggle markup', () => {
    const r = clean(
      wrap(
        '<!-- x --><desc>a&#60;script&#62;</desc><rect title="&#60;script&#62;"/>',
      ),
    );
    expect(r.svg).not.toMatch(/<!--|<\?|<!DOCTYPE|<script/i);
  });

  it('never passes a namespace, a base or foreign prefixes of the file', () => {
    const r = clean(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:evil="http://e/" evil:x="1" xml:base="https://e/" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10"><rect/></svg>',
    );
    expect(r.svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect/></svg>\n',
    );
  });

  it('escapes quotes in attribute values so no attribute can be added', () => {
    const r = clean(wrap('<rect id=\'a" onclick="x()\'/>'));
    expect(r.svg).toContain('id="a&quot; onclick=&quot;x()"');
    expect(r.svg).not.toMatch(/\sonclick="/);
  });
});

describe('sanitizeSvg: input checks and size', () => {
  it('refuses what is not an SVG', () => {
    expect(sanitizeSvg('<html><body>x</body></html>')).toEqual({
      ok: false,
      reason: 'File is not an SVG image',
    });
    expect(sanitizeSvg('')).toMatchObject({ ok: false });
    expect(sanitizeSvg(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toMatchObject({
      ok: false,
    });
  });

  it('refuses a file nested too deeply', () => {
    const deep = '<g>'.repeat(100) + '</g>'.repeat(100);
    expect(sanitizeSvg(wrap(deep))).toMatchObject({
      ok: false,
      reason: expect.stringContaining('nested'),
    });
  });

  it('takes the display size from width and height, else from the viewBox, else 300 x 150', () => {
    expect(clean(wrap('', 'width="120px" height="60"')).width).toBe(120);
    expect(clean(wrap('', 'viewBox="0 0 200 100"'))).toMatchObject({
      width: 200,
      height: 100,
    });
    expect(clean(wrap('', 'width="100" viewBox="0 0 200 100"'))).toMatchObject({
      width: 100,
      height: 50,
    });
    expect(clean(wrap('', 'height="50" viewBox="0 0 200 100"'))).toMatchObject({
      width: 100,
      height: 50,
    });
    expect(clean(wrap('', 'width="50%"'))).toMatchObject({
      width: 300,
      height: 150,
    });
    expect(clean(wrap('', ''))).toMatchObject({ width: 300, height: 150 });
  });

  it('gives the same result for the same file', () => {
    const source = wrap('<rect width="1"/>');
    expect(clean(source).svg).toBe(clean(source).svg);
    expect(clean(Buffer.from(source) as unknown as string).svg).toBe(
      clean(source).svg,
    );
  });
});
