import { toSlug } from './slug.ts';

/**
 * Files that may be mirrored to the own domain in addition to images: PDF,
 * audio and video. SVG images are a special case: they are cleaned first (see
 * `svg.ts`). Everything else (HTML, scripts, archives, programs) is not accepted, because the server could otherwise serve it under the own
 * address with an active content type.
 */
export type FileKind = 'pdf' | 'audio' | 'video';
export type Sniff = 'pdf' | 'mp3' | 'ogg' | 'wav' | 'flac' | 'mp4' | 'webm';

export interface AllowedFile {
  ext: string;
  kind: FileKind;
  contentType: string;
  /** Which file signature must be at the start of the data. */
  sniff: Sniff;
}

export const ALLOWED_FILES: readonly AllowedFile[] = [
  { ext: 'pdf', kind: 'pdf', contentType: 'application/pdf', sniff: 'pdf' },
  { ext: 'mp3', kind: 'audio', contentType: 'audio/mpeg', sniff: 'mp3' },
  { ext: 'm4a', kind: 'audio', contentType: 'audio/mp4', sniff: 'mp4' },
  { ext: 'ogg', kind: 'audio', contentType: 'audio/ogg', sniff: 'ogg' },
  { ext: 'opus', kind: 'audio', contentType: 'audio/ogg', sniff: 'ogg' },
  { ext: 'wav', kind: 'audio', contentType: 'audio/wav', sniff: 'wav' },
  { ext: 'flac', kind: 'audio', contentType: 'audio/flac', sniff: 'flac' },
  { ext: 'mp4', kind: 'video', contentType: 'video/mp4', sniff: 'mp4' },
  { ext: 'm4v', kind: 'video', contentType: 'video/mp4', sniff: 'mp4' },
  { ext: 'webm', kind: 'video', contentType: 'video/webm', sniff: 'webm' },
  { ext: 'mov', kind: 'video', contentType: 'video/quicktime', sniff: 'mp4' },
];

function extensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const match = /\.([^.]+)$/.exec(base);
  return match?.[1]?.toLowerCase() ?? '';
}

/** Rule for an allowed file, by extension. Null if the type is not allowed. */
export function allowedFileFor(fileName: string): AllowedFile | null {
  const ext = extensionOf(fileName);
  return ALLOWED_FILES.find((rule) => rule.ext === ext) ?? null;
}

function startsWith(data: Buffer, text: string, offset = 0): boolean {
  return (
    data.subarray(offset, offset + text.length).toString('latin1') === text
  );
}

const hasBytes = (data: Buffer, bytes: number[]) =>
  bytes.every((b, i) => data[i] === b);

/** MP3: an ID3 tag or an MPEG frame sync at the start. */
const isMp3 = (data: Buffer) =>
  startsWith(data, 'ID3') ||
  (data.length >= 2 && data[0] === 0xff && ((data[1] ?? 0) & 0xe0) === 0xe0);

const SIGNATURES: Record<Sniff, (data: Buffer) => boolean> = {
  pdf: (d) => startsWith(d, '%PDF-'),
  mp3: isMp3,
  ogg: (d) => startsWith(d, 'OggS'),
  wav: (d) => startsWith(d, 'RIFF') && startsWith(d, 'WAVE', 8),
  flac: (d) => startsWith(d, 'fLaC'),
  mp4: (d) => startsWith(d, 'ftyp', 4),
  webm: (d) => hasBytes(d, [0x1a, 0x45, 0xdf, 0xa3]),
};

/** Does the start of the data match the expected file signature? */
export function sniffMatches(kind: Sniff, data: Buffer): boolean {
  return SIGNATURES[kind](data);
}

/** Content type of a served media file, by extension. Null for anything unknown. */
export function contentTypeForMediaFile(file: string): string | null {
  const ext = extensionOf(file);
  if (ext === 'webp') return 'image/webp';
  // Cleaned by `sanitizeSvg` and shown only through <img>.
  if (ext === 'svg') return 'image/svg+xml';
  return ALLOWED_FILES.find((rule) => rule.ext === ext)?.contentType ?? null;
}

/** Turns a file name into a URL-safe name, the extension is kept. */
export function safeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const match = /\.([^.]+)$/.exec(base);
  const ext = (match?.[1] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const stem = match ? base.slice(0, match.index) : base;
  const name =
    (toSlug(stem) ?? 'file').slice(0, 50).replace(/-+$/, '') || 'file';
  return ext === '' ? name : `${name}.${ext}`;
}

/** Alt text from the file name: without extension, underscores and hyphens become spaces. */
export function altTextFromFilename(fileName: string): string {
  const base = (fileName.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '');
  return base
    .normalize('NFC')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
