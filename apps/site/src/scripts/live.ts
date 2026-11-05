import { messages } from '../i18n/messages';
import { createLive, parseLive, scopeFor } from './live-logic';
import type { LiveList } from './live-logic';

const INTERVAL_MS = 60_000;

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(path, {
    cache: 'no-cache',
    credentials: 'same-origin',
    redirect: 'error',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * The banner "N new entries". It asks `/build.json` once a minute, only while the
 * tab is visible. When the build changed it reads `/entries.json` once and
 * counts the entries that are newer than the newest one in the list. A click
 * shows the first block at the top.
 */
export function startLive(options: {
  list: HTMLElement;
  banner: HTMLElement;
  showTop: (path: string) => Promise<void>;
}): void {
  const { list, banner, showTop } = options;
  const button = banner.querySelector('button');
  if (!button) return;

  const live = createLive({
    getBuild: async () => {
      try {
        const json = (await getJson('/build.json')) as { id?: unknown };
        return typeof json.id === 'string' ? json.id : null;
      } catch {
        return null;
      }
    },
    getEntries: async (): Promise<LiveList | null> => {
      try {
        return parseLive(await getJson('/entries.json'));
      } catch {
        return null;
      }
    },
    loaded: () =>
      [...list.querySelectorAll<HTMLElement>('article[data-id]')]
        .map((el) => ({
          id: el.dataset.id ?? '',
          date: el.querySelector('time')?.getAttribute('datetime') ?? '',
        }))
        .filter((l) => l.id !== '' && l.date !== ''),
    scope: () => scopeFor(location.pathname),
    show: ({ count, more }) => {
      button.textContent = more
        ? messages.live.more(count)
        : count === 1
          ? messages.live.one
          : messages.live.many(count);
      banner.hidden = false;
    },
  });

  button.addEventListener('click', () => {
    banner.hidden = true;
    void showTop(location.pathname);
  });

  const visible = () => document.visibilityState === 'visible';
  void live.poll();
  window.setInterval(() => {
    if (visible()) void live.poll();
  }, INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (visible()) void live.poll();
  });
}
