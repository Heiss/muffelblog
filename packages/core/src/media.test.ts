import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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
  it('erzeugt WebP-Varianten in mehreren Breiten bis höchstens 1920', async () => {
    const ergebnis = await processImage(await jpeg(2400, 1200));
    expect(ergebnis.variants.map((v) => v.width)).toEqual([
      480, 960, 1440, 1920,
    ]);
    for (const v of ergebnis.variants) {
      expect((await sharp(v.data).metadata()).format).toBe('webp');
      expect(v.file).toBe(`${ergebnis.id}-${v.width}.webp`);
    }
    expect(ergebnis.variants[0]?.height).toBe(240);
  });

  it('vergrößert kleine Bilder nicht', async () => {
    const ergebnis = await processImage(await jpeg(300, 200));
    expect(ergebnis.variants.map((v) => v.width)).toEqual([300]);
    expect(ergebnis.width).toBe(300);
    expect(ergebnis.height).toBe(200);
  });

  it('entfernt EXIF-Daten', async () => {
    const eingabe = await jpeg(800, 600, true);
    expect((await sharp(eingabe).metadata()).exif).toBeDefined();
    const ergebnis = await processImage(eingabe);
    for (const v of ergebnis.variants) {
      const meta = await sharp(v.data).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
    }
  });

  it('wendet die EXIF-Ausrichtung an, bevor sie wegfällt', async () => {
    const ergebnis = await processImage(await jpeg(200, 100, false, 6));
    expect(ergebnis.width).toBe(100);
    expect(ergebnis.height).toBe(200);
    const meta = await sharp(ergebnis.variants[0]?.data).metadata();
    expect([meta.width, meta.height]).toEqual([100, 200]);
  });

  it('vergibt dieselbe Kennung für denselben Inhalt', async () => {
    const eingabe = await jpeg(500, 300);
    const a = await processImage(eingabe);
    const b = await processImage(Buffer.from(eingabe));
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('weist Daten ab, die kein Bild sind', async () => {
    await expect(processImage(Buffer.from('kein Bild'))).rejects.toThrow();
  });
});

describe('createLocalImageResolver', () => {
  let wurzel: string;
  let draussen: string;

  beforeAll(async () => {
    wurzel = await mkdtemp(path.join(tmpdir(), 'muffel-wurzel-'));
    draussen = await mkdtemp(path.join(tmpdir(), 'muffel-draussen-'));
    await mkdir(path.join(wurzel, 'bilder'));
    await mkdir(path.join(wurzel, '.obsidian'));
    await writeFile(
      path.join(wurzel, 'bilder', 'foto.jpg'),
      await jpeg(1000, 500),
    );
    await writeFile(
      path.join(wurzel, 'bilder', 'logo.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    await writeFile(path.join(wurzel, 'bilder', 'kaputt.png'), 'kein Bild');
    await writeFile(
      path.join(wurzel, '.obsidian', 'versteckt.jpg'),
      await jpeg(100, 100),
    );
    await writeFile(path.join(draussen, 'geheim.jpg'), await jpeg(100, 100));
    await symlink(
      path.join(draussen, 'geheim.jpg'),
      path.join(wurzel, 'bilder', 'link.jpg'),
    );
  });

  afterAll(async () => {
    await rm(wurzel, { recursive: true, force: true });
    await rm(draussen, { recursive: true, force: true });
  });

  it('liefert src, srcset und Maße und sammelt die Dateien zum Ausliefern', async () => {
    const aufloeser = createLocalImageResolver({
      root: wurzel,
      urlPrefix: '/media/',
    });
    const antwort = await aufloeser.resolve('bilder/foto.jpg');
    expect(antwort.ok).toBe(true);
    if (!antwort.ok) return;
    expect(antwort.image.srcset).toMatch(
      /^\/media\/[0-9a-f]{16}-480\.webp 480w, /,
    );
    expect(antwort.image.src).toMatch(/^\/media\/[0-9a-f]{16}-960\.webp$/);
    expect(antwort.image.width).toBe(960);
    expect(antwort.image.height).toBe(480);
    const dateien = [...aufloeser.files().keys()];
    expect(dateien.length).toBe(2);
    expect(dateien.every((d) => /^[0-9a-f]{16}-\d+\.webp$/.test(d))).toBe(true);
  });

  it('verarbeitet dasselbe Bild nur einmal', async () => {
    const aufloeser = createLocalImageResolver({
      root: wurzel,
      urlPrefix: '/media/',
    });
    await aufloeser.resolve('bilder/foto.jpg');
    await aufloeser.resolve('bilder/foto.jpg');
    expect(aufloeser.files().size).toBe(2);
  });

  it('meldet fehlende Dateien', async () => {
    const aufloeser = createLocalImageResolver({
      root: wurzel,
      urlPrefix: '/media/',
    });
    expect(await aufloeser.resolve('bilder/gibt-es-nicht.jpg')).toMatchObject({
      ok: false,
      code: 'not-found',
    });
  });

  it('lehnt SVG ab', async () => {
    const aufloeser = createLocalImageResolver({
      root: wurzel,
      urlPrefix: '/media/',
    });
    expect(await aufloeser.resolve('bilder/logo.svg')).toMatchObject({
      ok: false,
      code: 'unsupported',
    });
  });

  it('meldet Dateien, die kein Bild sind', async () => {
    const aufloeser = createLocalImageResolver({
      root: wurzel,
      urlPrefix: '/media/',
    });
    expect(await aufloeser.resolve('bilder/kaputt.png')).toMatchObject({
      ok: false,
      code: 'invalid',
    });
  });

  it('lehnt versteckte Ordner ab', async () => {
    const aufloeser = createLocalImageResolver({
      root: wurzel,
      urlPrefix: '/media/',
    });
    expect(await aufloeser.resolve('.obsidian/versteckt.jpg')).toMatchObject({
      ok: false,
      code: 'invalid',
    });
  });

  it('folgt keinem Link aus dem Ordner heraus', async () => {
    const aufloeser = createLocalImageResolver({
      root: wurzel,
      urlPrefix: '/media/',
    });
    expect(await aufloeser.resolve('bilder/link.jpg')).toMatchObject({
      ok: false,
      code: 'invalid',
    });
  });

  it('lehnt Pfade außerhalb der Wurzel ab', async () => {
    const aufloeser = createLocalImageResolver({
      root: wurzel,
      urlPrefix: '/media/',
    });
    expect(await aufloeser.resolve('../geheim.jpg')).toMatchObject({
      ok: false,
      code: 'invalid',
    });
  });
});
