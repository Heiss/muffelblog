import { describe, expect, it } from 'vitest';
import {
  ALLOWED_FILES,
  allowedFileFor,
  altTextFromFilename,
  contentTypeForMediaFile,
  safeFileName,
  sniffMatches,
} from './media-files.ts';

const bytes = (...werte: Array<number | string>): Buffer =>
  Buffer.concat(
    werte.map((w) =>
      typeof w === 'number' ? Buffer.from([w]) : Buffer.from(w, 'latin1'),
    ),
  );

describe('allowedFileFor', () => {
  it('erlaubt PDF, Audio und Video nach Endung, unabhängig von Groß-/Kleinschreibung', () => {
    expect(allowedFileFor('Bericht.PDF')?.kind).toBe('pdf');
    expect(allowedFileFor('lied.mp3')?.kind).toBe('audio');
    expect(allowedFileFor('lied.m4a')?.kind).toBe('audio');
    expect(allowedFileFor('lied.ogg')?.kind).toBe('audio');
    expect(allowedFileFor('lied.opus')?.kind).toBe('audio');
    expect(allowedFileFor('lied.wav')?.kind).toBe('audio');
    expect(allowedFileFor('lied.flac')?.kind).toBe('audio');
    expect(allowedFileFor('film.mp4')?.kind).toBe('video');
    expect(allowedFileFor('film.webm')?.kind).toBe('video');
    expect(allowedFileFor('film.mov')?.kind).toBe('video');
  });

  it('lehnt alles andere ab', () => {
    for (const name of [
      'a.html',
      'a.htm',
      'a.svg',
      'a.js',
      'a.zip',
      'a.exe',
      'a.txt',
      'a.docx',
      'a.heic',
      'a',
      'a.pdf.html',
    ]) {
      expect(allowedFileFor(name)).toBeNull();
    }
  });

  it('führt für jede Endung einen Inhaltstyp', () => {
    for (const regel of ALLOWED_FILES)
      expect(regel.contentType).toMatch(/^(application|audio|video)\//);
  });
});

describe('sniffMatches', () => {
  it('erkennt die erlaubten Dateikennungen', () => {
    expect(sniffMatches('pdf', bytes('%PDF-1.7\n'))).toBe(true);
    expect(sniffMatches('mp3', bytes('ID3', 4, 0))).toBe(true);
    expect(sniffMatches('mp3', bytes(0xff, 0xfb, 0x90, 0x00))).toBe(true);
    expect(sniffMatches('ogg', bytes('OggS', 0))).toBe(true);
    expect(sniffMatches('wav', bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt '))).toBe(
      true,
    );
    expect(sniffMatches('flac', bytes('fLaC', 0))).toBe(true);
    expect(sniffMatches('mp4', bytes(0, 0, 0, 0x18, 'ftypisom'))).toBe(true);
    expect(sniffMatches('webm', bytes(0x1a, 0x45, 0xdf, 0xa3, 0x00))).toBe(
      true,
    );
  });

  it('lehnt HTML und andere Daten ab', () => {
    for (const art of [
      'pdf',
      'mp3',
      'ogg',
      'wav',
      'flac',
      'mp4',
      'webm',
    ] as const) {
      expect(
        sniffMatches(art, bytes('<!doctype html><script>alert(1)</script>')),
      ).toBe(false);
      expect(sniffMatches(art, bytes(''))).toBe(false);
    }
    expect(sniffMatches('wav', bytes('RIFF', 0, 0, 0, 0, 'AVI LIST'))).toBe(
      false,
    );
  });
});

describe('contentTypeForMediaFile', () => {
  it('liefert den Typ nach Endung, auch für WebP-Bilder', () => {
    expect(contentTypeForMediaFile('abc-960.webp')).toBe('image/webp');
    expect(contentTypeForMediaFile('abc-bericht.pdf')).toBe('application/pdf');
    expect(contentTypeForMediaFile('abc-lied.mp3')).toBe('audio/mpeg');
    expect(contentTypeForMediaFile('abc-film.mp4')).toBe('video/mp4');
  });

  it('liefert null für alles andere', () => {
    expect(contentTypeForMediaFile('x.html')).toBeNull();
    expect(contentTypeForMediaFile('x')).toBeNull();
  });
});

describe('safeFileName', () => {
  it('macht Dateinamen klein und URL-tauglich und behält die Endung', () => {
    expect(safeFileName('Mein Bericht (final).PDF')).toBe(
      'mein-bericht-final.pdf',
    );
    expect(safeFileName('Größe & Maße.mp3')).toBe('groesse-masse.mp3');
  });

  it('entfernt Pfadanteile und gefährliche Zeichen', () => {
    expect(safeFileName('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(safeFileName('<script>alert(1)</script>.pdf')).toBe('script.pdf');
    expect(safeFileName('<b>x.pdf')).toBe('b-x.pdf');
    expect(safeFileName('a\\b.pdf')).toBe('b.pdf');
  });

  it('kürzt lange Namen und fällt bei leerem Namen auf "datei" zurück', () => {
    expect(safeFileName(`${'a'.repeat(200)}.pdf`).length).toBeLessThanOrEqual(
      64,
    );
    expect(safeFileName('日本語.pdf')).toBe('datei.pdf');
    expect(safeFileName('.pdf')).toBe('datei.pdf');
  });
});

describe('altTextFromFilename', () => {
  it('nimmt den Dateinamen ohne Endung, Unter- und Bindestriche werden Leerzeichen', () => {
    expect(altTextFromFilename('IMG_2043.jpg')).toBe('IMG 2043');
    expect(altTextFromFilename('Bücherregal-Lesesaal.PNG')).toBe(
      'Bücherregal Lesesaal',
    );
    expect(altTextFromFilename('foto.final.jpeg')).toBe('foto.final');
  });

  it('liefert einen leeren Text, wenn nichts übrig bleibt', () => {
    expect(altTextFromFilename('.jpg')).toBe('');
    expect(altTextFromFilename('___.png')).toBe('');
  });
});
