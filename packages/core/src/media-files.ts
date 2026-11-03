import { toSlug } from './slug.ts';

/**
 * Files that may be mirrored to the own domain in addition to images: PDF,
 * audio and video. Everything else (HTML, SVG, scripts, archives, programs) is
 * not accepted, because the server could otherwise serve it under the own
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

/** Does the start of the data match the expected file signature? */
export function sniffMatches(kind: Sniff, data: Buffer): boolean {
  switch (kind) {
    case 'pdf':
      return startsWith(data, '%PDF-');
    case 'mp3':
      return (
        startsWith(data, 'ID3') ||
        (data.length >= 2 &&
          data[0] === 0xff &&
          ((data[1] ?? 0) & 0xe0) === 0xe0)
      );
    case 'ogg':
      return startsWith(data, 'OggS');
    case 'wav':
      return startsWith(data, 'RIFF') && startsWith(data, 'WAVE', 8);
    case 'flac':
      return startsWith(data, 'fLaC');
    case 'mp4':
      return startsWith(data, 'ftyp', 4);
    case 'webm':
      return (
        data.length >= 4 &&
        data[0] === 0x1a &&
        data[1] === 0x45 &&
        data[2] === 0xdf &&
        data[3] === 0xa3
      );
  }
}

/** Content type of a served media file, by extension. Null for anything unknown. */
export function contentTypeForMediaFile(file: string): string | null {
  const ext = extensionOf(file);
  if (ext === 'webp') return 'image/webp';
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
