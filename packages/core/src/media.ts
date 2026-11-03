import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { ImageResolveResult, ResolvedImage } from './render.ts';

export interface ImageVariant {
  width: number;
  height: number;
  file: string;
  data: Buffer;
}

export interface ProcessedImage {
  id: string;
  /** Dimensions of the original after applying the orientation. */
  width: number;
  height: number;
  variants: ImageVariant[];
}

const WIDTHS = [480, 960, 1440, 1920] as const;
const DISPLAY_WIDTH = 960;
const MAX_BYTES = 25 * 1024 * 1024;
const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);

/**
 * Scales an image to several widths and converts it to WebP.
 * The EXIF orientation is applied and then removed, as is all other metadata
 * (GPS, camera, color profile). Small images are not enlarged.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const id = createHash('sha256').update(input).digest('hex').slice(0, 16);
  const options = { animated: true, limitInputPixels: 100_000_000 } as const;

  const meta = await sharp(input, options).metadata();
  const rawWidth = meta.width;
  const rawHeight = meta.pageHeight ?? meta.height;
  if (!rawWidth || !rawHeight) throw new Error('Image dimensions are unknown');
  const rotated = meta.orientation !== undefined && meta.orientation >= 5;
  const width = rotated ? rawHeight : rawWidth;
  const height = rotated ? rawWidth : rawHeight;

  const widths: number[] = WIDTHS.filter((w) => w <= width);
  if (widths.length === 0) widths.push(width);

  const variants: ImageVariant[] = [];
  for (const targetWidth of widths) {
    const data = await sharp(input, options)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    variants.push({
      width: targetWidth,
      height: Math.round((targetWidth * height) / width),
      file: `${id}-${targetWidth}.webp`,
      data,
    });
  }
  return { id, width, height, variants };
}

/** Maps the finished variants to `src`, `srcset` and dimensions for the HTML. */
export function toResolvedImage(
  image: ProcessedImage,
  urlPrefix: string,
): ResolvedImage {
  const display =
    [...image.variants].reverse().find((v) => v.width <= DISPLAY_WIDTH) ??
    image.variants[0];
  if (!display) throw new Error('No variant was created');
  return {
    src: `${urlPrefix}${display.file}`,
    srcset: image.variants
      .map((v) => `${urlPrefix}${v.file} ${v.width}w`)
      .join(', '),
    width: display.width,
    height: display.height,
  };
}

export interface LocalImageResolver {
  resolve: (rootRelativePath: string) => Promise<ImageResolveResult>;
  /** All files created so far: file name to content. */
  files: () => Map<string, Buffer>;
}

/** Resolves images from the content folder and processes each image only once. */
export function createLocalImageResolver(options: {
  root: string;
  urlPrefix: string;
  /** Shared store of the served files, otherwise a private one. */
  store?: Map<string, Buffer>;
}): LocalImageResolver {
  const files = options.store ?? new Map<string, Buffer>();
  const processed = new Map<string, ProcessedImage>();
  let realRoot: string | undefined;

  const rootPath = async (): Promise<string> => {
    realRoot ??= await realpath(options.root);
    return realRoot;
  };

  const failure = (
    code: 'not-found' | 'unsupported' | 'invalid',
    reason: string,
  ): ImageResolveResult => ({
    ok: false,
    code,
    reason,
  });

  return {
    files: () => files,
    async resolve(rel) {
      const normal = path.posix.normalize(rel);
      if (
        normal === '..' ||
        normal.startsWith('../') ||
        path.posix.isAbsolute(normal)
      ) {
        return failure('invalid', 'Path is outside the content folder');
      }
      if (normal.split('/').some((part) => part.startsWith('.'))) {
        return failure('invalid', 'Hidden path');
      }
      const extension = path.posix.extname(normal).toLowerCase();
      if (!EXTENSIONS.has(extension)) {
        return failure(
          'unsupported',
          extension === '.svg'
            ? 'SVG is not supported'
            : `File type ${extension || '(none)'} is not supported`,
        );
      }

      const base = await rootPath();
      let real: string;
      try {
        real = await realpath(path.join(base, normal));
      } catch {
        return failure('not-found', 'File not found');
      }
      if (real !== base && !real.startsWith(base + path.sep)) {
        return failure('invalid', 'Link leads out of the content folder');
      }

      const info = await stat(real);
      if (!info.isFile()) return failure('invalid', 'Not an image');
      if (info.size > MAX_BYTES) return failure('invalid', 'File is too large');

      let image: ProcessedImage;
      try {
        const content = await readFile(real);
        const id = createHash('sha256')
          .update(content)
          .digest('hex')
          .slice(0, 16);
        const existing = processed.get(id);
        image = existing ?? (await processImage(content));
        processed.set(image.id, image);
      } catch {
        return failure('invalid', 'File is not a readable image');
      }

      for (const variant of image.variants)
        files.set(variant.file, variant.data);

      return { ok: true, image: toResolvedImage(image, options.urlPrefix) };
    },
  };
}
