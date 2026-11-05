import { describe, expect, it } from 'vitest';
import {
  renderMarkdown,
  type ImageResolveResult,
  type RenderOptions,
} from './render.ts';

// Exact output and exact warnings of renderMarkdown, case by case.

const image: ImageResolveResult = {
  ok: true,
  image: { src: '/m/a.webp', srcset: '/m/a.webp 480w', width: 4, height: 3 },
};
const missing: ImageResolveResult = {
  ok: false,
  code: 'not-found',
  reason: 'not found',
};

function setup(
  extra: Partial<RenderOptions> = {},
  answer: (p: string) => ImageResolveResult = () => image,
) {
  const asked: string[] = [];
  const options: RenderOptions = {
    articlePath: 'dir/a.md',
    resolveImage: async (p) => {
      asked.push(p);
      return answer(p);
    },
    ...extra,
  };
  return {
    asked,
    render: (md: string) => renderMarkdown(md, options),
  };
}

const IMG =
  '<img src="/m/a.webp" srcset="/m/a.webp 480w" sizes="(min-width: 760px) 720px, 100vw" width="4" height="3" alt="x" loading="lazy" decoding="async">';

describe('local images', () => {
  it('writes the variants with sizes, width, height and lazy loading', async () => {
    const { render } = setup();
    expect((await render('![x](b.png)')).html).toBe(`<p>${IMG}</p>`);
  });

  it('tries the path next to the article, then from the folder root', async () => {
    const { render, asked } = setup({}, () => missing);
    const { html, warnings } = await render('![x](img/b.png)');
    expect(asked).toEqual(['dir/img/b.png', 'img/b.png']);
    expect(html).toBe(
      '<p><span class="image-missing">[Image missing: x]</span></p>',
    );
    expect(warnings).toEqual([
      'dir/a.md: image "img/b.png" is missing or unusable (not found)',
    ]);
  });

  it('stops at the first candidate that is found or unusable', async () => {
    const unusable: ImageResolveResult = {
      ok: false,
      code: 'unsupported',
      reason: 'svg',
    };
    const first = setup({}, () => unusable);
    const result = await first.render('![x](img/b.svg)');
    expect(first.asked).toEqual(['dir/img/b.svg']);
    expect(result.warnings).toEqual([
      'dir/a.md: image "img/b.svg" is missing or unusable (svg)',
    ]);
    const found = setup();
    await found.render('![x](img/b.png)');
    expect(found.asked).toEqual(['dir/img/b.png']);
  });

  it('tries only one path with ./ or ../, at the root or when both are equal', async () => {
    for (const [articlePath, src, expected] of [
      ['dir/a.md', './b.png', ['dir/b.png']],
      ['dir/sub/a.md', '../b.png', ['dir/b.png']],
      ['a.md', 'img/b.png', ['img/b.png']],
      ['dir/a.md', 'b.png', ['dir/b.png', 'b.png']],
    ] as const) {
      const { render, asked } = setup({ articlePath }, () => missing);
      await render(`![x](${src})`);
      expect(asked, `${articlePath} ${src}`).toEqual(expected);
    }
  });

  it('writes the missing note without alt text, also in German', async () => {
    const en = setup({}, () => missing);
    expect((await en.render('![](b.png)')).html).toBe(
      '<p><span class="image-missing">[Image missing]</span></p>',
    );
    const de = setup({ lang: 'de' }, () => missing);
    expect((await de.render('![](b.png)')).html).toBe(
      '<p><span class="image-missing">[Bild fehlt]</span></p>',
    );
    expect((await de.render('![y](b.png)')).html).toBe(
      '<p><span class="image-missing">[Bild fehlt: y]</span></p>',
    );
  });

  it('refuses paths outside, hidden, absolute, with parameters or broken', async () => {
    const { render, asked } = setup({ articlePath: 'a.md' });
    const cases: [string, string][] = [
      ['../b.png', 'is outside the content folder'],
      ['..', 'is outside the content folder'],
      ['.', 'is outside the content folder'],
      ['x/../..', 'is outside the content folder'],
      ['.hidden/b.png', 'is in a hidden path'],
      ['d/.b.png', 'is in a hidden path'],
      ['%2Fetc%2Fb.png', 'absolute paths are not allowed'],
      ['b.png%3Fx=1', 'parameters in the path are not allowed'],
      ['b.png%23top', 'parameters in the path are not allowed'],
      ['b%00.png', 'invalid path'],
      ['a%5Cb.png', 'invalid path'],
      ['b%E0%A4.png', 'invalid path encoding'],
    ];
    for (const [src, reason] of cases) {
      const { html, warnings } = await render(`![alt](${src})`);
      expect(warnings, src).toEqual([
        `a.md: image "${src}" is removed (${reason})`,
      ]);
      expect(html, src).toBe('<p>alt</p>');
    }
    const { html } = await render('![](../b.png)');
    expect(html).toBe('<p></p>');
    expect(asked).toEqual([]);
  });

  it('accepts names that only contain dots inside', async () => {
    const { render, asked } = setup({ articlePath: 'a.md' });
    await render('![x](a..b/c.d.png)');
    expect(asked).toEqual(['a..b/c.d.png']);
  });

  it('removes an image without address', async () => {
    const { render } = setup();
    const { html, warnings } = await render('<img alt="z">');
    expect(html).toBe('z');
    expect(warnings).toEqual([
      'dir/a.md: image without a valid address is removed',
    ]);
  });
});

describe('remote images', () => {
  it('keeps allowed hosts with no referrer, removes the rest with the host named', async () => {
    const { render } = setup();
    const ok = await render(
      '![w](https://upload.wikimedia.org/wikipedia/commons/a/ab/X.png)',
    );
    expect(ok.html).toBe(
      '<p><img src="https://upload.wikimedia.org/wikipedia/commons/a/ab/X.png" alt="w" loading="lazy" decoding="async" referrerpolicy="no-referrer"></p>',
    );
    const bad = await render('![w](https://evil.example/x.png)');
    expect(bad.html).toBe('<p>w</p>');
    expect(bad.warnings).toEqual([
      'dir/a.md: image from evil.example is not allowed and is removed',
    ]);
    const proto = await render('![w](//evil.example/x.png)');
    expect(proto.html).toBe('<p>w</p>');
  });

  it('removes even allowed hosts in the strict mode', async () => {
    const { render } = setup({ remoteContent: 'none' });
    const { html } = await render(
      '![w](https://upload.wikimedia.org/wikipedia/commons/a/ab/X.png)',
    );
    expect(html).toBe('<p>w</p>');
  });
});

describe('embeds', () => {
  const youtube =
    '<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe>';

  it('becomes a placeholder with notice, button and link', async () => {
    const { render } = setup();
    const { html, warnings } = await render(youtube);
    expect(warnings).toEqual([]);
    expect(html).toMatch(
      /^<div class="embed" data-embed-src="[^"]+" data-embed-label="YouTube"><p>[^<]+<\/p><button type="button" class="embed-start">[^<]+<\/button><p><a href="[^"]+" rel="noopener noreferrer">[^<]+<\/a><\/p><\/div>$/,
    );
  });

  it('removes embeds of other hosts, without address or in strict mode', async () => {
    const { render } = setup();
    const other = await render(
      '<iframe src="https://evil.example/x"></iframe>',
    );
    expect(other.html).toBe('');
    expect(other.warnings).toEqual([
      'dir/a.md: embed evil.example is not allowed and is removed',
    ]);
    const empty = await render('<iframe></iframe>');
    expect(empty.warnings).toEqual([
      'dir/a.md: embed without an address is not allowed and is removed',
    ]);
    const strict = setup({ remoteContent: 'none' });
    expect((await strict.render(youtube)).html).toBe('');
  });
});

describe('links, headings, inputs and code', () => {
  it('marks only http(s) links as external', async () => {
    const { render } = setup();
    expect((await render('[a](https://x.example/)')).html).toBe(
      '<p><a href="https://x.example/" rel="noopener noreferrer">a</a></p>',
    );
    expect((await render('[a](mailto:a@x.example)')).html).toBe(
      '<p><a href="mailto:a@x.example">a</a></p>',
    );
    expect((await render('[a](/x/https://y)')).html).toBe(
      '<p><a href="/x/https://y">a</a></p>',
    );
  });

  it('moves every heading one level down, h6 stays h6', async () => {
    const { render } = setup();
    expect((await render('# a\n\n## b\n\n###### f\n\n<h6>g</h6>')).html).toBe(
      '<h2>a</h2>\n<h3>b</h3>\n<h6>f</h6>\n<h6>g</h6>',
    );
  });

  it('keeps checkboxes of task lists and removes other inputs', async () => {
    const { render } = setup();
    expect((await render('- [x] done\n- [ ] open')).html).toBe(
      '<ul class="contains-task-list">\n<li class="task-list-item"><input type="checkbox" checked disabled> done</li>\n<li class="task-list-item"><input type="checkbox" disabled> open</li>\n</ul>',
    );
    expect((await render('- [x] a\n\n- [ ] b')).html).toContain(
      '<li class="task-list-item">\n<p><input type="checkbox" checked disabled> a</p>',
    );
    expect((await render('<input type="text" value="a">b')).html).toBe(
      '<p>b</p>',
    );
    expect((await render('<input type="checkbox">b')).html).toBe('<p>b</p>');
    expect((await render('- <input type="checkbox"> a')).html).toBe(
      '<ul>\n<li> a</li>\n</ul>',
    );
    expect(
      (await render('<ul><li class="task-list-item">x <input></li></ul>')).html,
    ).toBe('<ul><li class="task-list-item">x </li></ul>');
    expect(
      (await render('<ul><li class="task-list-item"><b>x</b></li></ul>')).html,
    ).toBe('<ul><li class="task-list-item"><b>x</b></li></ul>');
  });

  it('colors code of a known language only, inside pre', async () => {
    const { render } = setup();
    expect((await render('```js\nlet a\n```')).html).toBe(
      '<pre><code class="language-js hljs"><span class="hljs-keyword">let</span> a\n</code></pre>',
    );
    expect((await render('```nolang\nlet a\n```')).html).toBe(
      '<pre><code class="language-nolang">let a\n</code></pre>',
    );
    expect((await render('```\nlet a\n```')).html).toBe(
      '<pre><code>let a\n</code></pre>',
    );
    expect((await render('`let a`')).html).toBe('<p><code>let a</code></p>');
  });

  it('removes scripts, styles and titles with their content', async () => {
    const { render } = setup();
    for (const tag of ['script', 'style', 'noscript', 'template', 'title']) {
      expect((await render(`<${tag}>inner</${tag}>ok`)).html, tag).toMatch(
        /^(<p>)?ok(<\/p>)?$/,
      );
    }
  });
});

describe('links to other files (W20)', () => {
  const pages: Record<string, string> = {
    'dir/b.md': '/p/b/',
    'c.md': '/p/c/',
    'dir/ü.md': '/p/ue/',
  };
  const linked = (articlePath = 'dir/a.md') =>
    setup({ articlePath, resolveLink: (p) => pages[p] });

  it('leads to the page and keeps the fragment', async () => {
    const { render } = linked();
    expect((await render('[b](b.md#part)')).html).toBe(
      '<p><a href="/p/b/#part">b</a></p>',
    );
    expect((await render('[b](b.md)')).html).toBe(
      '<p><a href="/p/b/">b</a></p>',
    );
    expect((await render('[c](c.md)')).html).toBe(
      '<p><a href="/p/c/">c</a></p>',
    );
    expect((await render('[u](u%CC%88.md)')).html).toBe(
      '<p><a href="/p/ue/">u</a></p>',
    );
    expect((await render('[b](B.MD)')).warnings).toEqual([
      'dir/a.md: link to "B.MD" leads to no published file and is shown as text',
    ]);
  });

  it('shows an unknown or unsafe target as text with a warning', async () => {
    const { render } = linked();
    for (const href of ['x.md', '../../x.md', '#top.md']) {
      const { html, warnings } = await render(`[t](${href})`);
      expect(html, href).toBe('<p>t</p>');
      const file = href.startsWith('#') ? '' : href;
      expect(warnings, href).toEqual([
        `dir/a.md: link to "${file}" leads to no published file and is shown as text`,
      ]);
    }
  });

  it('leaves links alone without a resolver, and links with a scheme', async () => {
    const plain = setup();
    expect((await plain.render('[b](b.md)')).html).toBe(
      '<p><a href="b.md">b</a></p>',
    );
    const { render } = linked();
    expect((await render('[b](file:b.md)')).html).toBe('<p><a>b</a></p>');
    expect((await render('[b](b.mdx)')).html).toBe(
      '<p><a href="b.mdx">b</a></p>',
    );
  });
});
