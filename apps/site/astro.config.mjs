import { defineConfig } from 'astro/config';

// Die Domain steht noch nicht fest (siehe okf/open-points.md, O9).
// Sobald sie feststeht, kommt hier `site` hinzu.
export default defineConfig({
  trailingSlash: 'always',
  build: { format: 'directory' },
});
