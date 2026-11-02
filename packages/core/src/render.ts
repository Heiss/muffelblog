import type { Element, ElementContent, Root, Text } from 'hast';
import path from 'node:path';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeOptions,
} from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { isAllowedImageUrl, matchEmbed } from './policy.ts';

export interface ResolvedImage {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

export type ImageResolveResult =
  | { ok: true; image: ResolvedImage }
  | {
      ok: false;
      code: 'not-found' | 'unsupported' | 'invalid';
      reason: string;
    };

export interface RenderOptions {
  /** Pfad des Artikels relativ zum Inhaltsordner, mit `/` als Trenner. */
  articlePath: string;
  /** Löst ein Bild (Pfad relativ zum Inhaltsordner) auf und liefert die Varianten. */
  resolveImage: (rootRelativePath: string) => Promise<ImageResolveResult>;
}

export interface RenderResult {
  html: string;
  warnings: string[];
}

const BILD_GROESSEN = '(min-width: 760px) 720px, 100vw';

const schema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'iframe'],
  strip: ['script', 'style', 'noscript', 'template', 'title'],
  attributes: {
    ...defaultSchema.attributes,
    // Nur die Adresse; der Platzhalter-Baustein prüft sie gegen die Richtlinie.
    iframe: ['src'],
  },
};

function text(wert: string): Text {
  return { type: 'text', value: wert };
}

function element(
  tagName: string,
  properties: Element['properties'],
  children: ElementContent[] = [],
): Element {
  return { type: 'element', tagName, properties, children };
}

function hostVon(wert: string): string {
  try {
    return new URL(wert).hostname;
  } catch {
    return wert;
  }
}

type PfadErgebnis =
  { ok: true; kandidaten: string[] } | { ok: false; reason: string };

function pruefePfad(pfad: string): string | null {
  const normal = path.posix.normalize(pfad);
  if (normal === '..' || normal.startsWith('../') || normal === '.')
    return 'liegt außerhalb des Inhaltsordners';
  if (normal.split('/').some((teil) => teil.startsWith('.')))
    return 'liegt in einem versteckten Pfad';
  return null;
}

/** Wandelt die Bildadresse eines Artikels in Pfade relativ zum Inhaltsordner um. */
function kandidatenFuer(articlePath: string, src: string): PfadErgebnis {
  let rel: string;
  try {
    rel = decodeURIComponent(src);
  } catch {
    return { ok: false, reason: 'ungültig kodierter Pfad' };
  }
  if (rel.includes('\0') || rel.includes('\\'))
    return { ok: false, reason: 'ungültiger Pfad' };
  if (rel.startsWith('/'))
    return { ok: false, reason: 'absolute Pfade sind nicht erlaubt' };
  if (rel.includes('?') || rel.includes('#'))
    return { ok: false, reason: 'Parameter im Pfad sind nicht erlaubt' };

  const basis = path.posix.dirname(articlePath);
  const relativZumArtikel = path.posix.normalize(path.posix.join(basis, rel));
  const fehler = pruefePfad(relativZumArtikel);
  if (fehler !== null) return { ok: false, reason: fehler };

  const kandidaten = [relativZumArtikel];
  // Obsidian kann Pfade auch ab der Ordnerwurzel schreiben.
  if (basis !== '.' && !rel.startsWith('./') && !rel.startsWith('../')) {
    const abWurzel = path.posix.normalize(rel);
    if (pruefePfad(abWurzel) === null && abWurzel !== relativZumArtikel)
      kandidaten.push(abWurzel);
  }
  return { ok: true, kandidaten };
}

function ersetze(
  eltern: Element | Root,
  alt: ElementContent,
  neu: ElementContent[],
): void {
  eltern.children = eltern.children.flatMap((kind) =>
    kind === alt ? neu : [kind],
  ) as typeof eltern.children;
}

function bildAlsText(alt: string): ElementContent[] {
  return alt === '' ? [] : [text(alt)];
}

function rehypeInhalt(options: RenderOptions, warnings: string[]) {
  return async (baum: Root): Promise<void> => {
    const bilder: Array<[Element, Element | Root]> = [];
    const frames: Array<[Element, Element | Root]> = [];
    const eingaben: Array<[Element, Element | Root]> = [];

    visit(baum, 'element', (knoten, _index, eltern) => {
      if (!eltern) return;
      if (knoten.tagName === 'img')
        bilder.push([knoten, eltern as Element | Root]);
      else if (knoten.tagName === 'iframe')
        frames.push([knoten, eltern as Element | Root]);
      else if (knoten.tagName === 'input')
        eingaben.push([knoten, eltern as Element | Root]);
      else if (/^h[1-6]$/.test(knoten.tagName)) {
        const ebene = Math.min(6, Number(knoten.tagName.slice(1)) + 1);
        knoten.tagName = `h${ebene}`;
      } else if (knoten.tagName === 'a') {
        const href = String(knoten.properties?.href ?? '');
        if (/^https?:\/\//i.test(href))
          knoten.properties = {
            ...knoten.properties,
            rel: ['noopener', 'noreferrer'],
          };
      }
    });

    for (const [knoten, eltern] of eingaben) {
      if (knoten.properties?.type !== 'checkbox') ersetze(eltern, knoten, []);
    }

    for (const [knoten, eltern] of frames) {
      const quelle = String(knoten.properties?.src ?? '');
      const treffer = quelle === '' ? null : matchEmbed(quelle);
      if (treffer === null) {
        warnings.push(
          `${options.articlePath}: Einbettung ${quelle === '' ? 'ohne Adresse' : hostVon(quelle)} ist nicht freigegeben und wird entfernt`,
        );
        ersetze(eltern, knoten, []);
        continue;
      }
      const platzhalter = element(
        'div',
        {
          className: ['embed'],
          dataEmbedSrc: treffer.src,
          dataEmbedLabel: treffer.label,
        },
        [
          element('p', {}, [
            text(
              `Dieser Inhalt wird von ${treffer.label} geladen, sobald du ihn startest.`,
            ),
          ]),
          element('button', { type: 'button', className: ['embed-start'] }, [
            text('Inhalt laden'),
          ]),
          element('p', {}, [
            element(
              'a',
              { href: treffer.openUrl, rel: ['noopener', 'noreferrer'] },
              [text(`Auf ${treffer.label} öffnen`)],
            ),
          ]),
        ],
      );
      ersetze(eltern, knoten, [platzhalter]);
    }

    for (const [knoten, eltern] of bilder) {
      const quelle = String(knoten.properties?.src ?? '');
      const alt = String(knoten.properties?.alt ?? '');

      if (quelle === '') {
        warnings.push(
          `${options.articlePath}: Bild ohne gültige Adresse wird entfernt`,
        );
        ersetze(eltern, knoten, bildAlsText(alt));
        continue;
      }

      if (/^[a-z][a-z0-9+.-]*:/i.test(quelle) || quelle.startsWith('//')) {
        if (!isAllowedImageUrl(quelle)) {
          warnings.push(
            `${options.articlePath}: Bild von ${hostVon(quelle)} ist nicht freigegeben und wird entfernt`,
          );
          ersetze(eltern, knoten, bildAlsText(alt));
          continue;
        }
        knoten.properties = {
          src: quelle,
          alt,
          loading: 'lazy',
          decoding: 'async',
          referrerPolicy: 'no-referrer',
        };
        continue;
      }

      const pfade = kandidatenFuer(options.articlePath, quelle);
      if (!pfade.ok) {
        warnings.push(
          `${options.articlePath}: Bild "${quelle}" wird entfernt (${pfade.reason})`,
        );
        ersetze(eltern, knoten, bildAlsText(alt));
        continue;
      }

      let aufgeloest: ImageResolveResult = {
        ok: false,
        code: 'not-found',
        reason: 'nicht gefunden',
      };
      for (const kandidat of pfade.kandidaten) {
        aufgeloest = await options.resolveImage(kandidat);
        if (aufgeloest.ok || aufgeloest.code !== 'not-found') break;
      }

      if (aufgeloest.ok) {
        const bild = aufgeloest.image;
        knoten.properties = {
          src: bild.src,
          srcSet: bild.srcset,
          sizes: BILD_GROESSEN,
          width: bild.width,
          height: bild.height,
          alt,
          loading: 'lazy',
          decoding: 'async',
        };
      } else {
        warnings.push(
          `${options.articlePath}: Bild "${quelle}" fehlt oder ist unbrauchbar (${aufgeloest.reason})`,
        );
        ersetze(eltern, knoten, [
          element('span', { className: ['bild-fehlt'] }, [
            text(`[Bild fehlt${alt === '' ? '' : `: ${alt}`}]`),
          ]),
        ]);
      }
    }
  };
}

/**
 * Rendert Markdown zu bereinigtem HTML.
 * - Rohes HTML wird nur über eine Allowlist übernommen; Skripte, Ereignis-
 *   Attribute, gefährliche Verweise, Formulare, SVG und Objekte fallen weg.
 * - Remote-Bilder und Einbettungen nur von freigegebenen Hosts (siehe policy.ts).
 * - Lokale Bilder gehen durch `resolveImage`; Pfade außerhalb des Ordners werden abgewiesen.
 * - Überschriften rutschen eine Ebene nach unten, die Seite trägt das h1.
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderOptions,
): Promise<RenderResult> {
  const warnings: string[] = [];
  const datei = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeInhalt, options, warnings)
    .use(rehypeStringify)
    .process(markdown);
  return { html: String(datei), warnings };
}
