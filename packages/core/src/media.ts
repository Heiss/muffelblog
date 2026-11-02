import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { ImageResolveResult } from './render.ts';

export interface ImageVariant {
  width: number;
  height: number;
  file: string;
  data: Buffer;
}

export interface ProcessedImage {
  id: string;
  /** Maße des Originals nach Anwendung der Ausrichtung. */
  width: number;
  height: number;
  variants: ImageVariant[];
}

const BREITEN = [480, 960, 1440, 1920] as const;
const ANZEIGE_BREITE = 960;
const MAX_BYTES = 25 * 1024 * 1024;
const ENDUNGEN = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);

/**
 * Verkleinert ein Bild auf mehrere Breiten und wandelt es in WebP um.
 * Die EXIF-Ausrichtung wird angewandt und danach entfernt, ebenso alle
 * Metadaten (GPS, Kamera, Farbprofil). Kleine Bilder werden nicht vergrößert.
 */
export async function processImage(eingabe: Buffer): Promise<ProcessedImage> {
  const id = createHash('sha256').update(eingabe).digest('hex').slice(0, 16);
  const optionen = { animated: true, limitInputPixels: 100_000_000 } as const;

  const meta = await sharp(eingabe, optionen).metadata();
  const roheBreite = meta.width;
  const roheHoehe = meta.pageHeight ?? meta.height;
  if (!roheBreite || !roheHoehe) throw new Error('Maße des Bildes unbekannt');
  const gedreht = meta.orientation !== undefined && meta.orientation >= 5;
  const breite = gedreht ? roheHoehe : roheBreite;
  const hoehe = gedreht ? roheBreite : roheHoehe;

  const breiten: number[] = BREITEN.filter((b) => b <= breite);
  if (breiten.length === 0) breiten.push(breite);

  const variants: ImageVariant[] = [];
  for (const zielBreite of breiten) {
    const data = await sharp(eingabe, optionen)
      .rotate()
      .resize({ width: zielBreite, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    variants.push({
      width: zielBreite,
      height: Math.round((zielBreite * hoehe) / breite),
      file: `${id}-${zielBreite}.webp`,
      data,
    });
  }
  return { id, width: breite, height: hoehe, variants };
}

export interface LocalImageResolver {
  resolve: (rootRelativePath: string) => Promise<ImageResolveResult>;
  /** Alle bisher erzeugten Dateien: Dateiname zu Inhalt. */
  files: () => Map<string, Buffer>;
}

/** Löst Bilder aus dem Inhaltsordner auf und verarbeitet jedes Bild nur einmal. */
export function createLocalImageResolver(optionen: {
  root: string;
  urlPrefix: string;
}): LocalImageResolver {
  const dateien = new Map<string, Buffer>();
  const verarbeitet = new Map<string, ProcessedImage>();
  let wurzelReal: string | undefined;

  const wurzel = async (): Promise<string> => {
    wurzelReal ??= await realpath(optionen.root);
    return wurzelReal;
  };

  const fehler = (
    code: 'not-found' | 'unsupported' | 'invalid',
    reason: string,
  ): ImageResolveResult => ({
    ok: false,
    code,
    reason,
  });

  return {
    files: () => dateien,
    async resolve(rel) {
      const normal = path.posix.normalize(rel);
      if (
        normal === '..' ||
        normal.startsWith('../') ||
        path.posix.isAbsolute(normal)
      ) {
        return fehler('invalid', 'Pfad liegt außerhalb des Inhaltsordners');
      }
      if (normal.split('/').some((teil) => teil.startsWith('.'))) {
        return fehler('invalid', 'versteckter Pfad');
      }
      const endung = path.posix.extname(normal).toLowerCase();
      if (!ENDUNGEN.has(endung)) {
        return fehler(
          'unsupported',
          endung === '.svg'
            ? 'SVG wird nicht unterstützt'
            : `Dateityp ${endung || '(ohne)'} wird nicht unterstützt`,
        );
      }

      const basis = await wurzel();
      let echt: string;
      try {
        echt = await realpath(path.join(basis, normal));
      } catch {
        return fehler('not-found', 'Datei nicht gefunden');
      }
      if (echt !== basis && !echt.startsWith(basis + path.sep)) {
        return fehler('invalid', 'Verweis führt aus dem Inhaltsordner heraus');
      }

      const info = await stat(echt);
      if (!info.isFile()) return fehler('invalid', 'kein Bild');
      if (info.size > MAX_BYTES) return fehler('invalid', 'Datei ist zu groß');

      let bild: ProcessedImage;
      try {
        const inhalt = await readFile(echt);
        const id = createHash('sha256')
          .update(inhalt)
          .digest('hex')
          .slice(0, 16);
        const schon = verarbeitet.get(id);
        bild = schon ?? (await processImage(inhalt));
        verarbeitet.set(bild.id, bild);
      } catch {
        return fehler('invalid', 'Datei ist kein lesbares Bild');
      }

      for (const variante of bild.variants)
        dateien.set(variante.file, variante.data);

      const anzeige =
        [...bild.variants].reverse().find((v) => v.width <= ANZEIGE_BREITE) ??
        bild.variants[0];
      if (!anzeige) return fehler('invalid', 'keine Variante erzeugt');
      return {
        ok: true,
        image: {
          src: `${optionen.urlPrefix}${anzeige.file}`,
          srcset: bild.variants
            .map((v) => `${optionen.urlPrefix}${v.file} ${v.width}w`)
            .join(', '),
          width: anzeige.width,
          height: anzeige.height,
        },
      };
    },
  };
}
