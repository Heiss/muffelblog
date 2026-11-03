// Creates the README images from the built site with the demo content.
// Usage: pnpm screenshots (builds first with MUFFEL_FIXTURES=demo).
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const PORT = 4399;
const ORIGIN = `http://localhost:${PORT}`;
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist');
const target = path.join(here, '..', '..', '..', 'docs', 'screenshots');

// 1x1 PNG as a stand-in for allowed foreign images, so nothing goes online.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const views = [
  {
    name: 'feed-breit',
    theme: 'solarized-light',
    route: '/',
    width: 1280,
    height: 900,
    scale: 1,
  },
  {
    name: 'feed-dunkel',
    theme: 'dracula',
    route: '/',
    width: 1280,
    height: 900,
    scale: 1,
  },
  {
    name: 'feed-mobil',
    theme: 'solarized-light',
    route: '/',
    width: 390,
    height: 844,
    scale: 2,
  },
  {
    name: 'artikel',
    theme: 'solarized-light',
    route: '/p/statischer-blog/',
    width: 1280,
    height: 1000,
    scale: 1,
  },
  {
    name: 'artikel-matrix',
    theme: 'matrix',
    route: '/p/backups-zurueckspielen/',
    width: 1280,
    height: 1000,
    scale: 1,
  },
  {
    name: 'tags',
    theme: 'solarized-light',
    route: '/tag/',
    width: 1280,
    height: 700,
    scale: 1,
  },
];

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(ORIGIN)).ok) return;
    } catch {
      /* noch nicht bereit */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('The server does not start');
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
  await waitForServer();
  await mkdir(target, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  for (const a of views) {
    const context = await browser.newContext({
      viewport: { width: a.width, height: a.height },
      deviceScaleFactor: a.scale,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
    });
    const page = await context.newPage();
    // The page picks the theme itself from the browser storage, like for visitors.
    await page.addInitScript(
      (id) => localStorage.setItem('muffel:theme', id),
      a.theme,
    );
    await page.route(/^https?:\/\/(?!localhost)/, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
    );
    await page.goto(`${ORIGIN}${a.route}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate('document.fonts.ready');
    const png = await page.screenshot();
    await writeFile(
      path.join(target, `${a.name}.webp`),
      await sharp(png).webp({ quality: 85 }).toBuffer(),
    );
    console.log(`docs/screenshots/${a.name}.webp`);
    await context.close();
  }
  await browser.close();
} finally {
  server.kill();
}
