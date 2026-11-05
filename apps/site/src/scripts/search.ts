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

/** The elements and texts of the search page. */
interface SearchUi {
  host: HTMLElement;
  input: HTMLInputElement;
  kindBox: HTMLElement;
  tagSelect: HTMLSelectElement;
  summary: HTMLElement;
  results: HTMLElement;
  texts: { none: string; one: string; many: string };
  allLabel: string;
}

function searchUi(host: HTMLElement): SearchUi {
  return {
    host,
    input: el<HTMLInputElement>(host, 'input'),
    kindBox: el(host, 'kind'),
    tagSelect: el<HTMLSelectElement>(host, 'tag'),
    summary: el(host, 'summary'),
    results: el(host, 'results'),
    texts: {
      none: host.dataset.summaryNone ?? '',
      one: host.dataset.summaryOne ?? '',
      many: host.dataset.summaryMany ?? '',
    },
    allLabel: host.dataset.labelAll ?? '',
  };
}

async function loadPagefind(): Promise<Pagefind | null> {
  try {
    const pagefind = (await import(
      /* @vite-ignore */ PAGEFIND_URL
    )) as Pagefind;
    await pagefind.options({ baseUrl: '/' });
    // Without this call searches do not report filter counts.
    await pagefind.filters();
    return pagefind;
  } catch {
    return null;
  }
}

/** The kind buttons; a click chooses the kind and searches again. */
function kindButtons(
  ui: SearchUi,
  counts: Record<string, number>,
  chosen: string,
  choose: (kind: string) => void,
): HTMLButtonElement[] {
  const order: string[] = JSON.parse(ui.host.dataset.kindOrder ?? '[]');
  const kinds = order.filter((k) => (counts[k] ?? 0) > 0);
  return [['', ui.allLabel], ...kinds.map((k) => [k, k])].map(
    ([value, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label as string;
      b.setAttribute('aria-pressed', String(value === chosen));
      b.addEventListener('click', () => choose(value as string));
      return b;
    },
  );
}

/** The tag list, keeping the chosen tag when it still occurs. */
function fillTags(ui: SearchUi, tagCounts: Record<string, number>): void {
  const tags = Object.keys(tagCounts).sort();
  const chosen = ui.tagSelect.value;
  ui.tagSelect.replaceChildren(new Option(ui.allLabel, ''));
  for (const tag of tags) ui.tagSelect.append(new Option(tag, tag));
  ui.tagSelect.value = tags.includes(chosen) ? chosen : '';
  ui.tagSelect.hidden = tags.length === 0;
}

function excerptElement(excerpt: string): HTMLParagraphElement {
  const p = document.createElement('p');
  for (const part of excerptParts(excerpt)) {
    if (!part.mark) {
      p.append(part.text);
      continue;
    }
    const m = document.createElement('mark');
    m.textContent = part.text;
    p.append(m);
  }
  return p;
}

function resultList(
  shown: { url: string; meta: { title?: string }; excerpt: string }[],
): HTMLUListElement {
  const list = document.createElement('ul');
  for (const item of shown) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.url;
    a.textContent = item.meta.title ?? item.url;
    li.append(a, excerptElement(item.excerpt));
    list.append(li);
  }
  return list;
}

function clear(ui: SearchUi): void {
  ui.summary.textContent = '';
  ui.kindBox.replaceChildren();
  ui.tagSelect.hidden = true;
}

/** Searches as the visitor types; an older search never overwrites a newer one. */
function searcher(ui: SearchUi, pagefind: Pagefind) {
  let kind = '';
  let run = 0;
  const render = async (): Promise<void> => {
    const term = ui.input.value.trim();
    const mine = ++run;
    ui.results.replaceChildren();
    if (term === '') return clear(ui);
    const response = await pagefind.search(term, {
      filters: searchFilters(kind, ui.tagSelect.value),
    });
    // Unfiltered numbers for the buttons, so they do not vanish when chosen.
    const base = await pagefind.search(term);
    if (mine !== run) return;
    ui.kindBox.replaceChildren(
      ...kindButtons(ui, base.filters.kind ?? {}, kind, (value) => {
        kind = value;
        void render();
      }),
    );
    fillTags(ui, base.filters.tag ?? {});
    ui.summary.textContent = summaryText(
      ui.texts,
      response.results.length,
      term,
    );
    const shown = await Promise.all(
      response.results.slice(0, MAX_RESULTS).map((r) => r.data()),
    );
    if (mine === run) ui.results.replaceChildren(resultList(shown));
  };
  return render;
}

async function start(host: HTMLElement): Promise<void> {
  const ui = searchUi(host);
  const pagefind = await loadPagefind();
  if (pagefind === null) {
    const error = el(host, 'error');
    error.textContent = host.dataset.unavailable ?? '';
    error.hidden = false;
    host.hidden = false;
    return;
  }
  const render = searcher(ui, pagefind);
  let timer: ReturnType<typeof setTimeout> | undefined;
  ui.input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => void render(), 120);
  });
  ui.tagSelect.addEventListener('change', () => void render());
  host.hidden = false;
}

if (root) {
  // The hint for visitors without JavaScript is plain text, scripts remove it.
  document.querySelector<HTMLElement>('[data-search-nojs]')?.remove();
  void start(root);
}
