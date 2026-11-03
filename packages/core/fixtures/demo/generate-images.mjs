// Creates the placeholder images of the demo set. They are clearly marked as
// placeholders, so they never pass for real photos. Run it from the repo root:
//   node packages/core/fixtures/demo/generate-images.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));

// [file, hue pair, label]
const IMAGES = [
  ['content/bilder/build-ablauf.jpg', ['#1f4e79', '#4fa3d1'], 'Build-Ablauf'],
  [
    'content/bilder/blende-zeit-iso.jpg',
    ['#3b3b58', '#c97b84'],
    'Blende, Zeit, ISO',
  ],
  [
    'content/bilder/goldene-stunde.jpg',
    ['#8a4b08', '#f3b95f'],
    'Goldene Stunde',
  ],
  ['content/bilder/raw-und-jpeg.jpg', ['#2d3a3a', '#6fa58f'], 'RAW und JPEG'],
  [
    'content/bilder/zapfenverbindung.jpg',
    ['#5b3a1e', '#c8935a'],
    'Zapfenverbindung',
  ],
  ['content/bilder/jahrringe.jpg', ['#6b4423', '#d9b382'], 'Jahrringe'],
  ['content/bilder/traufkante.jpg', ['#3d4a2f', '#a3b27a'], 'Traufkante'],
  [
    'memos/attachments/img-nebel/IMG_NEBEL_PARK.jpg',
    ['#4a5560', '#b8c4cc'],
    'Nebel im Park',
  ],
  [
    'memos/attachments/img-hobel/IMG_HOBELSPAN.jpg',
    ['#7a5230', '#e0bf8f'],
    'Hobelspan',
  ],
  [
    'memos/attachments/img-bisect/Screenshot_bisect.jpg',
    ['#1b2a35', '#3f7d6e'],
    'git bisect',
  ],
];

for (const [file, [from, to], label] of IMAGES) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <text x="600" y="380" text-anchor="middle" font-family="sans-serif" font-size="72" fill="#ffffff">${label}</text>
    <text x="600" y="460" text-anchor="middle" font-family="sans-serif" font-size="36" fill="#ffffff" fill-opacity="0.85">Platzhalterbild, kein echtes Foto</text>
  </svg>`;
  const out = path.join(here, file);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(
    out,
    await sharp(Buffer.from(svg)).jpeg({ quality: 72 }).toBuffer(),
  );
  console.log(file);
}
