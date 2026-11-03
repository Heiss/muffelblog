// Search on the own domain: the Pagefind index is part of the build output and
// is loaded from /pagefind/. No foreign request. All texts come from the page.
import { excerptParts, searchFilters, summaryText } from './search-logic';

interface PagefindResult {
  id: string;
  data(): Promise<{
    url: string;
    excerpt: string;
    meta: { title?: string };
  }>;
}
interface PagefindResponse {
  results: PagefindResult[];
  filters: Record<string, Record<string, number>>;
}
interface Pagefind {
  options(o: { baseUrl: string }): Promise<void>;
  filters(): Promise<unknown>;
  search(
    term: string,
    o?: { filters?: Record<string, string> },
  ): Promise<PagefindResponse>;
}

const MAX_RESULTS = 20;
// A variable keeps TypeScript and the bundler from resolving the build output.
const PAGEFIND_URL: string = '/pagefind/pagefind.js';
const root = document.querySelector<HTMLElement>('[data-search]');

function el<T extends HTMLElement>(host: HTMLElement, name: string): T {
  const found = host.querySelector<T>(`[data-search-${name}]`);
  if (!found) throw new Error(`missing element data-search-${name}`);
  return found;
}

async function start(host: HTMLElement): Promise<void> {
  const input = el<HTMLInputElement>(host, 'input');
  const kindBox = el(host, 'kind');
  const tagSelect = el<HTMLSelectElement>(host, 'tag');
  const summary = el(host, 'summary');
  const results = el(host, 'results');
  const error = el(host, 'error');
  const texts = {
    none: host.dataset.summaryNone ?? '',
    one: host.dataset.summaryOne ?? '',
    many: host.dataset.summaryMany ?? '',
  };
  const allLabel = host.dataset.labelAll ?? '';

  let pagefind: Pagefind;
  try {
    pagefind = (await import(/* @vite-ignore */ PAGEFIND_URL)) as Pagefind;
    await pagefind.options({ baseUrl: '/' });
    // Without this call searches do not report filter counts.
    await pagefind.filters();
  } catch {
    error.textContent = host.dataset.unavailable ?? '';
    error.hidden = false;
    host.hidden = false;
    return;
  }

  let kind = '';
  let run = 0;

  async function render(): Promise<void> {
    const term = input.value.trim();
    const mine = ++run;
    results.replaceChildren();
    if (term === '') {
      summary.textContent = '';
      kindBox.replaceChildren();
      tagSelect.hidden = true;
      return;
    }
    const response = await pagefind.search(term, {
      filters: searchFilters(kind, tagSelect.value),
    });
    // Unfiltered numbers for the buttons, so they do not vanish when chosen.
    const base = await pagefind.search(term);
    if (mine !== run) return;

    const order: string[] = JSON.parse(host.dataset.kindOrder ?? '[]');
    const counts = base.filters.kind ?? {};
    const kinds = order.filter((k) => (counts[k] ?? 0) > 0).map((k) => [k]);
    kindBox.replaceChildren(
      ...[['', allLabel] as const, ...kinds.map(([k]) => [k, k] as const)].map(
        ([value, label]) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = label;
          b.setAttribute('aria-pressed', String(value === kind));
          b.addEventListener('click', () => {
            kind = value;
            void render();
          });
          return b;
        },
      ),
    );

    const tags = Object.keys(base.filters.tag ?? {}).sort();
    const chosen = tagSelect.value;
    tagSelect.replaceChildren(new Option(allLabel, ''));
    for (const tag of tags) tagSelect.append(new Option(tag, tag));
    tagSelect.value = tags.includes(chosen) ? chosen : '';
    tagSelect.hidden = tags.length === 0;

    summary.textContent = summaryText(texts, response.results.length, term);
    const shown = await Promise.all(
      response.results.slice(0, MAX_RESULTS).map((r) => r.data()),
    );
    if (mine !== run) return;
    const list = document.createElement('ul');
    for (const item of shown) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.url;
      a.textContent = item.meta.title ?? item.url;
      const p = document.createElement('p');
      for (const part of excerptParts(item.excerpt)) {
        if (part.mark) {
          const m = document.createElement('mark');
          m.textContent = part.text;
          p.append(m);
        } else {
          p.append(part.text);
        }
      }
      li.append(a, p);
      list.append(li);
    }
    results.replaceChildren(list);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => void render(), 120);
  });
  tagSelect.addEventListener('change', () => void render());
  host.hidden = false;
}

if (root) {
  // The hint for visitors without JavaScript is plain text, scripts remove it.
  document.querySelector<HTMLElement>('[data-search-nojs]')?.remove();
  void start(root);
}
