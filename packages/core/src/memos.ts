import { DEFAULT_SETTINGS } from './config.ts';
import type { Language } from './config.ts';
import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import path from 'node:path';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import {
  allowedFileFor,
  altTextFromFilename,
  safeFileName,
  sniffMatches,
} from './media-files.ts';
import type { GlossaryLinking } from './glossary-links.ts';
import type { HeicConverter } from './heic.ts';
import { processImage, storeSvg, toResolvedImage } from './media.ts';
import { renderMarkdown } from './render.ts';
import { normalizeTag } from './slug.ts';

/** Error while reading the Memos instance. The build then stops, the last good version stays online. */
export class MemosError extends Error {
  override name = 'MemosError';
}

export interface MemoAttachmentRaw {
  /** `attachments/<uid>` */
  name: string;
  filename: string;
  type: string;
  /** The Memos API returns int64 as text. */
  size?: string | number;
  externalLink?: string;
}

export interface MemoRaw {
  /** `memos/<uid>` */
  name: string;
  content: string;
  visibility: string;
  state?: string;
  createTime: string;
  /** Last edit; missing for old Memos versions, then `createTime` counts. */
  updateTime?: string;
  tags?: string[];
  attachments?: MemoAttachmentRaw[];
  /** Set for comments. */
  parent?: string | null;
}

export type FetchedAttachment =
  | { ok: true; data: Buffer }
  | {
      ok: false;
      code: 'not-found' | 'too-large' | 'redirect' | 'invalid';
      reason: string;
    };

export interface MemosSource {
  /** All public memos. Throws MemosError if the instance cannot be read (completely). */
  listPublicMemos: () => Promise<{ memos: MemoRaw[]; warnings: string[] }>;
  /** Loads the file of an attachment. Throws MemosError on temporary errors. */
  fetchAttachment: (
    attachment: MemoAttachmentRaw,
    maxBytes: number,
  ) => Promise<FetchedAttachment>;
}

const MEMO_NAME = /^memos\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,34}[A-Za-z0-9])?)$/;
const ATTACHMENT_NAME = /^attachments\/([A-Za-z0-9][A-Za-z0-9_-]{0,63})$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAttachment(value: unknown): MemoAttachmentRaw | null {
  if (!isObject(value)) return null;
  if (
    typeof value.name !== 'string' ||
    typeof value.filename !== 'string' ||
    value.filename === ''
  )
    return null;
  const attachment: MemoAttachmentRaw = {
    name: value.name,
    filename: value.filename,
    type: typeof value.type === 'string' ? value.type : '',
  };
  if (typeof value.size === 'string' || typeof value.size === 'number')
    attachment.size = value.size;
  if (typeof value.externalLink === 'string' && value.externalLink !== '')
    attachment.externalLink = value.externalLink;
  return attachment;
}

const textOr = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((t): t is string => typeof t === 'string')
    : [];

const attachmentsOf = (value: unknown): MemoAttachmentRaw[] =>
  Array.isArray(value)
    ? value
        .map(parseAttachment)
        .filter((a): a is MemoAttachmentRaw => a !== null)
    : [];

/** Checks one entry of the Memos response. Returns null if it is unusable. */
function parseMemo(value: unknown): MemoRaw | null {
  if (!isObject(value)) return null;
  if (typeof value.name !== 'string' || !MEMO_NAME.test(value.name))
    return null;
  if (typeof value.content !== 'string') return null;
  const memo: MemoRaw = {
    name: value.name,
    content: value.content,
    visibility: textOr(value.visibility),
    createTime: textOr(value.createTime),
    tags: stringsOf(value.tags),
    attachments: attachmentsOf(value.attachments),
  };
  if (typeof value.state === 'string') memo.state = value.state;
  if (textOr(value.updateTime) !== '')
    memo.updateTime = value.updateTime as string;
  if (textOr(value.parent) !== '') memo.parent = value.parent as string;
  return memo;
}

function parsePage(value: unknown): {
  memos: MemoRaw[];
  warnings: string[];
  next: string;
} {
  if (!isObject(value) || !Array.isArray(value.memos)) {
    throw new MemosError(
      'Unexpected response from the Memos instance (field "memos" is missing)',
    );
  }
  const memos: MemoRaw[] = [];
  const warnings: string[] = [];
  value.memos.forEach((entry, index) => {
    const memo = parseMemo(entry);
    if (memo === null)
      warnings.push(
        `Entry ${index + 1} of the Memos response is unusable and is skipped`,
      );
    else memos.push(memo);
  });
  const next =
    typeof value.nextPageToken === 'string' ? value.nextPageToken : '';
  return { memos, warnings, next };
}

export interface HttpMemosOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  pageSize?: number;
  maxPages?: number;
  timeoutMs?: number;
}

/** The connection to one Memos instance. */
interface MemosConnection {
  root: string;
  request: (url: string) => Promise<Response>;
  pageSize: number;
  maxPages: number;
}

function memosRoot(baseUrl: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new MemosError(`Invalid Memos address: ${baseUrl}`);
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new MemosError(
      `The Memos address must start with http or https: ${baseUrl}`,
    );
  }
  return `${base.origin}${base.pathname.replace(/\/+$/, '')}`;
}

function memosRequest(doFetch: typeof fetch, timeoutMs: number) {
  return async (url: string): Promise<Response> => {
    try {
      return await doFetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' },
      });
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new MemosError(`Memos is unreachable (${cause})`);
    }
  };
}

function listUrl(conn: MemosConnection, token: string): string {
  const url = new URL(`${conn.root}/api/memos`);
  url.searchParams.set('page_size', String(conn.pageSize));
  url.searchParams.set('filter', 'visibility == "PUBLIC"');
  url.searchParams.set('order_by', 'create_time desc');
  if (token !== '') url.searchParams.set('page_token', token);
  return url.toString();
}

/** Throws for a login wall, a redirect or another error answer of the list. */
function checkListResponse(response: Response): void {
  if (response.status === 401 || response.status === 403) {
    throw new MemosError(
      'The Memos instance requires a login. The access mode of the instance must be PUBLIC.',
    );
  }
  if (response.status >= 300 && response.status < 400) {
    throw new MemosError(
      `Memos redirects (HTTP ${response.status}), redirects are not followed`,
    );
  }
  if (!response.ok)
    throw new MemosError(`Memos responds with HTTP ${response.status}`);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new MemosError(
      'The response of the Memos instance is not valid JSON',
    );
  }
}

async function listPublicMemos(
  conn: MemosConnection,
): Promise<{ memos: MemoRaw[]; warnings: string[] }> {
  const memos: MemoRaw[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let token = '';
  for (let pageIndex = 0; pageIndex < conn.maxPages; pageIndex += 1) {
    const response = await conn.request(listUrl(conn, token));
    checkListResponse(response);
    const result = parsePage(await readJson(response));
    memos.push(...result.memos);
    warnings.push(...result.warnings);
    if (result.next === '') return { memos, warnings };
    if (seen.has(result.next))
      throw new MemosError('Memos returns a repeated page token');
    seen.add(result.next);
    token = result.next;
  }
  throw new MemosError(`Memos returns more than ${conn.maxPages} pages`);
}

type AttachmentResult = Awaited<ReturnType<MemosSource['fetchAttachment']>>;

const tooLarge = (maxBytes: number): AttachmentResult => ({
  ok: false,
  code: 'too-large',
  reason: `larger than ${maxBytes} bytes`,
});

/** A result for an answer that carries no file, or undefined to read the body. */
function attachmentStatus(response: Response): AttachmentResult | undefined {
  if (response.status >= 300 && response.status < 400) {
    return {
      ok: false,
      code: 'redirect',
      reason: 'Memos redirects, redirects are not followed',
    };
  }
  if (response.status === 404)
    return { ok: false, code: 'not-found', reason: 'File not found' };
  if (response.status === 401 || response.status === 403) {
    throw new MemosError(
      `Access to the attachment was denied (HTTP ${response.status}), check the access mode`,
    );
  }
  if (!response.ok)
    throw new MemosError(
      `Memos responds to the attachment with HTTP ${response.status}`,
    );
  return undefined;
}

/** Reads a body up to `maxBytes`; null when it is larger. */
async function readLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks);
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new MemosError(`The attachment could not be read (${cause})`);
  }
}

async function fetchAttachment(
  conn: MemosConnection,
  attachment: MemoAttachmentRaw,
  maxBytes: number,
): Promise<AttachmentResult> {
  const match = ATTACHMENT_NAME.exec(attachment.name);
  if (match === null || attachment.filename === '') {
    return {
      ok: false,
      code: 'invalid',
      reason: `invalid attachment "${attachment.name}"`,
    };
  }
  const response = await conn.request(
    `${conn.root}/file/attachments/${match[1]}/${encodeURIComponent(attachment.filename)}`,
  );
  const status = attachmentStatus(response);
  if (status) return status;
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) {
    await response.body?.cancel();
    return tooLarge(maxBytes);
  }
  const data = await readLimited(response.body, maxBytes);
  return data === null ? tooLarge(maxBytes) : { ok: true, data };
}

/**
 * Reads public memos through the REST interface (`/api/memos`) without login.
 * This requires the access mode of the instance to be PUBLIC.
 * Redirects are never followed.
 */
export function createHttpMemosSource(options: HttpMemosOptions): MemosSource {
  const conn: MemosConnection = {
    root: memosRoot(options.baseUrl),
    request: memosRequest(
      options.fetch ?? globalThis.fetch,
      options.timeoutMs ?? DEFAULT_SETTINGS.memosTimeoutMs,
    ),
    pageSize: options.pageSize ?? 100,
    maxPages: options.maxPages ?? 1000,
  };
  return {
    listPublicMemos: () => listPublicMemos(conn),
    fetchAttachment: (attachment, maxBytes) =>
      fetchAttachment(conn, attachment, maxBytes),
  };
}

/** Reads a file of the sample set; the size is checked on the opened file. */
async function readFixtureFile(
  file: string,
  maxBytes: number,
): Promise<AttachmentResult> {
  let handle;
  try {
    handle = await open(file, 'r');
  } catch {
    return { ok: false, code: 'not-found', reason: 'File not found' };
  }
  try {
    if ((await handle.stat()).size > maxBytes)
      return { ok: false, code: 'too-large', reason: 'too large' };
    return { ok: true, data: await handle.readFile() };
  } catch {
    return { ok: false, code: 'not-found', reason: 'File not found' };
  } finally {
    await handle.close();
  }
}

/**
 * Source from files, for development and tests: `memos.json` in the shape of
 * the list response and the attachments under `attachments/<uid>/<file name>`.
 */
export function createFixtureMemosSource(folder: string): MemosSource {
  return {
    async listPublicMemos() {
      let json: unknown;
      try {
        json = JSON.parse(
          await readFile(path.join(folder, 'memos.json'), 'utf8'),
        );
      } catch (error) {
        const cause = error instanceof Error ? error.message : String(error);
        throw new MemosError(`memos.json is not readable (${cause})`);
      }
      const { memos, warnings } = parsePage(json);
      return { memos, warnings };
    },
    async fetchAttachment(attachment, maxBytes) {
      const match = ATTACHMENT_NAME.exec(attachment.name);
      if (
        match === null ||
        attachment.filename === '' ||
        /[\\/]/.test(attachment.filename) ||
        attachment.filename.startsWith('.')
      ) {
        return {
          ok: false,
          code: 'invalid',
          reason: `invalid attachment "${attachment.name}"`,
        };
      }
      const file = path.join(
        folder,
        'attachments',
        match[1] ?? '',
        attachment.filename,
      );
      return readFixtureFile(file, maxBytes);
    },
  };
}

export interface MemoEntry {
  uid: string;
  /** `memos/<uid>` */
  path: string;
  title: string;
  description: string;
  created: Date;
  updated: Date;
  tags: string[];
  /** Sanitized HTML of the text together with the mirrored attachments. */
  html: string;
}

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'avif',
  'svg',
]);
// Texts that end up in the pages. The rest of the UI lives in the message
// catalog of the site; these are built here because the memo entries are built
// here. Dates are shown in Berlin time.
const UI: Record<
  Language,
  { memoTitle: (date: string) => string; decimal: string; locale: string }
> = {
  en: {
    memoTitle: (date) => `Memo of ${date}`,
    decimal: '.',
    locale: 'en-GB',
  },
  de: {
    memoTitle: (date) => `Memo vom ${date}`,
    decimal: ',',
    locale: 'de-DE',
  },
};

function memoTitle(date: Date, lang: Language): string {
  const text = new Intl.DateTimeFormat(UI[lang].locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(date);
  return UI[lang].memoTitle(text);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSize(bytes: number, lang: Language): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', UI[lang].decimal)} MB`;
}

/** Short plain text from Markdown, at most `max` characters, cut at a word boundary. */
function makeDescription(markdown: string, max: number): string {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const chunks: string[] = [];
  visit(tree, (node) => {
    if (node.type === 'text' || node.type === 'inlineCode')
      chunks.push((node as { value: string }).value);
  });
  const text = chunks.join(' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf(' ');
  return `${(end > max / 2 ? cut.slice(0, end) : cut).trimEnd()}…`;
}

export interface BuildMemosOptions {
  /** Maximum size per mirrored file in bytes. Default: 25 MB. */
  maxFileBytes?: number;
  /** Maximum length of the description in characters. Default: 160. */
  descriptionChars?: number;
  urlPrefix?: string;
  /** Language of the generated texts (title, PDF label). Default: `en`. */
  lang?: Language;
  /** Turns HEIC photos into JPEG. Without it they are skipped with a hint. */
  convertHeic?: HeicConverter;
  /** Links glossary terms in the memo texts. */
  glossary?: GlossaryLinking;
}

function contentId(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/** What building the memo entries needs, shared by the helpers below. */
interface MemoBuild {
  source: MemosSource;
  store: Map<string, Buffer>;
  maxBytes: number;
  descriptionMax: number;
  prefix: string;
  lang: Language;
  convertHeic?: HeicConverter;
  glossary?: GlossaryLinking;
}

/** Uid and date of a memo that is shown, or null (with a warning where useful). */
/** Last edit of a memo; `createTime` when `updateTime` is missing or invalid. */
function updatedAtOf(
  raw: MemoRaw,
  createdAt: Date,
  warn: (text: string) => void,
): Date {
  if (raw.updateTime === undefined) return createdAt;
  const updatedAt = new Date(raw.updateTime);
  if (Number.isNaN(updatedAt.getTime())) {
    warn(`invalid updateTime "${raw.updateTime}", createTime is used`);
    return createdAt;
  }
  return updatedAt;
}

function memoIdentity(
  raw: MemoRaw,
  warnings: string[],
): { uid: string; createdAt: Date; updatedAt: Date } | null {
  const uid = MEMO_NAME.exec(raw.name)?.[1];
  if (uid === undefined) {
    warnings.push(`${raw.name}: invalid identifier, skipped`);
    return null;
  }
  const warn = (text: string) => warnings.push(`memos/${uid}: ${text}`);
  if (raw.parent) return null;
  if (raw.visibility !== 'PUBLIC') {
    warn(`not public (${raw.visibility || 'unknown'}), skipped`);
    return null;
  }
  if (raw.state !== undefined && raw.state !== 'NORMAL') return null;
  const createdAt = new Date(raw.createTime);
  if (raw.createTime === '' || Number.isNaN(createdAt.getTime())) {
    warn(`invalid createTime "${raw.createTime}", skipped`);
    return null;
  }
  return { uid, createdAt, updatedAt: updatedAtOf(raw, createdAt, warn) };
}

/**
 * Tags of a memo, normalized. Memos itself creates the parent tag "a" for
 * "#a/b". A nested tag stays a single tag here, so such parent tags are dropped.
 */
function memoTags(raw: string[] | undefined): string[] {
  const all: string[] = [];
  for (const tag of raw ?? []) {
    const normal = normalizeTag(tag);
    if (normal !== null && !all.includes(normal)) all.push(normal);
  }
  return all.filter((tag) => !all.some((other) => other.startsWith(`${tag}/`)));
}

function extensionOf(filename: string): string {
  return filename.split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase() ?? '';
}

/** An SVG attachment, cleaned, as one file in the store and an <img>; null if it is no SVG. */
function svgHtml(
  build: MemoBuild,
  attachment: MemoAttachmentRaw,
  data: Buffer,
): string | null {
  const svg = storeSvg(data, build.store, build.prefix);
  if (!svg.ok) return null;
  const { image } = svg;
  return (
    `<img src="${escapeHtml(image.src)}" width="${image.width}" height="${image.height}" ` +
    `alt="${escapeHtml(altTextFromFilename(attachment.filename))}" loading="lazy" decoding="async">`
  );
}

/** An image attachment as WebP variants in the store and an <img>; null if unreadable. */
async function imageHtml(
  build: MemoBuild,
  attachment: MemoAttachmentRaw,
  data: Buffer,
  heic: boolean,
): Promise<string | null> {
  try {
    if (extensionOf(attachment.filename) === 'svg')
      return svgHtml(build, attachment, data);
    const source =
      heic && build.convertHeic ? await build.convertHeic(data) : data;
    const image = await processImage(source);
    for (const v of image.variants) build.store.set(v.file, v.data);
    const resolved = toResolvedImage(image, build.prefix);
    return (
      `<img src="${escapeHtml(resolved.src)}" srcset="${escapeHtml(resolved.srcset)}" sizes="(min-width: 760px) 720px, 100vw" ` +
      `width="${resolved.width}" height="${resolved.height}" alt="${escapeHtml(altTextFromFilename(attachment.filename))}" ` +
      `loading="lazy" decoding="async">`
    );
  } catch {
    return null;
  }
}

/** A PDF, audio or video attachment in the store, as a player or a link. */
function fileHtml(
  build: MemoBuild,
  attachment: MemoAttachmentRaw,
  data: Buffer,
  kind: string,
): string {
  const storedName = `${contentId(data)}-${safeFileName(attachment.filename)}`;
  build.store.set(storedName, data);
  const address = escapeHtml(`${build.prefix}${storedName}`);
  const link = `<a href="${address}" rel="noopener">${escapeHtml(attachment.filename)}</a>`;
  if (kind === 'audio')
    return `<audio controls preload="none" src="${address}">${link}</audio>`;
  if (kind === 'video')
    return `<video controls preload="none" playsinline src="${address}">${link}</video>`;
  return `<p class="attachment">${link} (PDF, ${formatSize(data.length, build.lang)})</p>`;
}

/** The kind of an attachment by its name, or a reason why it is skipped. */
function attachmentKind(
  build: MemoBuild,
  attachment: MemoAttachmentRaw,
):
  | { image: boolean; heic: boolean; rule: ReturnType<typeof allowedFileFor> }
  | string {
  if (attachment.externalLink) return 'is external and is not loaded';
  const ext = extensionOf(attachment.filename);
  const heic = ext === 'heic' || ext === 'heif';
  const image =
    IMAGE_EXTENSIONS.has(ext) || (heic && build.convertHeic !== undefined);
  const rule = allowedFileFor(attachment.filename);
  if (image || rule !== null) return { image, heic, rule };
  const hint = heic
    ? ' (HEIC photos need the converter heif-convert, which is not available: please upload as JPEG)'
    : '';
  return `has a file type that is not allowed and is skipped${hint}`;
}

/** The HTML of one attachment, or null with a warning. */
async function attachmentHtml(
  build: MemoBuild,
  attachment: MemoAttachmentRaw,
  warn: (text: string) => void,
): Promise<string | null> {
  const skip = (why: string) => {
    warn(`attachment "${attachment.filename}" ${why}`);
    return null;
  };
  const kind = attachmentKind(build, attachment);
  if (typeof kind === 'string') return skip(kind);
  const fetched = await build.source.fetchAttachment(
    attachment,
    build.maxBytes,
  );
  if (!fetched.ok) return skip(`is skipped (${fetched.reason})`);
  if (kind.image) {
    const html = await imageHtml(build, attachment, fetched.data, kind.heic);
    return html ?? skip('is not a readable image and is skipped');
  }
  if (kind.rule === null || !sniffMatches(kind.rule.sniff, fetched.data))
    return skip('does not match its extension and is skipped');
  return fileHtml(build, attachment, fetched.data, kind.rule.kind);
}

/** The page data of one memo, or null when it is not shown. */
async function buildEntry(
  build: MemoBuild,
  raw: MemoRaw,
  warnings: string[],
): Promise<MemoEntry | null> {
  const id = memoIdentity(raw, warnings);
  if (!id) return null;
  const warn = (text: string) => warnings.push(`memos/${id.uid}: ${text}`);
  const rendered = await renderMarkdown(raw.content, {
    articlePath: `memos/${id.uid}.md`,
    remoteContent: 'none',
    lang: build.lang,
    glossary: build.glossary,
    resolveImage: async () => ({
      ok: false,
      code: 'unsupported',
      reason: 'Memos embed images through attachments',
    }),
  });
  warnings.push(...rendered.warnings);
  const attachments: string[] = [];
  for (const attachment of raw.attachments ?? []) {
    const html = await attachmentHtml(build, attachment, warn);
    if (html !== null) attachments.push(html);
  }
  const media =
    attachments.length > 0
      ? `<div class="memo-attachments">${attachments.join('')}</div>`
      : '';
  return {
    uid: id.uid,
    path: `memos/${id.uid}`,
    title: memoTitle(id.createdAt, build.lang),
    description: makeDescription(raw.content, build.descriptionMax),
    created: id.createdAt,
    updated: id.updatedAt,
    tags: memoTags(raw.tags),
    html: rendered.html + media,
  };
}

/**
 * Builds the page data of all public memos. Attachments are mirrored to the
 * own domain (images as WebP without EXIF; PDF, audio and video only with a
 * matching file signature). Nothing points to the Memos instance.
 * Temporary errors while reading throw and stop the build.
 */
export async function buildMemoEntries(
  source: MemosSource,
  store: Map<string, Buffer>,
  options: BuildMemosOptions = {},
): Promise<{ memos: MemoEntry[]; warnings: string[] }> {
  const build: MemoBuild = {
    source,
    store,
    maxBytes: options.maxFileBytes ?? DEFAULT_SETTINGS.memosMaxFileBytes,
    descriptionMax:
      options.descriptionChars ?? DEFAULT_SETTINGS.memosDescriptionChars,
    prefix: options.urlPrefix ?? '/media/',
    lang: options.lang ?? DEFAULT_SETTINGS.lang,
    convertHeic: options.convertHeic,
    glossary: options.glossary,
  };
  const list = await source.listPublicMemos();
  const warnings = [...list.warnings];
  const entries: MemoEntry[] = [];
  for (const raw of list.memos) {
    const entry = await buildEntry(build, raw, warnings);
    if (entry) entries.push(entry);
  }
  entries.sort(
    (a, b) =>
      b.created.getTime() - a.created.getTime() || (a.uid < b.uid ? -1 : 1),
  );
  return { memos: entries, warnings };
}

/**
 * Stable summary of the public memos: it changes when a memo is added, removed
 * or edited (text, date, tags, attachments by name and size). The builder
 * compares it between checks to know when to build.
 */
export function memosFingerprint(memos: readonly MemoRaw[]): string {
  const lines = memos
    .map((m) =>
      JSON.stringify([
        m.name,
        m.createTime,
        m.updateTime ?? '',
        m.content,
        [...(m.tags ?? [])].sort(),
        (m.attachments ?? [])
          .map((a) => [a.name, a.filename, a.type, String(a.size ?? '')])
          .sort(),
      ]),
    )
    .sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}
