import { describe, expect, it } from 'vitest';
import { createTermMatcher } from './glossary-links.ts';
import type { GlossaryTerm } from './glossary-links.ts';
import { renderMarkdown } from './render.ts';

const terms: GlossaryTerm[] = [
  {
    slug: 'backup',
    names: ['Backup', 'Sicherung'],
    description: 'Eine Kopie der Daten.',
  },
  { slug: 'reverse-proxy', names: ['Reverse Proxy'] },
  { slug: 'proxy', names: ['Proxy'], description: 'Ein Vermittler.' },
  { slug: 'iso', names: ['ISO'] },
];

async function render(
  markdown: string,
  self?: string,
  list: GlossaryTerm[] = terms,
): Promise<string> {
  const { html } = await renderMarkdown(markdown, {
    articlePath: 'a.md',
    resolveImage: async () => ({ ok: false, code: 'not-found', reason: 'x' }),
    resolveLink: (p) => (p === 'glossar/backup.md' ? '/g/backup/' : undefined),
    glossary: { matcher: createTermMatcher(list), self },
  });
  return html;
}

describe('createTermMatcher', () => {
  it('is null without usable names', () => {
    expect(createTermMatcher([])).toBeNull();
    expect(
      createTermMatcher([{ slug: 'x', names: ['', ' ', 'a'] }]),
    ).toBeNull();
  });
});

describe('automatic glossary links', () => {
  it('links the first mention with the description as tooltip', async () => {
    const html = await render('Ein Backup ist wichtig. Noch ein Backup.');
    expect(html).toContain(
      '<a href="/g/backup/" class="glossary-link" title="Eine Kopie der Daten.">Backup</a> ist wichtig. Noch ein Backup.',
    );
    expect(html.match(/glossary-link/g)).toHaveLength(1);
  });

  it('ignores case, keeps the spelling of the text, and finds aliases and several words', async () => {
    const html = await render('Die SICHERUNG läuft über den reverse   proxy.');
    expect(html).toContain('>SICHERUNG</a>');
    expect(html).toContain('href="/g/backup/"');
    expect(html).toContain('href="/g/reverse-proxy/"');
    expect(html).toContain('>reverse   proxy</a>');
  });

  it('prefers the longer term at the same place', async () => {
    const html = await render('Ein Reverse Proxy und ein Proxy.');
    expect(html).toContain('href="/g/reverse-proxy/"');
    // The short term is linked once, at its own mention.
    expect(html.match(/href="\/g\/proxy\/"/g)).toHaveLength(1);
    expect(html).toMatch(/und ein <a href="\/g\/proxy\/"[^>]*>Proxy<\/a>\./);
  });

  it('links whole words only', async () => {
    const html = await render(
      'Backups, Feedback, Backup-Strategie und Isolation ISO.',
    );
    expect(html).not.toContain('>Backups<');
    expect(html).not.toContain('>Feedback<');
    expect(html).not.toContain('>Isolation<');
    expect(html).toContain('>Backup</a>-Strategie');
    expect(html).toContain('>ISO</a>.');
  });

  it('does not link inside links, code, headings or already linked terms', async () => {
    const html = await render(
      [
        '# Backup',
        '',
        'Siehe [Backup](https://example.org/x) und `Backup` und:',
        '',
        '```',
        'Backup',
        '```',
        '',
        'Dann erst das Backup.',
      ].join('\n'),
    );
    expect(html).toContain('<h2>Backup</h2>');
    expect(html).toContain('<a href="https://example.org/x"');
    expect(html).toContain('<code>Backup</code>');
    expect(html).toMatch(/Dann erst das <a href="\/g\/backup\/"/);
    expect(html.match(/glossary-link/g)).toHaveLength(1);
  });

  it('counts a link written by hand as the first link of the term', async () => {
    const html = await render(
      'Das [Sicherungskonzept](glossar/backup.md) steht oben. Später das Backup im Text.',
    );
    expect(html).toContain('href="/g/backup/"');
    // The hand-written link is the only one; the later mention stays text.
    expect(html.match(/href="\/g\/backup\/"/g)).toHaveLength(1);
    expect(html).not.toContain('glossary-link');
    expect(html).toContain('Später das Backup im Text.');
  });

  it('never links a term on its own page, but other terms there', async () => {
    const html = await render('Backup und Proxy.', 'backup');
    expect(html).not.toContain('href="/g/backup/"');
    expect(html).toContain('href="/g/proxy/"');
  });

  it('uses no tooltip when the term has no description, and escapes the text', async () => {
    const html = await render('Reverse Proxy <b>fett</b> & Backup', undefined, [
      { slug: 'reverse-proxy', names: ['Reverse Proxy'] },
      {
        slug: 'backup',
        names: ['Backup'],
        description: 'A "quoted" <b>text</b>',
      },
    ]);
    expect(html).toContain(
      '<a href="/g/reverse-proxy/" class="glossary-link">Reverse Proxy</a>',
    );
    expect(html).toContain(
      'title="A &#x22;quoted&#x22; <b>text</b>"'.replace(/&#x22;/g, '&#x22;'),
    );
  });

  it('does nothing without a glossary', async () => {
    const { html } = await renderMarkdown('Ein Backup.', {
      articlePath: 'a.md',
      resolveImage: async () => ({ ok: false, code: 'not-found', reason: 'x' }),
    });
    expect(html).not.toContain('<a');
  });
});
