import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/dist-de/**',
      '**/.astro/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'okf/**',
      'coverage/**',
      'reports/**',
      '.stryker-tmp/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Quality gates (W18, owner's decision 2026-11-05: strict). Tests are
  // excluded from the length rule: a describe block is a list, not logic.
  {
    files: ['**/*.ts', '**/*.mjs', '**/*.js'],
    plugins: { sonarjs },
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 4],
      'sonarjs/cognitive-complexity': ['error', 10],
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/e2e/**', '**/contract/**'],
    rules: { 'max-lines-per-function': 'off' },
  },
  prettier,
);
