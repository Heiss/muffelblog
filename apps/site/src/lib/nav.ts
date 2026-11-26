/** Navigation of the frame (layout W24): the sidebar and the bottom bar on phones. */

export type QuickId = 'home' | 'glossary' | 'tags' | 'search' | 'menu';

/** Strokes of the icons of the bottom bar (24 by 24). */
export const ICONS: Record<QuickId, string> = {
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  glossary: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM9 9h6M9 13h6',
  tags: 'M9 4L7 20M17 4l-2 16M4 9h16M3 15h16',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
  menu: 'M4 7h16M4 12h16M4 17h16',
};

export interface NavLink {
  href: string;
  label: string;
  current: boolean;
}

export interface QuickLink extends NavLink {
  id: QuickId;
}

interface NavLabels {
  home: string;
  glossary: string;
  graph: string;
  tags: string;
  files: string;
  comments: string;
  search: string;
  menu: string;
}

// The feed in all its series, and the posts and memos it lists, belong to "Home".
const HOME = /^\/(?:(?:page|posts|memos|terms|updated)\/.*|[pm]\/.*)?$/;

/** Which section of the site a path belongs to. */
export function sectionOf(path: string): string | null {
  if (HOME.test(path)) return 'home';
  if (/^\/(?:glossary|g)\//.test(path)) return 'glossary';
  const first = /^\/(graph|tag|files|comments|search)\//.exec(path);
  return first ? (first[1] ?? null) : null;
}

/** The links of the sidebar and of the bottom bar, the current one marked. */
export function navState(
  path: string,
  options: { comments: boolean; labels: NavLabels },
): { mainLinks: NavLink[]; quickLinks: QuickLink[] } {
  const section = sectionOf(path);
  const t = options.labels;
  const link = (id: string, href: string, label: string) => ({
    href,
    label,
    current: section === id,
  });
  const mainLinks = [
    link('home', '/', t.home),
    link('glossary', '/glossary/', t.glossary),
    link('graph', '/graph/', t.graph),
    link('tag', '/tag/', t.tags),
    link('files', '/files/', t.files),
    ...(options.comments ? [link('comments', '/comments/', t.comments)] : []),
    link('search', '/search/', t.search),
  ];
  const quickLinks: QuickLink[] = [
    { id: 'home', ...link('home', '/', t.home) },
    { id: 'glossary', ...link('glossary', '/glossary/', t.glossary) },
    { id: 'tags', ...link('tag', '/tag/', t.tags) },
    { id: 'search', ...link('search', '/search/', t.search) },
    { id: 'menu', href: '#site-menu', label: t.menu, current: false },
  ];
  return { mainLinks, quickLinks };
}
