import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

// GitHub Pages: https://heiss.github.io/muffelblog/
export default defineConfig({
  site: 'https://heiss.github.io',
  base: '/muffelblog',
  integrations: [
    starlight({
      title: 'Muffelblog',
      description:
        'A personal blog that publishes from Nextcloud and Memos: static, self-hosted, with search, RSS, glossary and comments.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/Heiss/muffelblog',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/Heiss/muffelblog/edit/main/apps/docs/',
      },
      sidebar: [
        {
          label: 'Start',
          items: [
            { slug: 'start/what-is-it' },
            { slug: 'start/getting-started' },
            { slug: 'start/quickstart' },
            { slug: 'start/agent-install' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'guides/writing' },
            { slug: 'guides/nextcloud' },
            { slug: 'guides/memos' },
            { slug: 'guides/comments' },
            { slug: 'guides/webmentions' },
            { slug: 'guides/statistics' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { slug: 'production/reverse-proxy' },
            { slug: 'production/operations' },
            { slug: 'production/runbook' },
            { slug: 'production/host-folder' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { slug: 'reference/configuration' },
            { slug: 'reference/urls' },
            { slug: 'reference/architecture' },
          ],
        },
      ],
    }),
  ],
});
