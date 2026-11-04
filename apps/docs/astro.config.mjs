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
          items: [{ slug: 'start/what-is-it' }, { slug: 'start/quickstart' }],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'guides/writing' },
            { slug: 'guides/nextcloud' },
            { slug: 'guides/memos' },
            { slug: 'guides/comments' },
          ],
        },
        {
          label: 'Production',
          items: [
            { slug: 'production/overview' },
            { slug: 'production/own-proxy' },
            { slug: 'production/own-caddy' },
            { slug: 'production/operations' },
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
