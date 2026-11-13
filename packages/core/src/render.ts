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
import { linkGlossaryTerms } from './glossary-links.ts';
import type { GlossaryLinking } from './glossary-links.ts';
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
  /**
   * Resolves a link to another Markdown file of the folder (path relative to
   * the content folder, NFC) to the address of its page; `undefined` for an
   * unknown or unpublished file. Without it, relative links stay as they are.
   */
  resolveLink?: (rootRelativePath: string) => string | undefined;
  /** Links glossary terms in the text (see `glossary-links.ts`). */
  glossary?: GlossaryLinking;
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

/** The decoded relative path of an address, or the reason it is refused. */
function relativeSource(src: string): { rel: string } | { reason: string } {
  let rel: string;
  try {
    rel = decodeURIComponent(src);
  } catch {
    return { reason: 'invalid path encoding' };
  }
  if (rel.includes('\0') || rel.includes('\\'))
    return { reason: 'invalid path' };
  if (rel.startsWith('/')) return { reason: 'absolute paths are not allowed' };
  if (rel.includes('?') || rel.includes('#'))
    return { reason: 'parameters in the path are not allowed' };
  return { rel };
}

/** Turns the image address of an article into paths relative to the content folder. */
function candidatesFor(articlePath: string, src: string): PathResult {
  const decoded = relativeSource(src);
  if ('reason' in decoded) return { ok: false, reason: decoded.reason };
  const rel = decoded.rel;
  const base = path.posix.dirname(articlePath);
  const relativeToArticle = path.posix.normalize(path.posix.join(base, rel));
  const error = checkPath(relativeToArticle);
  if (error !== null) return { ok: false, reason: error };

  const candidates = [relativeToArticle];
  // Obsidian can also write paths starting at the folder root.
  const fromRoot = path.posix.normalize(rel);
  const relativeMarker = rel.startsWith('./') || rel.startsWith('../');
  if (
    base !== '.' &&
    !relativeMarker &&
    checkPath(fromRoot) === null &&
    fromRoot !== relativeToArticle
  )
    candidates.push(fromRoot);
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

type Found = Array<[Element, Element | Root]>;

/** What the content steps need: the options, the warnings, the texts. */
interface Content {
  options: RenderOptions;
  warnings: string[];
  ui: (typeof UI)[Language];
}

const warnOf = (c: Content, text: string) =>
  c.warnings.push(`${c.options.articlePath}: ${text}`);

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** True for a link to another Markdown file of the folder (W20). */
const isFileLink = (c: Content, href: string) =>
  c.options.resolveLink !== undefined &&
  !SCHEME.test(href) &&
  /\.md(#.*)?$/i.test(href);

/** Headings one level down, external links without referrer, file links collected. */
function markLink(
  c: Content,
  node: Element,
  parent: Element | Root,
  files: Found,
) {
  const href = String(node.properties?.href ?? '');
  if (/^https?:\/\//i.test(href))
    node.properties = { ...node.properties, rel: ['noopener', 'noreferrer'] };
  else if (isFileLink(c, href)) files.push([node, parent]);
}

/** The first child that is not blank text, if it is an element. */
function firstElement(node: Element): Element | undefined {
  const first = node.children.find(
    (child) => child.type !== 'text' || child.value.trim() !== '',
  );
  return first?.type === 'element' ? first : undefined;
}

/**
 * The checkbox of a task list item (`- [x] ...`), directly in the item or in
 * its first paragraph. Any other input is removed: the sanitizer turns every
 * input into a disabled checkbox, so the type alone does not tell them apart.
 */
function taskBox(item: Element): Element | undefined {
  const classes = item.properties?.className;
  if (!Array.isArray(classes) || !classes.includes('task-list-item'))
    return undefined;
  const first = firstElement(item);
  const box = first?.tagName === 'p' ? firstElement(first) : first;
  return box?.tagName === 'input' ? box : undefined;
}

/** Collects the elements the later steps change; shifts headings on the way. */
function collect(c: Content, tree: Root) {
  const found = {
    images: [] as Found,
    frames: [] as Found,
    inputs: [] as Found,
    files: [] as Found,
    tasks: new Set<Element>(),
  };
  const buckets: Record<string, Found> = {
    img: found.images,
    iframe: found.frames,
    input: found.inputs,
  };
  visit(tree, 'element', (node, _index, parent) => {
    if (!parent) return;
    const p = parent as Element | Root;
    const bucket = buckets[node.tagName];
    if (bucket) bucket.push([node, p]);
    else if (/^h[1-6]$/.test(node.tagName))
      node.tagName = `h${Math.min(6, Number(node.tagName.slice(1)) + 1)}`;
    else if (node.tagName === 'a') markLink(c, node, p, found.files);
    else if (node.tagName === 'li') {
      const box = taskBox(node);
      if (box) found.tasks.add(box);
    }
  });
  return found;
}

/**
 * Links to other files of the folder lead to their pages (W20). A link to an
 * unknown or unpublished file becomes its text: its name must not leak.
 */
function resolveFileLink(c: Content, node: Element, parent: Element | Root) {
  const href = String(node.properties?.href ?? '');
  const hash = href.indexOf('#');
  const file = hash >= 0 ? href.slice(0, hash) : href;
  const fragment = hash >= 0 ? href.slice(hash) : '';
  const paths = candidatesFor(c.options.articlePath, file);
  const target = paths.ok
    ? paths.candidates
        .map((p) => c.options.resolveLink?.(p.normalize('NFC')))
        .find((url) => url !== undefined)
    : undefined;
  if (target) {
    node.properties = { href: `${target}${fragment}` };
    return;
  }
  warnOf(
    c,
    `link to "${file}" leads to no published file and is shown as text`,
  );
  replaceNode(parent, node, node.children);
}

/**
 * Colors code with a known language through classes (`hljs-*`). This runs
 * after sanitizing, so the classes come only from the coloring, never from
 * the text. Without a language nothing is guessed.
 */
function highlightCode(tree: Root) {
  visit(tree, 'element', (node, _index, parent) => {
    if (node.tagName !== 'code' || (parent as Element)?.tagName !== 'pre')
      return;
    const classes = Array.isArray(node.properties?.className)
      ? node.properties.className.map(String)
      : [];
    const language = classes
      .find((cl) => cl.startsWith('language-'))
      ?.slice('language-'.length);
    if (!language || !lowlight.registered(language)) return;
    const source = node.children
      .map((child) => (child.type === 'text' ? child.value : ''))
      .join('');
    node.children = lowlight.highlight(language, source)
      .children as ElementContent[];
    node.properties = { ...node.properties, className: [...classes, 'hljs'] };
  });
}

/** An allowed embed becomes a placeholder that loads only after a click. */
function replaceFrame(c: Content, node: Element, parent: Element | Root) {
  const source = String(node.properties?.src ?? '');
  const match =
    source === '' || c.options.remoteContent === 'none'
      ? null
      : matchEmbed(source);
  if (match === null) {
    warnOf(
      c,
      `embed ${source === '' ? 'without an address' : hostOf(source)} is not allowed and is removed`,
    );
    replaceNode(parent, node, []);
    return;
  }
  const { ui } = c;
  replaceNode(parent, node, [
    element(
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
    ),
  ]);
}

/** A remote image stays only from the allowlist (and never in the strict mode). */
function remoteImage(
  c: Content,
  node: Element,
  parent: Element | Root,
  source: string,
  alt: string,
) {
  if (c.options.remoteContent === 'none' || !isAllowedImageUrl(source)) {
    warnOf(c, `image from ${hostOf(source)} is not allowed and is removed`);
    replaceNode(parent, node, imageAsText(alt));
    return;
  }
  node.properties = {
    src: source,
    alt,
    loading: 'lazy',
    decoding: 'async',
    referrerPolicy: 'no-referrer',
  };
}

async function resolveCandidates(
  c: Content,
  candidates: string[],
): Promise<ImageResolveResult> {
  let resolved: ImageResolveResult = {
    ok: false,
    code: 'not-found',
    reason: 'not found',
  };
  for (const candidate of candidates) {
    resolved = await c.options.resolveImage(candidate);
    if (resolved.ok || resolved.code !== 'not-found') break;
  }
  return resolved;
}

/** A local image becomes its variants, or a visible note when it is missing. */
async function localImage(
  c: Content,
  node: Element,
  parent: Element | Root,
  source: string,
  alt: string,
) {
  const paths = candidatesFor(c.options.articlePath, source);
  if (!paths.ok) {
    warnOf(c, `image "${source}" is removed (${paths.reason})`);
    replaceNode(parent, node, imageAsText(alt));
    return;
  }
  const resolved = await resolveCandidates(c, paths.candidates);
  if (!resolved.ok) {
    warnOf(c, `image "${source}" is missing or unusable (${resolved.reason})`);
    replaceNode(parent, node, [
      element('span', { className: ['image-missing'] }, [
        text(c.ui.imageMissing(alt)),
      ]),
    ]);
    return;
  }
  const image = resolved.image;
  node.properties = {
    src: image.src,
    // An SVG has one file and no variants.
    srcSet: image.srcset === '' ? undefined : image.srcset,
    sizes: image.srcset === '' ? undefined : IMAGE_SIZES,
    width: image.width,
    height: image.height,
    alt,
    loading: 'lazy',
    decoding: 'async',
  };
}

async function replaceImage(c: Content, node: Element, parent: Element | Root) {
  const source = String(node.properties?.src ?? '');
  const alt = String(node.properties?.alt ?? '');
  if (source === '') {
    warnOf(c, 'image without a valid address is removed');
    replaceNode(parent, node, imageAsText(alt));
  } else if (SCHEME.test(source) || source.startsWith('//'))
    remoteImage(c, node, parent, source, alt);
  else await localImage(c, node, parent, source, alt);
}

function rehypeContent(options: RenderOptions, warnings: string[]) {
  const c: Content = {
    options,
    warnings,
    ui: UI[options.lang ?? DEFAULT_LANG],
  };
  return async (tree: Root): Promise<void> => {
    const found = collect(c, tree);
    for (const [node, parent] of found.files) resolveFileLink(c, node, parent);
    highlightCode(tree);
    for (const [node, parent] of found.inputs)
      if (!found.tasks.has(node)) replaceNode(parent, node, []);
    for (const [node, parent] of found.frames) replaceFrame(c, node, parent);
    for (const [node, parent] of found.images)
      await replaceImage(c, node, parent);
  };
}

function rehypeGlossary(glossary: GlossaryLinking | undefined) {
  return (tree: Root): void => {
    if (glossary) linkGlossaryTerms(tree, glossary);
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
    // After the content step, so links written by hand are resolved and count.
    .use(rehypeGlossary, options.glossary)
    .use(rehypeStringify)
    .process(markdown);
  return { html: String(file), warnings };
}
