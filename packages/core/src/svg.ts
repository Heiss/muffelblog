import { parseFragment } from 'parse5';

/**
 * Sanitizer for SVG images (own files in the Nextcloud folder, memo
 * attachments). The result is shown only through <img>, where scripts never run
 * and nothing is loaded, and is cleaned on top of that: only known elements and
 * attributes stay, scripts, `foreignObject`, event handlers, foreign images and
 * every reference that leaves the file are removed. SMIL and CSS animations
 * stay. The file is parsed with the HTML parser (as browsers do for inline SVG)
 * and written again as XML from the cleaned tree, so nothing of the original
 * text is passed through.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_DEPTH = 64;
const MAX_NODES = 200_000;

const ELEMENTS: ReadonlySet<string> = new Set([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'switch',
  'title',
  'desc',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
  'clipPath',
  'mask',
  'marker',
  'style',
  'filter',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'animate',
  'animateTransform',
  'animateMotion',
  'mpath',
  'set',
]);

/** Elements whose children are kept but which are not kept themselves. */
const UNWRAPPED: ReadonlySet<string> = new Set(['a']);

/** Elements that may carry `href="#id"` (a reference inside the file). */
const HREF_ELEMENTS: ReadonlySet<string> = new Set([
  'use',
  'textPath',
  'mpath',
  'linearGradient',
  'radialGradient',
  'pattern',
  'filter',
]);

/** Animation elements; the attribute they change must not be a link or a handler. */
const ANIMATIONS: ReadonlySet<string> = new Set([
  'animate',
  'animateTransform',
  'animateMotion',
  'set',
]);

const NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const FRAGMENT = /^#[A-Za-z0-9_.:-]+$/;
const BAD_VALUE = /javascript:|vbscript:|data:|expression\s*\(|@import|<|&#/i;
const BAD_CSS =
  /@import|@namespace|expression\s*\(|behaviou?r\s*:|-moz-binding|javascript:|vbscript:|data:|\\|<|&#/i;
const URL_REF = /url\(\s*(['"]?)\s*([^)'"\s]*)/gi;

export interface SvgResult {
  ok: true;
  /** The cleaned SVG file as text. */
  svg: string;
  width: number;
  height: number;
  /** What was removed, for the build log. */
  removed: string[];
}

export type SvgFailure = { ok: false; reason: string };

/** Every `url(...)` points inside the file (`#id`); false otherwise. */
function urlsStayInside(value: string): boolean {
  for (const match of value.matchAll(URL_REF)) {
    if (!(match[2] ?? '').startsWith('#')) return false;
  }
  return true;
}

function cssIsSafe(css: string): boolean {
  return !BAD_CSS.test(css) && urlsStayInside(css);
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

/** XML forbids control characters; they are dropped from text and values. */
function cleanChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
}

interface Attr {
  name: string;
  value: string;
  prefix?: string;
}
interface Node {
  nodeName: string;
  tagName?: string;
  namespaceURI?: string;
  attrs?: Attr[];
  childNodes?: Node[];
  value?: string;
}

/** The attribute name as the file wrote it, with its prefix. */
const qualified = (attr: Attr): string =>
  attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;

const BLOCKED_NAMES: ReadonlySet<string> = new Set([
  'xml:base',
  'src',
  'srcdoc',
]);

/** Event handlers and namespace declarations never pass. */
const isHandlerOrNamespace = (lower: string): boolean =>
  lower.startsWith('on') || lower.startsWith('xmlns');

/** Plain names, `xlink:href` and `xml:` names pass; handlers, namespaces and foreign prefixes do not. */
function nameIsAllowed(attr: Attr): boolean {
  const name = qualified(attr);
  const lower = name.toLowerCase();
  if (!NAME.test(name) || isHandlerOrNamespace(lower)) return false;
  if (BLOCKED_NAMES.has(lower)) return false;
  const prefix = attr.prefix ?? '';
  // A colon without a prefix of the HTML parser is a foreign prefix of the file.
  if (prefix === '') return !name.includes(':') || lower === 'xlink:href';
  return prefix === 'xlink' || prefix === 'xml';
}

/** A link is kept only on elements that use one, and only to an `#id` inside the file. */
function linkValue(element: string, value: string): string | null {
  const link = value.trim();
  return HREF_ELEMENTS.has(element) && FRAGMENT.test(link) ? link : null;
}

const valueIsSafe = (value: string): boolean =>
  !BAD_VALUE.test(value) && urlsStayInside(value);

/** The kept attribute as `[qualified name, value]`, or null when it goes. */
function keepAttribute(element: string, attr: Attr): [string, string] | null {
  if (!nameIsAllowed(attr)) return null;
  const name = qualified(attr);
  const lower = name.toLowerCase();
  const value = cleanChars(attr.value);
  if (lower === 'href' || lower === 'xlink:href') {
    const link = linkValue(element, value);
    return link === null ? null : [name, link];
  }
  const safe = lower === 'style' ? cssIsSafe(value) : valueIsSafe(value);
  return safe ? [name, value] : null;
}

/** An animation that would change a link or an event handler is removed. */
function animationIsSafe(node: Node): boolean {
  const target = (node.attrs ?? []).find((a) => a.name === 'attributeName');
  const lower = (target?.value ?? '').trim().toLowerCase();
  return !(lower.endsWith('href') || lower.startsWith('on'));
}

function noteRemoved(state: State, attr: Attr): void {
  const name = qualified(attr);
  // The namespaces are written by the sanitizer itself, their removal is no news.
  if (!name.toLowerCase().startsWith('xmlns'))
    state.removed.add(`attribute ${name}`);
}

interface State {
  count: number;
  removed: Set<string>;
  usesXlink: boolean;
}

function textOf(node: Node): string {
  return (node.childNodes ?? []).map((c) => c.value ?? '').join('');
}

/** The kept attributes as text; the ones that go are noted. */
function keptAttributes(element: string, attrs: Attr[], state: State): string {
  let out = '';
  for (const attr of attrs) {
    const kept = keepAttribute(element, attr);
    if (kept === null) {
      noteRemoved(state, attr);
      continue;
    }
    if (kept[0].toLowerCase().startsWith('xlink:')) state.usesXlink = true;
    out += ` ${kept[0]}="${escapeAttribute(kept[1])}"`;
  }
  return out;
}

function serializeStyle(node: Node, attrs: string, state: State): string {
  const css = cleanChars(textOf(node));
  if (!cssIsSafe(css)) {
    state.removed.add('style element');
    return '';
  }
  return `<style${attrs}>${escapeText(css)}</style>`;
}

function serializeElement(node: Node, depth: number, state: State): string {
  const tag = node.tagName ?? '';
  const attrs = keptAttributes(tag, node.attrs ?? [], state);
  if (tag === 'style') return serializeStyle(node, attrs, state);
  const inner = serializeChildren(node, depth + 1, state);
  return inner === ''
    ? `<${tag}${attrs}/>`
    : `<${tag}${attrs}>${inner}</${tag}>`;
}

/** Why an element does not stay, or null. */
function removalReason(node: Node): string | null {
  const tag = node.tagName ?? '';
  if (node.namespaceURI !== SVG_NS) return `element ${tag || node.nodeName}`;
  if (!ELEMENTS.has(tag)) return `element ${tag}`;
  if (ANIMATIONS.has(tag) && !animationIsSafe(node))
    return `element ${tag} (changes a link or handler)`;
  return null;
}

function serializeNode(node: Node, depth: number, state: State): string {
  state.count += 1;
  if (state.count > MAX_NODES || depth > MAX_DEPTH)
    throw new RangeError('The SVG is too deeply nested or too large');
  if (node.nodeName === '#text')
    return escapeText(cleanChars(node.value ?? ''));
  if (node.nodeName.startsWith('#')) return '';
  if (node.namespaceURI === SVG_NS && UNWRAPPED.has(node.tagName ?? ''))
    return serializeChildren(node, depth, state);
  const reason = removalReason(node);
  if (reason !== null) {
    state.removed.add(reason);
    return '';
  }
  return serializeElement(node, depth, state);
}

function serializeChildren(node: Node, depth: number, state: State): string {
  return (node.childNodes ?? [])
    .map((child) => serializeNode(child, depth, state))
    .join('');
}

/** The first `<svg>` of the file, or undefined. */
function rootOf(nodes: Node[]): Node | undefined {
  return nodes.find((n) => n.tagName === 'svg' && n.namespaceURI === SVG_NS);
}

const LENGTH = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/;

function size(value: string | undefined): number | null {
  const m = value === undefined ? null : LENGTH.exec(value);
  const n = m ? Math.round(Number(m[1])) : NaN;
  return n > 0 && n <= 20_000 ? n : null;
}

const MAX_SIZE = 20_000;

/** Width and height of a `viewBox`, or null when it is missing or empty. */
function viewBoxSize(value: string): { w: number; h: number } | null {
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , w = 0, h = 0] = parts;
  return parts.length === 4 && w > 0 && h > 0
    ? { w: Math.round(w), h: Math.round(h) }
    : null;
}

/** One given side decides, the other follows the proportions of the `viewBox`. */
function fitToView(
  width: number | null,
  height: number | null,
  view: { w: number; h: number },
): { width: number; height: number } {
  if (width) return { width, height: Math.round((width * view.h) / view.w) };
  if (height) return { width: Math.round((height * view.w) / view.h), height };
  return {
    width: Math.min(view.w, MAX_SIZE),
    height: Math.min(view.h, MAX_SIZE),
  };
}

/** Display size from `width`/`height`, else from the `viewBox`, else the browser default 300 x 150. */
function dimensionsOf(root: Node): { width: number; height: number } {
  const get = (name: string) =>
    (root.attrs ?? []).find((a) => a.name === name)?.value;
  const width = size(get('width'));
  const height = size(get('height'));
  if (width && height) return { width, height };
  const view = viewBoxSize(get('viewBox') ?? '');
  if (view) return fitToView(width, height, view);
  return { width: width ?? 300, height: height ?? 150 };
}

/** Root attributes of the cleaned file: the namespaces are set here, never taken from the file. */
const rootAttributes = (root: Node, state: State): string =>
  keptAttributes('svg', root.attrs ?? [], state);

/**
 * Cleans an SVG file. Fails with a reason when the file is not an SVG or is too
 * deeply nested; everything else dangerous is removed and listed in `removed`.
 */
export function sanitizeSvg(input: Buffer | string): SvgResult | SvgFailure {
  const text = typeof input === 'string' ? input : input.toString('utf8');
  let nodes: Node[];
  try {
    nodes = parseFragment(text).childNodes as unknown as Node[];
  } catch {
    return { ok: false, reason: 'File is not readable as SVG' };
  }
  const root = rootOf(nodes);
  if (!root) return { ok: false, reason: 'File is not an SVG image' };
  const state: State = { count: 0, removed: new Set(), usesXlink: false };
  let body: string;
  let attrs: string;
  try {
    body = serializeChildren(root, 1, state);
    attrs = rootAttributes(root, state);
  } catch (error) {
    if (error instanceof RangeError)
      return { ok: false, reason: error.message };
    throw error;
  }
  const xlink = state.usesXlink
    ? ' xmlns:xlink="http://www.w3.org/1999/xlink"'
    : '';
  const svg = `<svg xmlns="${SVG_NS}"${xlink}${attrs}>${body}</svg>\n`;
  return {
    ok: true,
    svg,
    ...dimensionsOf(root),
    removed: [...state.removed].sort(),
  };
}
