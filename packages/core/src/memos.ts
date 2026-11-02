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
import { processImage, toResolvedImage } from './media.ts';
import { renderMarkdown } from './render.ts';
import { normalizeTag } from './slug.ts';

/** Fehler beim Abruf der Memos-Instanz. Der Build bricht dann ab, die letzte gute Version bleibt online. */
export class MemosError extends Error {
  override name = 'MemosError';
}

export interface MemoAttachmentRaw {
  /** `attachments/<uid>` */
  name: string;
  filename: string;
  type: string;
  /** Die Memos-API liefert int64 als Text. */
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
  /** Gesetzt bei Kommentaren. */
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
  /** Alle öffentlichen Memos. Wirft MemosError, wenn die Instanz nicht (vollständig) lesbar ist. */
  listPublicMemos: () => Promise<{ memos: MemoRaw[]; warnings: string[] }>;
  /** Lädt die Datei eines Anhangs. Wirft MemosError bei vorübergehenden Fehlern. */
  fetchAttachment: (
    anhang: MemoAttachmentRaw,
    maxBytes: number,
  ) => Promise<FetchedAttachment>;
}

const MEMO_NAME = /^memos\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,34}[A-Za-z0-9])?)$/;
const ATTACHMENT_NAME = /^attachments\/([A-Za-z0-9][A-Za-z0-9_-]{0,63})$/;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

function parseAttachment(wert: unknown): MemoAttachmentRaw | null {
  if (!istObjekt(wert)) return null;
  if (
    typeof wert.name !== 'string' ||
    typeof wert.filename !== 'string' ||
    wert.filename === ''
  )
    return null;
  const anhang: MemoAttachmentRaw = {
    name: wert.name,
    filename: wert.filename,
    type: typeof wert.type === 'string' ? wert.type : '',
  };
  if (typeof wert.size === 'string' || typeof wert.size === 'number')
    anhang.size = wert.size;
  if (typeof wert.externalLink === 'string' && wert.externalLink !== '')
    anhang.externalLink = wert.externalLink;
  return anhang;
}

/** Prüft einen Eintrag der Memos-Antwort. Liefert null, wenn er unbrauchbar ist. */
function parseMemo(wert: unknown): MemoRaw | null {
  if (!istObjekt(wert)) return null;
  if (typeof wert.name !== 'string' || !MEMO_NAME.test(wert.name)) return null;
  if (typeof wert.content !== 'string') return null;
  const memo: MemoRaw = {
    name: wert.name,
    content: wert.content,
    visibility: typeof wert.visibility === 'string' ? wert.visibility : '',
    createTime: typeof wert.createTime === 'string' ? wert.createTime : '',
    tags: Array.isArray(wert.tags)
      ? wert.tags.filter((t): t is string => typeof t === 'string')
      : [],
    attachments: Array.isArray(wert.attachments)
      ? wert.attachments
          .map(parseAttachment)
          .filter((a): a is MemoAttachmentRaw => a !== null)
      : [],
  };
  if (typeof wert.state === 'string') memo.state = wert.state;
  if (typeof wert.parent === 'string' && wert.parent !== '')
    memo.parent = wert.parent;
  return memo;
}

function parseSeite(wert: unknown): {
  memos: MemoRaw[];
  warnings: string[];
  next: string;
} {
  if (!istObjekt(wert) || !Array.isArray(wert.memos)) {
    throw new MemosError(
      'Unerwartete Antwort der Memos-Instanz (Feld "memos" fehlt)',
    );
  }
  const memos: MemoRaw[] = [];
  const warnings: string[] = [];
  wert.memos.forEach((eintrag, index) => {
    const memo = parseMemo(eintrag);
    if (memo === null)
      warnings.push(
        `Eintrag ${index + 1} der Memos-Antwort ist unbrauchbar und wird übersprungen`,
      );
    else memos.push(memo);
  });
  const next = typeof wert.nextPageToken === 'string' ? wert.nextPageToken : '';
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
 * Liest öffentliche Memos über die REST-Schnittstelle (`/api/memos`) ohne Anmeldung.
 * Das setzt voraus, dass der Zugriffsmodus der Instanz auf PUBLIC steht.
 * Weiterleitungen werden nie befolgt.
 */
export function createHttpMemosSource(optionen: HttpMemosOptions): MemosSource {
  let basis: URL;
  try {
    basis = new URL(optionen.baseUrl);
  } catch {
    throw new MemosError(`Ungültige Memos-Adresse: ${optionen.baseUrl}`);
  }
  if (basis.protocol !== 'http:' && basis.protocol !== 'https:') {
    throw new MemosError(
      `Die Memos-Adresse muss mit http oder https beginnen: ${optionen.baseUrl}`,
    );
  }
  const wurzel = `${basis.origin}${basis.pathname.replace(/\/+$/, '')}`;
  const abruf = optionen.fetch ?? globalThis.fetch;
  const pageSize = optionen.pageSize ?? 100;
  const maxPages = optionen.maxPages ?? 1000;
  const timeoutMs = optionen.timeoutMs ?? 30_000;

  async function hole(url: string): Promise<Response> {
    try {
      return await abruf(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' },
      });
    } catch (fehler) {
      const grund = fehler instanceof Error ? fehler.message : String(fehler);
      throw new MemosError(`Memos nicht erreichbar (${grund})`);
    }
  }

  return {
    async listPublicMemos() {
      const memos: MemoRaw[] = [];
      const warnings: string[] = [];
      const gesehen = new Set<string>();
      let token = '';
      for (let seite = 0; seite < maxPages; seite += 1) {
        const url = new URL(`${wurzel}/api/memos`);
        url.searchParams.set('page_size', String(pageSize));
        url.searchParams.set('filter', 'visibility == "PUBLIC"');
        url.searchParams.set('order_by', 'create_time desc');
        if (token !== '') url.searchParams.set('page_token', token);

        const antwort = await hole(url.toString());
        if (antwort.status === 401 || antwort.status === 403) {
          throw new MemosError(
            'Die Memos-Instanz verlangt eine Anmeldung. Der Zugriffsmodus der Instanz muss PUBLIC sein.',
          );
        }
        if (antwort.status >= 300 && antwort.status < 400) {
          throw new MemosError(
            `Memos leitet weiter (HTTP ${antwort.status}), Weiterleitungen werden nicht befolgt`,
          );
        }
        if (!antwort.ok)
          throw new MemosError(`Memos antwortet mit HTTP ${antwort.status}`);

        let json: unknown;
        try {
          json = await antwort.json();
        } catch {
          throw new MemosError(
            'Die Antwort der Memos-Instanz ist kein gültiges JSON',
          );
        }
        const ergebnis = parseSeite(json);
        memos.push(...ergebnis.memos);
        warnings.push(...ergebnis.warnings);

        if (ergebnis.next === '') return { memos, warnings };
        if (gesehen.has(ergebnis.next))
          throw new MemosError('Memos liefert ein wiederholtes Seitentoken');
        gesehen.add(ergebnis.next);
        token = ergebnis.next;
      }
      throw new MemosError(`Memos liefert mehr als ${maxPages} Seiten`);
    },

    async fetchAttachment(anhang, maxBytes) {
      const treffer = ATTACHMENT_NAME.exec(anhang.name);
      if (treffer === null || anhang.filename === '') {
        return {
          ok: false,
          code: 'invalid',
          reason: `ungültiger Anhang "${anhang.name}"`,
        };
      }
      const url = `${wurzel}/file/attachments/${treffer[1]}/${encodeURIComponent(anhang.filename)}`;
      const antwort = await hole(url);

      if (antwort.status >= 300 && antwort.status < 400) {
        return {
          ok: false,
          code: 'redirect',
          reason: 'Memos leitet weiter, Weiterleitungen werden nicht befolgt',
        };
      }
      if (antwort.status === 404)
        return { ok: false, code: 'not-found', reason: 'Datei nicht gefunden' };
      if (antwort.status === 401 || antwort.status === 403) {
        throw new MemosError(
          `Zugriff auf den Anhang verweigert (HTTP ${antwort.status}), Zugriffsmodus prüfen`,
        );
      }
      if (!antwort.ok)
        throw new MemosError(
          `Memos antwortet beim Anhang mit HTTP ${antwort.status}`,
        );

      const laenge = Number(antwort.headers.get('content-length'));
      if (Number.isFinite(laenge) && laenge > maxBytes) {
        await antwort.body?.cancel();
        return {
          ok: false,
          code: 'too-large',
          reason: `größer als ${maxBytes} Bytes`,
        };
      }

      const teile: Buffer[] = [];
      let gesamt = 0;
      if (antwort.body) {
        const leser = antwort.body.getReader();
        try {
          for (;;) {
            const { done, value } = await leser.read();
            if (done) break;
            gesamt += value.byteLength;
            if (gesamt > maxBytes) {
              await leser.cancel();
              return {
                ok: false,
                code: 'too-large',
                reason: `größer als ${maxBytes} Bytes`,
              };
            }
            teile.push(Buffer.from(value));
          }
        } catch (fehler) {
          const grund =
            fehler instanceof Error ? fehler.message : String(fehler);
          throw new MemosError(`Anhang konnte nicht gelesen werden (${grund})`);
        }
      }
      return { ok: true, data: Buffer.concat(teile) };
    },
  };
}

/**
 * Quelle aus Dateien, für Entwicklung und Tests: `memos.json` in der Form der
 * Listen-Antwort und die Anhänge unter `attachments/<uid>/<dateiname>`.
 */
export function createFixtureMemosSource(ordner: string): MemosSource {
  return {
    async listPublicMemos() {
      let json: unknown;
      try {
        json = JSON.parse(
          await readFile(path.join(ordner, 'memos.json'), 'utf8'),
        );
      } catch (fehler) {
        const grund = fehler instanceof Error ? fehler.message : String(fehler);
        throw new MemosError(`memos.json nicht lesbar (${grund})`);
      }
      const { memos, warnings } = parseSeite(json);
      return { memos, warnings };
    },
    async fetchAttachment(anhang, maxBytes) {
      const treffer = ATTACHMENT_NAME.exec(anhang.name);
      if (
        treffer === null ||
        anhang.filename === '' ||
        /[\\/]/.test(anhang.filename) ||
        anhang.filename.startsWith('.')
      ) {
        return {
          ok: false,
          code: 'invalid',
          reason: `ungültiger Anhang "${anhang.name}"`,
        };
      }
      const datei = path.join(
        ordner,
        'attachments',
        treffer[1] ?? '',
        anhang.filename,
      );
      try {
        if ((await stat(datei)).size > maxBytes)
          return { ok: false, code: 'too-large', reason: 'zu groß' };
        return { ok: true, data: await readFile(datei) };
      } catch {
        return { ok: false, code: 'not-found', reason: 'Datei nicht gefunden' };
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
  /** Bereinigtes HTML des Textes samt gespiegelter Anhänge. */
  html: string;
}

const BILD_ENDUNGEN = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);
const DATUM_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
});

function maskiere(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatiereGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Kurzer Klartext aus Markdown, höchstens 160 Zeichen, an einer Wortgrenze gekürzt. */
function beschreibung(markdown: string): string {
  const baum = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const teile: string[] = [];
  visit(baum, (knoten) => {
    if (knoten.type === 'text' || knoten.type === 'inlineCode')
      teile.push((knoten as { value: string }).value);
  });
  const text = teile.join(' ').replace(/\s+/g, ' ').trim();
  if (text.length <= 160) return text;
  const gekuerzt = text.slice(0, 160);
  const ende = gekuerzt.lastIndexOf(' ');
  return `${(ende > 80 ? gekuerzt.slice(0, ende) : gekuerzt).trimEnd()}…`;
}

export interface BuildMemosOptions {
  /** Höchstgröße je gespiegelter Datei in Bytes. Standard: 25 MB. */
  maxFileBytes?: number;
  urlPrefix?: string;
}

function inhaltsKennung(daten: Buffer): string {
  return createHash('sha256').update(daten).digest('hex').slice(0, 16);
}

/**
 * Baut die Seitendaten aller öffentlichen Memos. Anhänge werden auf die eigene
 * Domain gespiegelt (Bilder als WebP ohne EXIF; PDF, Audio und Video nur mit
 * passender Dateikennung). Nichts verweist auf die Memos-Instanz.
 * Vorübergehende Fehler beim Abruf werfen und brechen den Build ab.
 */
export async function buildMemoEntries(
  quelle: MemosSource,
  speicher: Map<string, Buffer>,
  optionen: BuildMemosOptions = {},
): Promise<{ memos: MemoEntry[]; warnings: string[] }> {
  const maxBytes = optionen.maxFileBytes ?? MAX_FILE_BYTES;
  const prefix = optionen.urlPrefix ?? '/media/';
  const liste = await quelle.listPublicMemos();
  const warnings = [...liste.warnings];
  const eintraege: MemoEntry[] = [];

  for (const roh of liste.memos) {
    const treffer = MEMO_NAME.exec(roh.name);
    const uid = treffer?.[1];
    const warn = (meldung: string) =>
      warnings.push(`memos/${uid ?? roh.name}: ${meldung}`);
    if (uid === undefined) {
      warnings.push(`${roh.name}: ungültige Kennung, übersprungen`);
      continue;
    }
    if (roh.parent) continue;
    if (roh.visibility !== 'PUBLIC') {
      warn(`nicht öffentlich (${roh.visibility || 'unbekannt'}), übersprungen`);
      continue;
    }
    if (roh.state !== undefined && roh.state !== 'NORMAL') continue;
    const datum = new Date(roh.createTime);
    if (roh.createTime === '' || Number.isNaN(datum.getTime())) {
      warn(`ungültiges createTime "${roh.createTime}", übersprungen`);
      continue;
    }

    const alleTags: string[] = [];
    for (const tag of roh.tags ?? []) {
      const normal = normalizeTag(tag);
      if (normal !== null && !alleTags.includes(normal)) alleTags.push(normal);
    }
    // Memos erzeugt für "#a/b" selbst den Eltern-Tag "a". Ein verschachtelter Tag
    // bleibt hier ein einzelner Tag, also fallen solche Eltern-Tags weg.
    const tags = alleTags.filter(
      (tag) => !alleTags.some((anderer) => anderer.startsWith(`${tag}/`)),
    );

    const gerendert = await renderMarkdown(roh.content, {
      articlePath: `memos/${uid}.md`,
      remoteContent: 'none',
      resolveImage: async () => ({
        ok: false,
        code: 'unsupported',
        reason: 'Memos binden Bilder über Anhänge ein',
      }),
    });
    for (const w of gerendert.warnings) warnings.push(w);

    const anhaenge: string[] = [];
    for (const anhang of roh.attachments ?? []) {
      if (anhang.externalLink) {
        warn(`Anhang "${anhang.filename}" liegt extern und wird nicht geladen`);
        continue;
      }
      const ext =
        anhang.filename.split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase() ??
        '';
      const bildArt = BILD_ENDUNGEN.has(ext);
      const dateiRegel = allowedFileFor(anhang.filename);
      if (!bildArt && dateiRegel === null) {
        const hinweis =
          ext === 'heic' || ext === 'heif'
            ? ' (HEIC wird nicht unterstützt, bitte als JPEG hochladen)'
            : '';
        warn(
          `Anhang "${anhang.filename}" hat einen nicht erlaubten Dateityp und wird übersprungen${hinweis}`,
        );
        continue;
      }

      const geholt = await quelle.fetchAttachment(anhang, maxBytes);
      if (!geholt.ok) {
        warn(
          `Anhang "${anhang.filename}" wird übersprungen (${geholt.reason})`,
        );
        continue;
      }
      const daten = geholt.data;

      if (bildArt) {
        try {
          const bild = await processImage(daten);
          for (const v of bild.variants) speicher.set(v.file, v.data);
          const aufgeloest = toResolvedImage(bild, prefix);
          anhaenge.push(
            `<img src="${maskiere(aufgeloest.src)}" srcset="${maskiere(aufgeloest.srcset)}" sizes="(min-width: 760px) 720px, 100vw" ` +
              `width="${aufgeloest.width}" height="${aufgeloest.height}" alt="${maskiere(altTextFromFilename(anhang.filename))}" ` +
              `loading="lazy" decoding="async">`,
          );
        } catch {
          warn(
            `Anhang "${anhang.filename}" ist kein lesbares Bild und wird übersprungen`,
          );
        }
        continue;
      }

      if (dateiRegel === null || !sniffMatches(dateiRegel.sniff, daten)) {
        warn(
          `Anhang "${anhang.filename}" passt nicht zu seiner Endung und wird übersprungen`,
        );
        continue;
      }
      const dateiname = `${inhaltsKennung(daten)}-${safeFileName(anhang.filename)}`;
      speicher.set(dateiname, daten);
      const adresse = maskiere(`${prefix}${dateiname}`);
      const name = maskiere(anhang.filename);
      const link = `<a href="${adresse}" rel="noopener">${name}</a>`;
      if (dateiRegel.kind === 'audio') {
        anhaenge.push(
          `<audio controls preload="none" src="${adresse}">${link}</audio>`,
        );
      } else if (dateiRegel.kind === 'video') {
        anhaenge.push(
          `<video controls preload="none" playsinline src="${adresse}">${link}</video>`,
        );
      } else {
        anhaenge.push(
          `<p class="anhang">${link} (PDF, ${formatiereGroesse(daten.length)})</p>`,
        );
      }
    }

    const medien =
      anhaenge.length > 0
        ? `<div class="memo-anhaenge">${anhaenge.join('')}</div>`
        : '';
    eintraege.push({
      uid,
      path: `memos/${uid}`,
      title: `Memo vom ${DATUM_FORMAT.format(datum)}`,
      description: beschreibung(roh.content),
      date: datum,
      tags,
      html: gerendert.html + medien,
    });
  }

  eintraege.sort(
    (a, b) => b.date.getTime() - a.date.getTime() || (a.uid < b.uid ? -1 : 1),
  );
  return { memos: eintraege, warnings };
}
