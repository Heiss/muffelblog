import { toSlug } from './slug.ts';

/**
 * Dateien, die zusätzlich zu Bildern auf die eigene Domain gespiegelt werden
 * dürfen: PDF, Audio und Video. Alles andere (HTML, SVG, Skripte, Archive,
 * Programme) wird nicht übernommen, weil der Server sie sonst unter der eigenen
 * Adresse mit einem aktiven Inhaltstyp ausliefern könnte.
 */
export type FileKind = 'pdf' | 'audio' | 'video';
export type Sniff = 'pdf' | 'mp3' | 'ogg' | 'wav' | 'flac' | 'mp4' | 'webm';

export interface AllowedFile {
  ext: string;
  kind: FileKind;
  contentType: string;
  /** Welche Dateikennung am Anfang der Daten stehen muss. */
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

function endung(dateiname: string): string {
  const basis = dateiname.split(/[\\/]/).pop() ?? '';
  const treffer = /\.([^.]+)$/.exec(basis);
  return treffer?.[1]?.toLowerCase() ?? '';
}

/** Regel für eine erlaubte Datei, nach Endung. Null, wenn der Typ nicht erlaubt ist. */
export function allowedFileFor(dateiname: string): AllowedFile | null {
  const ext = endung(dateiname);
  return ALLOWED_FILES.find((regel) => regel.ext === ext) ?? null;
}

function beginntMit(daten: Buffer, text: string, offset = 0): boolean {
  return (
    daten.subarray(offset, offset + text.length).toString('latin1') === text
  );
}

/** Passt der Anfang der Daten zur erwarteten Dateikennung? */
export function sniffMatches(art: Sniff, daten: Buffer): boolean {
  switch (art) {
    case 'pdf':
      return beginntMit(daten, '%PDF-');
    case 'mp3':
      return (
        beginntMit(daten, 'ID3') ||
        (daten.length >= 2 &&
          daten[0] === 0xff &&
          ((daten[1] ?? 0) & 0xe0) === 0xe0)
      );
    case 'ogg':
      return beginntMit(daten, 'OggS');
    case 'wav':
      return beginntMit(daten, 'RIFF') && beginntMit(daten, 'WAVE', 8);
    case 'flac':
      return beginntMit(daten, 'fLaC');
    case 'mp4':
      return beginntMit(daten, 'ftyp', 4);
    case 'webm':
      return (
        daten.length >= 4 &&
        daten[0] === 0x1a &&
        daten[1] === 0x45 &&
        daten[2] === 0xdf &&
        daten[3] === 0xa3
      );
  }
}

/** Inhaltstyp einer ausgelieferten Mediendatei nach Endung. Null für alles Unbekannte. */
export function contentTypeForMediaFile(datei: string): string | null {
  const ext = endung(datei);
  if (ext === 'webp') return 'image/webp';
  return ALLOWED_FILES.find((regel) => regel.ext === ext)?.contentType ?? null;
}

/** Macht aus einem Dateinamen einen URL-tauglichen Namen, die Endung bleibt erhalten. */
export function safeFileName(dateiname: string): string {
  const basis = dateiname.split(/[\\/]/).pop() ?? '';
  const treffer = /\.([^.]+)$/.exec(basis);
  const ext = (treffer?.[1] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const stamm = treffer ? basis.slice(0, treffer.index) : basis;
  const name =
    (toSlug(stamm) ?? 'datei').slice(0, 50).replace(/-+$/, '') || 'datei';
  return ext === '' ? name : `${name}.${ext}`;
}

/** Alt-Text aus dem Dateinamen: ohne Endung, Unter- und Bindestriche werden Leerzeichen. */
export function altTextFromFilename(dateiname: string): string {
  const basis = (dateiname.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '');
  return basis
    .normalize('NFC')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
