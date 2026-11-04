import { DEFAULT_LANG } from './config.ts';
import type { Language } from './config.ts';
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
import { common, createLowlight } from 'lowlight';
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
  /** Path of the article relative to the content folder, with `/` as the separator. */
  articlePath: string;
  /** Resolves an image (path relative to the content folder) and returns the variants. */
  resolveImage: (rootRelativePath: string) => Promise<ImageResolveResult>;
  /**
   * `allowlist` (default): remote images and embeds of the allowlists stay.
   * `none`: foreign content is always removed, for example for memos.
   */
  remoteContent?: 'allowlist' | 'none';
  /** Language of the generated texts (placeholders). Default: `en`. */
  lang?: Language;
}

export interface RenderResult {
  html: string;
  warnings: string[];
}

const lowlight = createLowlight(common);

const IMAGE_SIZES = '(min-width: 760px) 720px, 100vw';

const schema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'iframe'],
  strip: ['script', 'style', 'noscript', 'template', 'title'],
  attributes: {
    ...defaultSchema.attributes,
    // Only the address; the placeholder step checks it against the policy.
    iframe: ['src'],
  },
};

function text(value: string): Text {
  return { type: 'text', value };
}

function element(
  tagName: string,
  properties: Element['properties'],
  children: ElementContent[] = [],
): Element {
  return { type: 'element', tagName, properties, children };
}

function hostOf(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

type PathResult =
  { ok: true; candidates: string[] } | { ok: false; reason: string };

function checkPath(pathValue: string): string | null {
  const normal = path.posix.normalize(pathValue);
  if (normal === '..' || normal.startsWith('../') || normal === '.')
    return 'is outside the content folder';
  if (normal.split('/').some((part) => part.startsWith('.')))
    return 'is in a hidden path';
  return null;
}

/** Turns the image address of an article into paths relative to the content folder. */
function candidatesFor(articlePath: string, src: string): PathResult {
  let rel: string;
  try {
    rel = decodeURIComponent(src);
  } catch {
    return { ok: false, reason: 'invalid path encoding' };
  }
  if (rel.includes('\0') || rel.includes('\\'))
    return { ok: false, reason: 'invalid path' };
  if (rel.startsWith('/'))
    return { ok: false, reason: 'absolute paths are not allowed' };
  if (rel.includes('?') || rel.includes('#'))
    return { ok: false, reason: 'parameters in the path are not allowed' };

  const base = path.posix.dirname(articlePath);
  const relativeToArticle = path.posix.normalize(path.posix.join(base, rel));
  const error = checkPath(relativeToArticle);
  if (error !== null) return { ok: false, reason: error };

  const candidates = [relativeToArticle];
  // Obsidian can also write paths starting at the folder root.
  if (base !== '.' && !rel.startsWith('./') && !rel.startsWith('../')) {
    const fromRoot = path.posix.normalize(rel);
    if (checkPath(fromRoot) === null && fromRoot !== relativeToArticle)
      candidates.push(fromRoot);
  }
  return { ok: true, candidates };
}

function replaceNode(
  parent: Element | Root,
  old: ElementContent,
  replacement: ElementContent[],
): void {
  parent.children = parent.children.flatMap((child) =>
    child === old ? replacement : [child],
  ) as typeof parent.children;
}

function imageAsText(alt: string): ElementContent[] {
  return alt === '' ? [] : [text(alt)];
}

// Texts that end up in the rendered HTML. The rest of the UI lives in the
// message catalog of the site; the renderer is part of the core and cannot reach
// it, so these few texts are kept here, per language.
const UI: Record<
  Language,
  {
    embedNotice: (label: string) => string;
    embedLoad: string;
    embedOpen: (label: string) => string;
    imageMissing: (alt: string) => string;
  }
> = {
  en: {
    embedNotice: (label) =>
      `This content is loaded from ${label} once you start it.`,
    embedLoad: 'Load content',
    embedOpen: (label) => `Open on ${label}`,
    imageMissing: (alt) => `[Image missing${alt === '' ? '' : `: ${alt}`}]`,
  },
  de: {
    embedNotice: (label) =>
      `Dieser Inhalt wird von ${label} geladen, sobald du ihn startest.`,
    embedLoad: 'Inhalt laden',
    embedOpen: (label) => `Auf ${label} öffnen`,
    imageMissing: (alt) => `[Bild fehlt${alt === '' ? '' : `: ${alt}`}]`,
  },
};

function rehypeContent(options: RenderOptions, warnings: string[]) {
  const ui = UI[options.lang ?? DEFAULT_LANG];
  return async (tree: Root): Promise<void> => {
    const images: Array<[Element, Element | Root]> = [];
    const frames: Array<[Element, Element | Root]> = [];
    const inputs: Array<[Element, Element | Root]> = [];

    visit(tree, 'element', (node, _index, parent) => {
      if (!parent) return;
      if (node.tagName === 'img') images.push([node, parent as Element | Root]);
      else if (node.tagName === 'iframe')
        frames.push([node, parent as Element | Root]);
      else if (node.tagName === 'input')
        inputs.push([node, parent as Element | Root]);
      else if (/^h[1-6]$/.test(node.tagName)) {
        const level = Math.min(6, Number(node.tagName.slice(1)) + 1);
        node.tagName = `h${level}`;
      } else if (node.tagName === 'a') {
        const href = String(node.properties?.href ?? '');
        if (/^https?:\/\//i.test(href))
          node.properties = {
            ...node.properties,
            rel: ['noopener', 'noreferrer'],
          };
      }
    });

    // Colors code with a known language through classes (`hljs-*`). This runs
    // after sanitizing, so the classes come only from the coloring, never from
    // the text. Without a language nothing is guessed.
    visit(tree, 'element', (node, _index, parent) => {
      if (node.tagName !== 'code' || (parent as Element)?.tagName !== 'pre')
        return;
      const classes = Array.isArray(node.properties?.className)
        ? node.properties.className.map(String)
        : [];
      const language = classes
        .find((c) => c.startsWith('language-'))
        ?.slice('language-'.length);
      if (!language || !lowlight.registered(language)) return;
      const source = node.children
        .map((child) => (child.type === 'text' ? child.value : ''))
        .join('');
      const result = lowlight.highlight(language, source);
      node.children = result.children as ElementContent[];
      node.properties = {
        ...node.properties,
        className: [...classes, 'hljs'],
      };
    });

    for (const [node, parent] of inputs) {
      if (node.properties?.type !== 'checkbox') replaceNode(parent, node, []);
    }

    for (const [node, parent] of frames) {
      const source = String(node.properties?.src ?? '');
      const match =
        source === '' || options.remoteContent === 'none'
          ? null
          : matchEmbed(source);
      if (match === null) {
        warnings.push(
          `${options.articlePath}: embed ${source === '' ? 'without an address' : hostOf(source)} is not allowed and is removed`,
        );
        replaceNode(parent, node, []);
        continue;
      }
      const placeholder = element(
        'div',
        {
          className: ['embed'],
          dataEmbedSrc: match.src,
          dataEmbedLabel: match.label,
        },
        [
          element('p', {}, [text(ui.embedNotice(match.label))]),
          element('button', { type: 'button', className: ['embed-start'] }, [
            text(ui.embedLoad),
          ]),
          element('p', {}, [
            element(
              'a',
              { href: match.openUrl, rel: ['noopener', 'noreferrer'] },
              [text(ui.embedOpen(match.label))],
            ),
          ]),
        ],
      );
      replaceNode(parent, node, [placeholder]);
    }

    for (const [node, parent] of images) {
      const source = String(node.properties?.src ?? '');
      const alt = String(node.properties?.alt ?? '');

      if (source === '') {
        warnings.push(
          `${options.articlePath}: image without a valid address is removed`,
        );
        replaceNode(parent, node, imageAsText(alt));
        continue;
      }

      if (/^[a-z][a-z0-9+.-]*:/i.test(source) || source.startsWith('//')) {
        if (options.remoteContent === 'none' || !isAllowedImageUrl(source)) {
          warnings.push(
            `${options.articlePath}: image from ${hostOf(source)} is not allowed and is removed`,
          );
          replaceNode(parent, node, imageAsText(alt));
          continue;
        }
        node.properties = {
          src: source,
          alt,
          loading: 'lazy',
          decoding: 'async',
          referrerPolicy: 'no-referrer',
        };
        continue;
      }

      const paths = candidatesFor(options.articlePath, source);
      if (!paths.ok) {
        warnings.push(
          `${options.articlePath}: image "${source}" is removed (${paths.reason})`,
        );
        replaceNode(parent, node, imageAsText(alt));
        continue;
      }

      let resolved: ImageResolveResult = {
        ok: false,
        code: 'not-found',
        reason: 'not found',
      };
      for (const candidate of paths.candidates) {
        resolved = await options.resolveImage(candidate);
        if (resolved.ok || resolved.code !== 'not-found') break;
      }

      if (resolved.ok) {
        const image = resolved.image;
        node.properties = {
          src: image.src,
          srcSet: image.srcset,
          sizes: IMAGE_SIZES,
          width: image.width,
          height: image.height,
          alt,
          loading: 'lazy',
          decoding: 'async',
        };
      } else {
        warnings.push(
          `${options.articlePath}: image "${source}" is missing or unusable (${resolved.reason})`,
        );
        replaceNode(parent, node, [
          element('span', { className: ['image-missing'] }, [
            text(ui.imageMissing(alt)),
          ]),
        ]);
      }
    }
  };
}

/**
 * Renders Markdown to sanitized HTML.
 * - Raw HTML is accepted only through an allowlist; scripts, event attributes,
 *   dangerous links, forms, SVG and objects are dropped.
 * - Remote images and embeds only from allowed hosts (see policy.ts).
 * - Local images go through `resolveImage`; paths outside the folder are rejected.
 * - Headings move down one level, the page carries the h1.
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderOptions,
): Promise<RenderResult> {
  const warnings: string[] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeContent, options, warnings)
    .use(rehypeStringify)
    .process(markdown);
  return { html: String(file), warnings };
}
