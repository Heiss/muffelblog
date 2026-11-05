import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { isHeic } from './heic.ts';
import type { HeicConverter } from './heic.ts';
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

interface ResolverOptions {
  root: string;
  urlPrefix: string;
  /** Shared store of the served files, otherwise a private one. */
  store?: Map<string, Buffer>;
  /** Without it HEIC photos are not used (the decoder is not part of the image library). */
  convertHeic?: HeicConverter;
}

/** The state of one resolver: options, served files, processed images. */
interface Resolver {
  options: ResolverOptions;
  files: Map<string, Buffer>;
  processed: Map<string, ProcessedImage>;
  realRoot?: string;
}

const failure = (
  code: 'not-found' | 'unsupported' | 'invalid',
  reason: string,
): ImageResolveResult => ({ ok: false, code, reason });

const HEIC_MISSING =
  'HEIC photos need the converter heif-convert (package libheif-examples), which is not available here: use JPEG';

/** Why a normalized path may not be read, or null. */
function pathProblem(normal: string): string | null {
  if (
    normal === '..' ||
    normal.startsWith('../') ||
    path.posix.isAbsolute(normal)
  )
    return 'Path is outside the content folder';
  if (normal.split('/').some((part) => part.startsWith('.')))
    return 'Hidden path';
  return null;
}

function unsupportedReason(extension: string, heic: boolean): string {
  if (extension === '.svg') return 'SVG is not supported';
  if (heic) return HEIC_MISSING;
  return `File type ${extension || '(none)'} is not supported`;
}

/** Checks the path and the file type; a refusal, or the facts for reading. */
function checkImagePath(
  r: Resolver,
  rel: string,
): ImageResolveResult | { normal: string; heic: boolean } {
  const normal = path.posix.normalize(rel);
  const problem = pathProblem(normal);
  if (problem !== null) return failure('invalid', problem);
  const extension = path.posix.extname(normal).toLowerCase();
  const heic = extension === '.heic' || extension === '.heif';
  if (EXTENSIONS.has(extension) || (heic && r.options.convertHeic))
    return { normal, heic };
  return failure('unsupported', unsupportedReason(extension, heic));
}

/** The real path of the file inside the content folder, or a refusal. */
async function realFile(
  r: Resolver,
  normal: string,
): Promise<string | ImageResolveResult> {
  r.realRoot ??= await realpath(r.options.root);
  const base = r.realRoot;
  let real: string;
  try {
    real = await realpath(path.join(base, normal));
  } catch {
    return failure('not-found', 'File not found');
  }
  if (real !== base && !real.startsWith(base + path.sep))
    return failure('invalid', 'Link leads out of the content folder');
  const info = await stat(real);
  if (!info.isFile()) return failure('invalid', 'Not an image');
  if (info.size > MAX_BYTES) return failure('invalid', 'File is too large');
  return real;
}

/** Processes the image once per content (HEIC converted first); null for a HEIC name with other content. */
async function processOnce(
  r: Resolver,
  content: Buffer,
  heic: boolean,
): Promise<ProcessedImage | null> {
  const id = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const existing = r.processed.get(id);
  if (existing) return existing;
  let source: Buffer = content;
  if (heic) {
    // The content must be what the name says, then the tool runs.
    if (!isHeic(content) || !r.options.convertHeic) return null;
    source = await r.options.convertHeic(content);
  }
  const image = await processImage(source);
  // Keyed by the original, so a converted photo is converted only once.
  r.processed.set(id, image);
  return image;
}

async function resolveImage(
  r: Resolver,
  rel: string,
): Promise<ImageResolveResult> {
  const checked = checkImagePath(r, rel);
  if ('ok' in checked) return checked;
  const real = await realFile(r, checked.normal);
  if (typeof real !== 'string') return real;
  let image: ProcessedImage | null;
  try {
    image = await processOnce(r, await readFile(real), checked.heic);
  } catch {
    return failure('invalid', 'File is not a readable image');
  }
  if (image === null) return failure('invalid', 'File is not a HEIC photo');
  for (const variant of image.variants) r.files.set(variant.file, variant.data);
  return { ok: true, image: toResolvedImage(image, r.options.urlPrefix) };
}

/** Resolves images from the content folder and processes each image only once. */
export function createLocalImageResolver(
  options: ResolverOptions,
): LocalImageResolver {
  const r: Resolver = {
    options,
    files: options.store ?? new Map<string, Buffer>(),
    processed: new Map(),
  };
  return { files: () => r.files, resolve: (rel) => resolveImage(r, rel) };
}
