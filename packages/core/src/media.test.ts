import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalImageResolver, processImage } from './media.ts';

const farbe = { r: 20, g: 120, b: 200 };

async function jpeg(
  width: number,
  height: number,
  mitExif = false,
  orientierung?: number,
): Promise<Buffer> {
  let bild = sharp({
    create: { width, height, channels: 3, background: farbe },
  }).jpeg();
  if (mitExif)
    bild = bild.withExif({
      IFD0: { Copyright: 'privat', Software: 'Testkamera' },
    });
  if (orientierung) bild = bild.withMetadata({ orientation: orientierung });
  return bild.toBuffer();
}

describe('processImage', () => {
  it('creates WebP variants in several widths up to at most 1920', async () => {
    const result = await processImage(await jpeg(2400, 1200));
    expect(result.variants.map((v) => v.width)).toEqual([480, 960, 1440, 1920]);
    for (const v of result.variants) {
      expect((await sharp(v.data).metadata()).format).toBe('webp');
      expect(v.file).toBe(`${result.id}-${v.width}.webp`);
    }
    expect(result.variants[0]?.height).toBe(240);
  });

  it('does not enlarge small images', async () => {
    const result = await processImage(await jpeg(300, 200));
    expect(result.variants.map((v) => v.width)).toEqual([300]);
    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
  });

  it('removes EXIF data', async () => {
    const eingabe = await jpeg(800, 600, true);
    expect((await sharp(eingabe).metadata()).exif).toBeDefined();
    const result = await processImage(eingabe);
    for (const v of result.variants) {
      const meta = await sharp(v.data).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
    }
  });

  it('applies the EXIF orientation before it is dropped', async () => {
    const result = await processImage(await jpeg(200, 100, false, 6));
    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
    const meta = await sharp(result.variants[0]?.data).metadata();
    expect([meta.width, meta.height]).toEqual([100, 200]);
  });

  it('assigns the same identifier for the same content', async () => {
    const eingabe = await jpeg(500, 300);
    const a = await processImage(eingabe);
    const b = await processImage(Buffer.from(eingabe));
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('rejects data that is not an image', async () => {
    await expect(processImage(Buffer.from('kein Bild'))).rejects.toThrow();
  });
});

describe('createLocalImageResolver', () => {
  let root: string;
  let draussen: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'muffel-wurzel-'));
    draussen = await mkdtemp(path.join(tmpdir(), 'muffel-draussen-'));
    await mkdir(path.join(root, 'bilder'));
    await mkdir(path.join(root, '.obsidian'));
    await writeFile(
      path.join(root, 'bilder', 'foto.jpg'),
      await jpeg(1000, 500),
    );
    await writeFile(
      path.join(root, 'bilder', 'logo.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    await writeFile(path.join(root, 'bilder', 'kaputt.png'), 'kein Bild');
    await writeFile(
      path.join(root, '.obsidian', 'versteckt.jpg'),
      await jpeg(100, 100),
    );
    await writeFile(path.join(draussen, 'geheim.jpg'), await jpeg(100, 100));
    await symlink(
      path.join(draussen, 'geheim.jpg'),
      path.join(root, 'bilder', 'link.jpg'),
    );
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(draussen, { recursive: true, force: true });
  });

  it('returns src, srcset and dimensions and collects the files to serve', async () => {
    const resolver = createLocalImageResolver({
      root: root,
      urlPrefix: '/media/',
    });
    const response = await resolver.resolve('bilder/foto.jpg');
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.image.srcset).toMatch(
      /^\/media\/[0-9a-f]{16}-480\.webp 480w, /,
    );
    expect(response.image.src).toMatch(/^\/media\/[0-9a-f]{16}-960\.webp$/);
    expect(response.image.width).toBe(960);
    expect(response.image.height).toBe(480);
    const files = [...resolver.files().keys()];
    expect(files.length).toBe(2);
    expect(files.every((d) => /^[0-9a-f]{16}-\d+\.webp$/.test(d))).toBe(true);
  });

  it('processes the same image only once', async () => {
    const resolver = createLocalImageResolver({
      root: root,
      urlPrefix: '/media/',
    });
    await resolver.resolve('bilder/foto.jpg');
    await resolver.resolve('bilder/foto.jpg');
    expect(resolver.files().size).toBe(2);
  });

  it('reports missing files', async () => {
    const resolver = createLocalImageResolver({
      root: root,
      urlPrefix: '/media/',
    });
    expect(await resolver.resolve('bilder/gibt-es-nicht.jpg')).toMatchObject({
      ok: false,
      code: 'not-found',
    });
  });

  it('rejects SVG', async () => {
    const resolver = createLocalImageResolver({
      root: root,
      urlPrefix: '/media/',
    });
    expect(await resolver.resolve('bilder/logo.svg')).toMatchObject({
      ok: false,
      code: 'unsupported',
    });
  });

  it('reports files that are not images', async () => {
    const resolver = createLocalImageResolver({
      root: root,
      urlPrefix: '/media/',
    });
    expect(await resolver.resolve('bilder/kaputt.png')).toMatchObject({
      ok: false,
      code: 'invalid',
    });
  });

  it('rejects hidden folders', async () => {
    const resolver = createLocalImageResolver({
      root: root,
      urlPrefix: '/media/',
    });
    expect(await resolver.resolve('.obsidian/versteckt.jpg')).toMatchObject({
      ok: false,
      code: 'invalid',
    });
  });

  it('does not follow a link out of the folder', async () => {
    const resolver = createLocalImageResolver({
      root: root,
      urlPrefix: '/media/',
    });
    expect(await resolver.resolve('bilder/link.jpg')).toMatchObject({
      ok: false,
      code: 'invalid',
    });
  });

  it('rejects paths outside the root', async () => {
    const resolver = createLocalImageResolver({
      root: root,
      urlPrefix: '/media/',
    });
    expect(await resolver.resolve('../geheim.jpg')).toMatchObject({
      ok: false,
      code: 'invalid',
    });
  });
});

describe('createLocalImageResolver with HEIC photos', () => {
  let dir: string;
  let heic: Buffer;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'heic-resolver-'));
    heic = await readFile(
      new URL('../fixtures/heic/sample.heic', import.meta.url),
    );
    await writeFile(path.join(dir, 'foto.heic'), heic);
    await writeFile(path.join(dir, 'zweites.heif'), heic);
    await writeFile(path.join(dir, 'falsch.heic'), await jpeg(10, 10));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  const converter = () => {
    const calls: number[] = [];
    return {
      calls,
      convert: async (input: Buffer) => {
        calls.push(input.length);
        return jpeg(96, 64);
      },
    };
  };

  it('converts a HEIC photo and processes the JPEG like any other image', async () => {
    const c = converter();
    const r = createLocalImageResolver({
      root: dir,
      urlPrefix: '/media/',
      convertHeic: c.convert,
    });
    const result = await r.resolve('foto.heic');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.width).toBe(96);
    expect(result.image.src).toMatch(/^\/media\/[0-9a-f]{16}-96\.webp$/);
    expect(c.calls).toEqual([heic.length]);
  });

  it('converts a photo only once, however often it is used', async () => {
    const c = converter();
    const r = createLocalImageResolver({
      root: dir,
      urlPrefix: '/media/',
      convertHeic: c.convert,
    });
    await r.resolve('foto.heic');
    await r.resolve('foto.heic');
    await r.resolve('zweites.heif');
    expect(c.calls).toHaveLength(1);
  });

  it('says why a HEIC photo is not used when there is no converter', async () => {
    const r = createLocalImageResolver({ root: dir, urlPrefix: '/media/' });
    const result = await r.resolve('foto.heic');
    expect(result).toMatchObject({ ok: false, code: 'unsupported' });
    expect(JSON.stringify(result)).toMatch(/HEIC/);
  });

  it('does not trust the extension: a file that is no HEIC photo is refused without converting', async () => {
    const c = converter();
    const r = createLocalImageResolver({
      root: dir,
      urlPrefix: '/media/',
      convertHeic: c.convert,
    });
    const result = await r.resolve('falsch.heic');
    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    expect(c.calls).toEqual([]);
  });

  it('gives an invalid result when the conversion fails', async () => {
    const r = createLocalImageResolver({
      root: dir,
      urlPrefix: '/media/',
      convertHeic: async () => {
        throw new Error('tool failed, path /secret/place');
      },
    });
    const result = await r.resolve('foto.heic');
    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    // the message of the tool (with its paths) is not passed on
    expect(JSON.stringify(result)).not.toContain('/secret/place');
  });
});
