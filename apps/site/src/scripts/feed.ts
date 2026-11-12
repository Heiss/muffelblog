import { messages } from '../i18n/messages';
import {
  blockPath,
  freshIds,
  parseFilter,
  parseSort,
  seriesPath,
} from './feed-logic';
import { startLive } from './live';
import type { Filter, Sort } from './feed-logic';

const FILTER_KEY = 'muffel:filter';
const SORT_KEY = 'muffel:sort';
const POSITION_KEY = 'muffel:feed-position';
const ORIGIN = location.origin;

// Browser storage is optional: blocked or full means the defaults apply.
function read(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function write(storage: 'local' | 'session', key: string, value: string) {
  try {
    (storage === 'local' ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* without storage the defaults apply */
  }
}

interface Block {
  entries: Element[];
  next: string | null;
  title: string;
}

async function fetchBlock(path: string): Promise<Block> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    redirect: 'error',
    headers: { accept: 'text/html' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('text/html')) throw new Error('not HTML');
  const doc = new DOMParser().parseFromString(
    await response.text(),
    'text/html',
  );
  const entries = [
    ...doc.querySelectorAll('[data-feed-list] > article[data-id]'),
  ];
  const href = doc
    .querySelector('[data-pager] a[rel="next"]')
    ?.getAttribute('href');
  return {
    entries,
    next: href ? blockPath(href, ORIGIN) : null,
    title: doc.title,
  };
}

/** The feed on the page and what the script remembers about it. */
interface Feed {
  feed: HTMLElement;
  list: HTMLElement;
  status: HTMLElement;
  pager: HTMLElement | null;
  filterNav: HTMLElement | null;
  sortNav: HTMLElement | null;
  /** What the list shows now. */
  filter: Filter;
  sort: Sort;
  sentinel: HTMLElement;
  observer: IntersectionObserver;
  next: string | null;
  loaded: string[];
  loading: boolean;
  /** Raised when the list is replaced, so late answers are dropped. */
  generation: number;
}

const idOf = (el: Element) => el.getAttribute('data-id') ?? '';

function readNext(f: Feed): string | null {
  const href = f.pager?.querySelector('a[rel="next"]')?.getAttribute('href');
  return href ? blockPath(href, ORIGIN) : null;
}

/** Appends the entries that are not in the list yet. */
function append(f: Feed, entries: Element[]): void {
  const existing = new Set([...f.list.querySelectorAll('[data-id]')].map(idOf));
  const fresh = new Set(freshIds(existing, entries.map(idOf)));
  for (const el of entries) {
    if (!fresh.delete(idOf(el))) continue;
    f.list.append(document.importNode(el, true));
  }
}

function showError(f: Feed, path: string): void {
  f.status.hidden = false;
  f.status.textContent = messages.feed.loadFailed;
  // The normal link stays as a way out.
  const link = document.createElement('a');
  link.href = path;
  link.rel = 'next';
  link.textContent = messages.feed.older;
  f.status.append(link);
}

function observe(f: Feed): void {
  f.observer.unobserve(f.sentinel);
  if (f.next !== null && f.status.hidden) f.observer.observe(f.sentinel);
}

async function loadNext(f: Feed): Promise<void> {
  if (f.loading || f.next === null) return;
  f.loading = true;
  const mine = f.generation;
  const path = f.next;
  try {
    const block = await fetchBlock(path);
    if (mine !== f.generation) return;
    append(f, block.entries);
    f.loaded.push(path);
    f.next = block.next;
    f.status.hidden = true;
  } catch {
    if (mine === f.generation) showError(f, path);
    return;
  } finally {
    if (mine === f.generation) f.loading = false;
  }
  observe(f);
}

/** Marks the current filter and sort and points every link at the series it leads to. */
function mark(f: Feed): void {
  for (const a of f.filterNav?.querySelectorAll<HTMLAnchorElement>('a') ?? []) {
    const id = parseFilter(a.dataset.filterId);
    a.href = seriesPath(id, f.sort);
    if (id === f.filter) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  for (const a of f.sortNav?.querySelectorAll<HTMLAnchorElement>('a') ?? []) {
    const id = parseSort(a.dataset.sortId);
    a.href = seriesPath(f.filter, id);
    if (id === f.sort) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

/** Replaces the list with the first block of `path`; false when it could not be loaded. */
async function replaceWith(f: Feed, path: string): Promise<boolean> {
  f.generation += 1;
  f.loading = false;
  f.observer.unobserve(f.sentinel);
  f.status.hidden = true;
  try {
    const block = await fetchBlock(path);
    f.list.replaceChildren(
      ...block.entries.map((el) => document.importNode(el, true)),
    );
    f.next = block.next;
    f.loaded = [];
    document.title = block.title;
    return true;
  } catch {
    return false;
  }
}

/** Filter and sort: replaces the list with page 1 of the chosen series, without reloading. */
async function setView(
  f: Feed,
  view: { filter: Filter; sort: Sort },
  persist: boolean,
): Promise<void> {
  const path = seriesPath(view.filter, view.sort);
  // Without success the link acts like a normal link.
  if (!(await replaceWith(f, path))) return location.assign(path);
  f.filter = view.filter;
  f.sort = view.sort;
  history.replaceState(null, '', path);
  mark(f);
  if (persist) {
    write('local', FILTER_KEY, view.filter);
    write('local', SORT_KEY, view.sort);
  }
  window.scrollTo(0, 0);
  observe(f);
}

/** Shows the first block of a page at the top, for the banner "N new entries". */
async function showTop(f: Feed, path: string): Promise<void> {
  if (!(await replaceWith(f, path))) return location.assign(path);
  window.scrollTo(0, 0);
  observe(f);
}

/** A plain left click without modifier keys (others open a new tab, as usual). */
const isPlainClick = (event: MouseEvent) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

function onNavClick(f: Feed, event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const a = target.closest<HTMLAnchorElement>(
    'a[data-filter-id], a[data-sort-id]',
  );
  if (!a || !isPlainClick(event)) return;
  event.preventDefault();
  void setView(
    f,
    {
      filter: a.dataset.filterId ? parseFilter(a.dataset.filterId) : f.filter,
      sort: a.dataset.sortId ? parseSort(a.dataset.sortId) : f.sort,
    },
    true,
  );
}

interface Position {
  loaded: unknown[];
  y?: number;
}

/** True after "back" or a reload: only then the old position is restored. */
function cameBack(): boolean {
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  return nav?.type === 'back_forward' || nav?.type === 'reload';
}

/** The position remembered for this page after "back" or a reload, if any. */
function rememberedPosition(): Position | null {
  if (!cameBack()) return null;
  let remembered: { path?: unknown; loaded?: unknown; y?: unknown };
  try {
    remembered = JSON.parse(read('session', POSITION_KEY) ?? '');
  } catch {
    return null;
  }
  if (remembered.path !== location.pathname) return null;
  if (!Array.isArray(remembered.loaded)) return null;
  const y = remembered.y;
  const valid = typeof y === 'number' && Number.isFinite(y);
  return { loaded: remembered.loaded, y: valid ? y : undefined };
}

/** Loads the blocks that were open before and scrolls back; false if nothing was remembered. */
async function restore(f: Feed): Promise<boolean> {
  const position = rememberedPosition();
  if (position === null) return false;
  for (const entry of position.loaded) {
    if (typeof entry !== 'string' || f.next !== entry) break;
    await loadNext(f);
    if (!f.status.hidden) break;
  }
  if (position.y !== undefined) window.scrollTo(0, position.y);
  return true;
}

function newFeed(
  feed: HTMLElement,
  list: HTMLElement,
  status: HTMLElement,
): Feed {
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  feed.insertBefore(sentinel, status);
  const f = {
    feed,
    list,
    status,
    pager: feed.querySelector<HTMLElement>('[data-pager]'),
    filterNav: feed.querySelector<HTMLElement>('[data-filter]'),
    sortNav: feed.querySelector<HTMLElement>('[data-sort]'),
    filter: parseFilter(feed.dataset.series),
    sort: parseSort(feed.dataset.sortBy),
    sentinel,
    next: null,
    loaded: [],
    loading: false,
    generation: 0,
  } as unknown as Feed;
  f.observer = new IntersectionObserver(
    (hits) => {
      if (hits.some((t) => t.isIntersecting)) void loadNext(f);
    },
    { rootMargin: '600px 0px' },
  );
  return f;
}

/** On `/` a stored filter and sort win. Series that were opened explicitly do not. */
async function restoreOrFilter(f: Feed): Promise<void> {
  if (await restore(f)) return;
  if (f.feed.dataset.series !== 'all' || location.pathname !== '/') return;
  const filter = parseFilter(read('local', FILTER_KEY));
  const sort = parseSort(read('local', SORT_KEY));
  if (filter !== 'all' || sort !== 'created')
    await setView(f, { filter, sort }, false);
}

function start(
  feed: HTMLElement,
  list: HTMLElement,
  status: HTMLElement,
): void {
  const f = newFeed(feed, list, status);
  f.next = readNext(f);
  // With JavaScript the browser loads more, the pager is only the way out without.
  if (f.pager) f.pager.hidden = true;
  if (f.next !== null) f.observer.observe(f.sentinel);
  f.filterNav?.addEventListener('click', (event) => onNavClick(f, event));
  f.sortNav?.addEventListener('click', (event) => onNavClick(f, event));
  // Remember the position when leaving, restore it when coming back.
  history.scrollRestoration = 'manual';
  window.addEventListener('pagehide', () => {
    write(
      'session',
      POSITION_KEY,
      JSON.stringify({
        path: location.pathname,
        loaded: f.loaded,
        y: window.scrollY,
      }),
    );
  });
  const banner = feed.querySelector<HTMLElement>('[data-live-banner]');
  if (banner) startLive({ list, banner, showTop: (path) => showTop(f, path) });
  void restoreOrFilter(f);
}

const feed = document.querySelector<HTMLElement>('[data-feed]');
const list = feed?.querySelector<HTMLElement>('[data-feed-list]');
const status = feed?.querySelector<HTMLElement>('[data-feed-status]');
if (feed && list && status) start(feed, list, status);
