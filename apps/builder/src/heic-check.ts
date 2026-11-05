// Checks inside the builder container that HEIC photos can be converted:
//   docker compose exec builder node src/heic-check.ts
import {
  createHeifConverter,
  heifAvailable,
  processImage,
} from '@muffelblog/core';
import { readFile } from 'node:fs/promises';

const sample = new URL(
  '../../../packages/core/fixtures/heic/sample.heic',
  import.meta.url,
);

if (!(await heifAvailable())) {
  console.error('heif-convert is not installed in this image.');
  process.exit(1);
}
const jpeg = await createHeifConverter()(await readFile(sample));
const image = await processImage(jpeg);
console.log(`HEIC conversion works (${image.width}x${image.height} px).`);
