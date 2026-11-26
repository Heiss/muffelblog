import { describe, expect, it } from 'vitest';
import { ICONS, navState, sectionOf } from './nav';

const labels = {
  home: 'Home',
  glossary: 'Glossary',
  graph: 'Graph',
  tags: 'Tags',
  files: 'Files',
  comments: 'Comments',
  search: 'Search',
  menu: 'Menu',
};

describe('sectionOf', () => {
  it('puts the feed, its series and the posts and memos under home', () => {
    for (const path of [
      '/',
      '/page/2/',
      '/posts/',
      '/memos/page/3/',
      '/terms/',
      '/updated/',
      '/p/hallo/',
      '/m/abc/',
    ])
      expect(sectionOf(path), path).toBe('home');
  });

  it('knows the other sections', () => {
    expect(sectionOf('/glossary/')).toBe('glossary');
    expect(sectionOf('/g/cache/')).toBe('glossary');
    expect(sectionOf('/graph/')).toBe('graph');
    expect(sectionOf('/tag/')).toBe('tag');
    expect(sectionOf('/tag/rust/page/2/')).toBe('tag');
    expect(sectionOf('/files/')).toBe('files');
    expect(sectionOf('/comments/page/2/')).toBe('comments');
    expect(sectionOf('/search/')).toBe('search');
  });

  it('gives nothing for pages and unknown paths', () => {
    expect(sectionOf('/impressum/')).toBeNull();
    expect(sectionOf('/pages/')).toBeNull();
    expect(sectionOf('/px/')).toBeNull();
    expect(sectionOf('/x/glossary/')).toBeNull();
  });
});

describe('navState', () => {
  it('lists the sidebar links in order and marks the current one', () => {
    const { mainLinks } = navState('/g/cache/', { comments: true, labels });
    expect(mainLinks).toEqual([
      { href: '/', label: 'Home', current: false },
      { href: '/glossary/', label: 'Glossary', current: true },
      { href: '/graph/', label: 'Graph', current: false },
      { href: '/tag/', label: 'Tags', current: false },
      { href: '/files/', label: 'Files', current: false },
      { href: '/comments/', label: 'Comments', current: false },
      { href: '/search/', label: 'Search', current: false },
    ]);
  });

  it('leaves the comments out without a comments service', () => {
    const { mainLinks } = navState('/', { comments: false, labels });
    expect(mainLinks.map((l) => l.href)).toEqual([
      '/',
      '/glossary/',
      '/graph/',
      '/tag/',
      '/files/',
      '/search/',
    ]);
    expect(mainLinks[0]?.current).toBe(true);
  });

  it('gives the bottom bar Home, Glossary, Tags, Search and Menu', () => {
    const { quickLinks } = navState('/tag/rust/', { comments: true, labels });
    expect(quickLinks).toEqual([
      { id: 'home', href: '/', label: 'Home', current: false },
      { id: 'glossary', href: '/glossary/', label: 'Glossary', current: false },
      { id: 'tags', href: '/tag/', label: 'Tags', current: true },
      { id: 'search', href: '/search/', label: 'Search', current: false },
      { id: 'menu', href: '#site-menu', label: 'Menu', current: false },
    ]);
  });

  it('marks nothing on a page outside the sections', () => {
    const { mainLinks, quickLinks } = navState('/impressum/', {
      comments: true,
      labels,
    });
    expect(mainLinks.some((l) => l.current)).toBe(false);
    expect(quickLinks.some((l) => l.current)).toBe(false);
  });
});

describe('ICONS', () => {
  it('has a path for every target of the bottom bar', () => {
    expect(Object.keys(ICONS)).toEqual([
      'home',
      'glossary',
      'tags',
      'search',
      'menu',
    ]);
    for (const d of Object.values(ICONS))
      expect(d).toMatch(/^M\d[\d .a-zA-Z-]+$/);
  });
});
