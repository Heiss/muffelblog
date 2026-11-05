import { DEFAULT_SETTINGS } from './config.ts';
import type { Language } from './config.ts';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
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
import type { HeicConverter } from './heic.ts';
import { processImage, toResolvedImage } from './media.ts';
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

/** Checks one entry of the Memos response. Returns null if it is unusable. */
function parseMemo(value: unknown): MemoRaw | null {
  if (!isObject(value)) return null;
  if (typeof value.name !== 'string' || !MEMO_NAME.test(value.name))
    return null;
  if (typeof value.content !== 'string') return null;
  const memo: MemoRaw = {
    name: value.name,
    content: value.content,
    visibility: typeof value.visibility === 'string' ? value.visibility : '',
    createTime: typeof value.createTime === 'string' ? value.createTime : '',
    tags: Array.isArray(value.tags)
      ? value.tags.filter((t): t is string => typeof t === 'string')
      : [],
    attachments: Array.isArray(value.attachments)
      ? value.attachments
          .map(parseAttachment)
          .filter((a): a is MemoAttachmentRaw => a !== null)
      : [],
  };
  if (typeof value.state === 'string') memo.state = value.state;
  if (typeof value.parent === 'string' && value.parent !== '')
    memo.parent = value.parent;
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

/**
 * Reads public memos through the REST interface (`/api/memos`) without login.
 * This requires the access mode of the instance to be PUBLIC.
 * Redirects are never followed.
 */
export function createHttpMemosSource(options: HttpMemosOptions): MemosSource {
  let base: URL;
  try {
    base = new URL(options.baseUrl);
  } catch {
    throw new MemosError(`Invalid Memos address: ${options.baseUrl}`);
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new MemosError(
      `The Memos address must start with http or https: ${options.baseUrl}`,
    );
  }
  const root = `${base.origin}${base.pathname.replace(/\/+$/, '')}`;
  const doFetch = options.fetch ?? globalThis.fetch;
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 1000;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SETTINGS.memosTimeoutMs;

  async function request(url: string): Promise<Response> {
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
  }

  return {
    async listPublicMemos() {
      const memos: MemoRaw[] = [];
      const warnings: string[] = [];
      const seen = new Set<string>();
      let token = '';
      for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        const url = new URL(`${root}/api/memos`);
        url.searchParams.set('page_size', String(pageSize));
        url.searchParams.set('filter', 'visibility == "PUBLIC"');
        url.searchParams.set('order_by', 'create_time desc');
        if (token !== '') url.searchParams.set('page_token', token);

        const response = await request(url.toString());
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

        let json: unknown;
        try {
          json = await response.json();
        } catch {
          throw new MemosError(
            'The response of the Memos instance is not valid JSON',
          );
        }
        const result = parsePage(json);
        memos.push(...result.memos);
        warnings.push(...result.warnings);

        if (result.next === '') return { memos, warnings };
        if (seen.has(result.next))
          throw new MemosError('Memos returns a repeated page token');
        seen.add(result.next);
        token = result.next;
      }
      throw new MemosError(`Memos returns more than ${maxPages} pages`);
    },

    async fetchAttachment(attachment, maxBytes) {
      const match = ATTACHMENT_NAME.exec(attachment.name);
      if (match === null || attachment.filename === '') {
        return {
          ok: false,
          code: 'invalid',
          reason: `invalid attachment "${attachment.name}"`,
        };
      }
      const url = `${root}/file/attachments/${match[1]}/${encodeURIComponent(attachment.filename)}`;
      const response = await request(url);

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

      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > maxBytes) {
        await response.body?.cancel();
        return {
          ok: false,
          code: 'too-large',
          reason: `larger than ${maxBytes} bytes`,
        };
      }

      const chunks: Buffer[] = [];
      let total = 0;
      if (response.body) {
        const reader = response.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maxBytes) {
              await reader.cancel();
              return {
                ok: false,
                code: 'too-large',
                reason: `larger than ${maxBytes} bytes`,
              };
            }
            chunks.push(Buffer.from(value));
          }
        } catch (error) {
          const cause = error instanceof Error ? error.message : String(error);
          throw new MemosError(`The attachment could not be read (${cause})`);
        }
      }
      return { ok: true, data: Buffer.concat(chunks) };
    },
  };
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
      try {
        if ((await stat(file)).size > maxBytes)
          return { ok: false, code: 'too-large', reason: 'too large' };
        return { ok: true, data: await readFile(file) };
      } catch {
        return { ok: false, code: 'not-found', reason: 'File not found' };
      }
    },
  };
}

export interface MemoEntry {
  uid: string;
  /** `memos/<uid>` */
  path: string;
  title: string;
  description: string;
  date: Date;
  tags: string[];
  /** Sanitized HTML of the text together with the mirrored attachments. */
  html: string;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);
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
}

function contentId(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
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
  const maxBytes = options.maxFileBytes ?? DEFAULT_SETTINGS.memosMaxFileBytes;
  const descriptionMax =
    options.descriptionChars ?? DEFAULT_SETTINGS.memosDescriptionChars;
  const prefix = options.urlPrefix ?? '/media/';
  const lang = options.lang ?? DEFAULT_SETTINGS.lang;
  const list = await source.listPublicMemos();
  const warnings = [...list.warnings];
  const entries: MemoEntry[] = [];

  for (const raw of list.memos) {
    const match = MEMO_NAME.exec(raw.name);
    const uid = match?.[1];
    const warn = (meldung: string) =>
      warnings.push(`memos/${uid ?? raw.name}: ${meldung}`);
    if (uid === undefined) {
      warnings.push(`${raw.name}: invalid identifier, skipped`);
      continue;
    }
    if (raw.parent) continue;
    if (raw.visibility !== 'PUBLIC') {
      warn(`not public (${raw.visibility || 'unknown'}), skipped`);
      continue;
    }
    if (raw.state !== undefined && raw.state !== 'NORMAL') continue;
    const createdAt = new Date(raw.createTime);
    if (raw.createTime === '' || Number.isNaN(createdAt.getTime())) {
      warn(`invalid createTime "${raw.createTime}", skipped`);
      continue;
    }

    const allTags: string[] = [];
    for (const tag of raw.tags ?? []) {
      const normal = normalizeTag(tag);
      if (normal !== null && !allTags.includes(normal)) allTags.push(normal);
    }
    // Memos itself creates the parent tag "a" for "#a/b". A nested tag stays a
    // single tag here, so such parent tags are dropped.
    const tags = allTags.filter(
      (tag) => !allTags.some((other) => other.startsWith(`${tag}/`)),
    );

    const rendered = await renderMarkdown(raw.content, {
      articlePath: `memos/${uid}.md`,
      remoteContent: 'none',
      lang,
      resolveImage: async () => ({
        ok: false,
        code: 'unsupported',
        reason: 'Memos embed images through attachments',
      }),
    });
    for (const w of rendered.warnings) warnings.push(w);

    const attachments: string[] = [];
    for (const attachment of raw.attachments ?? []) {
      if (attachment.externalLink) {
        warn(
          `attachment "${attachment.filename}" is external and is not loaded`,
        );
        continue;
      }
      const ext =
        attachment.filename
          .split(/[\\/]/)
          .pop()
          ?.split('.')
          .pop()
          ?.toLowerCase() ?? '';
      const heicName = ext === 'heic' || ext === 'heif';
      const isImage =
        IMAGE_EXTENSIONS.has(ext) ||
        (heicName && options.convertHeic !== undefined);
      const fileRule = allowedFileFor(attachment.filename);
      if (!isImage && fileRule === null) {
        const hint = heicName
          ? ' (HEIC photos need the converter heif-convert, which is not available: please upload as JPEG)'
          : '';
        warn(
          `attachment "${attachment.filename}" has a file type that is not allowed and is skipped${hint}`,
        );
        continue;
      }

      const fetched = await source.fetchAttachment(attachment, maxBytes);
      if (!fetched.ok) {
        warn(
          `attachment "${attachment.filename}" is skipped (${fetched.reason})`,
        );
        continue;
      }
      const data = fetched.data;

      if (isImage) {
        try {
          const source =
            heicName && options.convertHeic
              ? await options.convertHeic(data)
              : data;
          const image = await processImage(source);
          for (const v of image.variants) store.set(v.file, v.data);
          const resolved = toResolvedImage(image, prefix);
          attachments.push(
            `<img src="${escapeHtml(resolved.src)}" srcset="${escapeHtml(resolved.srcset)}" sizes="(min-width: 760px) 720px, 100vw" ` +
              `width="${resolved.width}" height="${resolved.height}" alt="${escapeHtml(altTextFromFilename(attachment.filename))}" ` +
              `loading="lazy" decoding="async">`,
          );
        } catch {
          warn(
            `attachment "${attachment.filename}" is not a readable image and is skipped`,
          );
        }
        continue;
      }

      if (fileRule === null || !sniffMatches(fileRule.sniff, data)) {
        warn(
          `attachment "${attachment.filename}" does not match its extension and is skipped`,
        );
        continue;
      }
      const storedName = `${contentId(data)}-${safeFileName(attachment.filename)}`;
      store.set(storedName, data);
      const address = escapeHtml(`${prefix}${storedName}`);
      const name = escapeHtml(attachment.filename);
      const link = `<a href="${address}" rel="noopener">${name}</a>`;
      if (fileRule.kind === 'audio') {
        attachments.push(
          `<audio controls preload="none" src="${address}">${link}</audio>`,
        );
      } else if (fileRule.kind === 'video') {
        attachments.push(
          `<video controls preload="none" playsinline src="${address}">${link}</video>`,
        );
      } else {
        attachments.push(
          `<p class="attachment">${link} (PDF, ${formatSize(data.length, lang)})</p>`,
        );
      }
    }

    const media =
      attachments.length > 0
        ? `<div class="memo-attachments">${attachments.join('')}</div>`
        : '';
    entries.push({
      uid,
      path: `memos/${uid}`,
      title: memoTitle(createdAt, lang),
      description: makeDescription(raw.content, descriptionMax),
      date: createdAt,
      tags,
      html: rendered.html + media,
    });
  }

  entries.sort(
    (a, b) => b.date.getTime() - a.date.getTime() || (a.uid < b.uid ? -1 : 1),
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
