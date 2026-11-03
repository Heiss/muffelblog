import { messages } from '../i18n/messages';
import { blockPath, freshIds, parseFilter, seriesPath } from './feed-logic';
import type { Filter } from './feed-logic';

const FILTER_KEY = 'muffel:filter';
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

function start(
  feed: HTMLElement,
  list: HTMLElement,
  status: HTMLElement,
): void {
  const pager = feed.querySelector<HTMLElement>('[data-pager]');

  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  feed.insertBefore(sentinel, status);

  let next: string | null = null;
  let loaded: string[] = [];
  let loading = false;
  let generation = 0;

  const existingIds = () =>
    new Set(
      [...list.querySelectorAll('[data-id]')].map(
        (el) => el.getAttribute('data-id') ?? '',
      ),
    );

  function readNext(): string | null {
    const href = pager?.querySelector('a[rel="next"]')?.getAttribute('href');
    return href ? blockPath(href, ORIGIN) : null;
  }

  function append(entries: Element[]): void {
    const fresh = new Set(
      freshIds(
        existingIds(),
        entries.map((el) => el.getAttribute('data-id') ?? ''),
      ),
    );
    for (const el of entries) {
      if (fresh.has(el.getAttribute('data-id') ?? '')) {
        fresh.delete(el.getAttribute('data-id') ?? '');
        list.append(document.importNode(el, true));
      }
    }
  }

  function showError(path: string): void {
    status.hidden = false;
    status.textContent = messages.feed.loadFailed;
    // The normal link stays as a way out.
    const link = document.createElement('a');
    link.href = path;
    link.rel = 'next';
    link.textContent = messages.feed.older;
    status.append(link);
  }

  function observe(): void {
    observer.unobserve(sentinel);
    if (next !== null && status.hidden) observer.observe(sentinel);
  }

  async function loadNext(): Promise<void> {
    if (loading || next === null) return;
    loading = true;
    const mine = generation;
    const path = next;
    try {
      const block = await fetchBlock(path);
      if (mine !== generation) return;
      append(block.entries);
      loaded.push(path);
      next = block.next;
      status.hidden = true;
    } catch {
      if (mine !== generation) return;
      showError(path);
      return;
    } finally {
      if (mine === generation) loading = false;
    }
    if (next === null) {
      observer.unobserve(sentinel);
    } else {
      observe();
    }
  }

  const observer = new IntersectionObserver(
    (hits) => {
      if (hits.some((t) => t.isIntersecting)) void loadNext();
    },
    { rootMargin: '600px 0px' },
  );

  function activate(): void {
    next = readNext();
    // With JavaScript the browser loads more, the pager is only the way out without.
    if (pager) pager.hidden = true;
    if (next !== null) observer.observe(sentinel);
  }

  // Filter: replaces the list with page 1 of the chosen series, without reloading.
  const filterNav = feed.querySelector<HTMLElement>('[data-filter]');

  function mark(filter: Filter): void {
    for (const a of filterNav?.querySelectorAll<HTMLElement>('a') ?? []) {
      if (a.dataset.filterId === filter) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  }

  async function setFilter(filter: Filter, persist: boolean): Promise<void> {
    const path = seriesPath(filter);
    generation += 1;
    loading = false;
    observer.unobserve(sentinel);
    status.hidden = true;
    try {
      const block = await fetchBlock(path);
      list.replaceChildren(
        ...block.entries.map((el) => document.importNode(el, true)),
      );
      next = block.next;
      loaded = [];
      document.title = block.title;
      history.replaceState(null, '', path);
      mark(filter);
      if (persist) write('local', FILTER_KEY, filter);
      window.scrollTo(0, 0);
      observe();
    } catch {
      // Without success the link acts like a normal link.
      location.assign(path);
    }
  }

  filterNav?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const a = target.closest<HTMLAnchorElement>('a[data-filter-id]');
    if (!a) return;
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    void setFilter(parseFilter(a.dataset.filterId), true);
  });

  // Remember the position when leaving, restore it when coming back.
  history.scrollRestoration = 'manual';
  window.addEventListener('pagehide', () => {
    write(
      'session',
      POSITION_KEY,
      JSON.stringify({
        path: location.pathname,
        loaded,
        y: window.scrollY,
      }),
    );
  });

  async function restore(): Promise<boolean> {
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    if (nav?.type !== 'back_forward' && nav?.type !== 'reload') return false;
    const raw = read('session', POSITION_KEY);
    if (!raw) return false;
    let remembered: { path?: unknown; loaded?: unknown; y?: unknown };
    try {
      remembered = JSON.parse(raw);
    } catch {
      return false;
    }
    if (
      remembered.path !== location.pathname ||
      !Array.isArray(remembered.loaded)
    )
      return false;
    for (const entry of remembered.loaded) {
      if (typeof entry !== 'string' || next !== entry) break;
      await loadNext();
      if (status.hidden === false) break;
    }
    if (typeof remembered.y === 'number' && Number.isFinite(remembered.y)) {
      window.scrollTo(0, remembered.y);
    }
    return true;
  }

  activate();

  void (async () => {
    // On `/` a stored filter wins. Series that were opened explicitly do not.
    const restored = await restore();
    if (restored) return;
    if (feed.dataset.series === 'all' && location.pathname === '/') {
      const stored = parseFilter(read('local', FILTER_KEY));
      if (stored !== 'all') await setFilter(stored, false);
    }
  })();
}

const feed = document.querySelector<HTMLElement>('[data-feed]');
const list = feed?.querySelector<HTMLElement>('[data-feed-list]');
const status = feed?.querySelector<HTMLElement>('[data-feed-status]');
if (feed && list && status) start(feed, list, status);
