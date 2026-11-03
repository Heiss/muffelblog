// Erzeugt die Bilder der README aus der gebauten Seite mit Beispieldaten.
// Aufruf: pnpm screenshots (baut vorher mit MUFFEL_FIXTURES=1).
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const PORT = 4399;
const ORIGIN = `http://localhost:${PORT}`;
const hier = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(hier, '..', 'dist');
const ziel = path.join(hier, '..', '..', '..', 'docs', 'screenshots');

// 1x1-PNG als Ersatz für freigegebene Fremdbilder, damit nichts ins Netz geht.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const ansichten = [
  {
    datei: 'feed-breit',
    theme: 'solarized-light',
    pfad: '/',
    breite: 1280,
    hoehe: 900,
    skala: 1,
  },
  {
    datei: 'feed-dunkel',
    theme: 'dracula',
    pfad: '/',
    breite: 1280,
    hoehe: 900,
    skala: 1,
  },
  {
    datei: 'feed-mobil',
    theme: 'solarized-light',
    pfad: '/',
    breite: 390,
    hoehe: 844,
    skala: 2,
  },
  {
    datei: 'artikel',
    theme: 'solarized-light',
    pfad: '/p/rendering-demo/',
    breite: 1280,
    hoehe: 1000,
    skala: 1,
  },
  {
    datei: 'artikel-matrix',
    theme: 'matrix',
    pfad: '/p/rendering-demo/',
    breite: 1280,
    hoehe: 1000,
    skala: 1,
  },
  {
    datei: 'tags',
    theme: 'solarized-light',
    pfad: '/tag/',
    breite: 1280,
    hoehe: 700,
    skala: 1,
  },
];

async function warteAufServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(ORIGIN)).ok) return;
    } catch {
      /* noch nicht bereit */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server startet nicht');
}

const server = spawn(
  'pnpm',
  [
    'exec',
    'sirv',
    dist,
    '--port',
    String(PORT),
    '--host',
    'localhost',
    '--quiet',
  ],
  { stdio: 'ignore' },
);

try {
  await warteAufServer();
  await mkdir(ziel, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  for (const a of ansichten) {
    const kontext = await browser.newContext({
      viewport: { width: a.breite, height: a.hoehe },
      deviceScaleFactor: a.skala,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
    });
    const seite = await kontext.newPage();
    // Das Theme wählt die Seite selbst aus dem Browser-Speicher, wie bei Besuchern.
    await seite.addInitScript(
      (id) => localStorage.setItem('muffel:theme', id),
      a.theme,
    );
    await seite.route(/^https?:\/\/(?!localhost)/, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
    );
    await seite.goto(`${ORIGIN}${a.pfad}`);
    await seite.waitForLoadState('networkidle');
    await seite.evaluate('document.fonts.ready');
    const png = await seite.screenshot();
    await writeFile(
      path.join(ziel, `${a.datei}.webp`),
      await sharp(png).webp({ quality: 85 }).toBuffer(),
    );
    console.log(`docs/screenshots/${a.datei}.webp`);
    await kontext.close();
  }
  await browser.close();
} finally {
  server.kill();
}
