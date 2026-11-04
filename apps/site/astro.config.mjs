import { defineConfig } from 'astro/config';

// The domain is not fixed yet (see okf/open-points.md, O9). Once it is, `site`
// is added here.
export default defineConfig({
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // The Content Security Policy of the web server forbids inline scripts and
    // styles, so everything is delivered as files.
    inlineStylesheets: 'never',
  },
  vite: {
    build: { assetsInlineLimit: 0 },
    // The UI language is fixed per build (MUFFEL_LANG). It is put in as a
    // constant, so the scripts for the browser carry only one language.
    // Validation happens in `pickMessages` and in `readSettings`.
    define: {
      __MUFFEL_LANG__: JSON.stringify(process.env.MUFFEL_LANG ?? ''),
    },
  },
});
