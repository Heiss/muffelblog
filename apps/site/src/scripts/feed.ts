import { blockPfad, frischeIds, parseFilter, reihePfad } from './feed-logic';
import type { Filter } from './feed-logic';

const FILTER_KEY = 'muffel:filter';
const POSITION_KEY = 'muffel:feed-position';
const ORIGIN = location.origin;

// Der Browser-Speicher ist optional: gesperrt oder voll heißt Standardwerte.
function lies(speicher: 'local' | 'session', key: string): string | null {
  try {
    return (speicher === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function schreibe(speicher: 'local' | 'session', key: string, wert: string) {
  try {
    (speicher === 'local' ? localStorage : sessionStorage).setItem(key, wert);
  } catch {
    /* ohne Speicher gelten die Standardwerte */
  }
}

interface Block {
  eintraege: Element[];
  weiter: string | null;
  titel: string;
}

async function holeBlock(pfad: string): Promise<Block> {
  const antwort = await fetch(pfad, {
    credentials: 'same-origin',
    redirect: 'error',
    headers: { accept: 'text/html' },
  });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
  const art = antwort.headers.get('content-type') ?? '';
  if (!art.startsWith('text/html')) throw new Error('kein HTML');
  const dok = new DOMParser().parseFromString(
    await antwort.text(),
    'text/html',
  );
  const eintraege = [
    ...dok.querySelectorAll('[data-feed-liste] > article[data-id]'),
  ];
  const href = dok
    .querySelector('[data-pager] a[rel="next"]')
    ?.getAttribute('href');
  return {
    eintraege,
    weiter: href ? blockPfad(href, ORIGIN) : null,
    titel: dok.title,
  };
}

function start(
  feed: HTMLElement,
  liste: HTMLElement,
  status: HTMLElement,
): void {
  const pager = feed.querySelector<HTMLElement>('[data-pager]');

  const wachposten = document.createElement('div');
  wachposten.setAttribute('aria-hidden', 'true');
  feed.insertBefore(wachposten, status);

  let weiter: string | null = null;
  let geladen: string[] = [];
  let laedt = false;
  let generation = 0;

  const vorhandeneIds = () =>
    new Set(
      [...liste.querySelectorAll('[data-id]')].map(
        (el) => el.getAttribute('data-id') ?? '',
      ),
    );

  function leseWeiter(): string | null {
    const href = pager?.querySelector('a[rel="next"]')?.getAttribute('href');
    return href ? blockPfad(href, ORIGIN) : null;
  }

  function anhaengen(eintraege: Element[]): void {
    const neu = new Set(
      frischeIds(
        vorhandeneIds(),
        eintraege.map((el) => el.getAttribute('data-id') ?? ''),
      ),
    );
    for (const el of eintraege) {
      if (neu.has(el.getAttribute('data-id') ?? '')) {
        neu.delete(el.getAttribute('data-id') ?? '');
        liste.append(document.importNode(el, true));
      }
    }
  }

  function zeigeFehler(pfad: string): void {
    status.hidden = false;
    status.textContent = 'Nachladen fehlgeschlagen. ';
    // Der normale Link bleibt als Ausweg.
    const link = document.createElement('a');
    link.href = pfad;
    link.rel = 'next';
    link.textContent = 'Ältere Einträge';
    status.append(link);
  }

  function beobachten(): void {
    beobachter.unobserve(wachposten);
    if (weiter !== null && status.hidden) beobachter.observe(wachposten);
  }

  async function ladeNaechsten(): Promise<void> {
    if (laedt || weiter === null) return;
    laedt = true;
    const meine = generation;
    const pfad = weiter;
    try {
      const block = await holeBlock(pfad);
      if (meine !== generation) return;
      anhaengen(block.eintraege);
      geladen.push(pfad);
      weiter = block.weiter;
      status.hidden = true;
    } catch {
      if (meine !== generation) return;
      zeigeFehler(pfad);
      return;
    } finally {
      if (meine === generation) laedt = false;
    }
    if (weiter === null) {
      beobachter.unobserve(wachposten);
    } else {
      beobachten();
    }
  }

  const beobachter = new IntersectionObserver(
    (treffer) => {
      if (treffer.some((t) => t.isIntersecting)) void ladeNaechsten();
    },
    { rootMargin: '600px 0px' },
  );

  function aktiviere(): void {
    weiter = leseWeiter();
    // Mit JavaScript lädt der Browser nach, der Pager ist nur der Ausweg ohne.
    if (pager) pager.hidden = true;
    if (weiter !== null) beobachter.observe(wachposten);
  }

  // Filter: ersetzt die Liste durch Seite 1 der gewählten Reihe, ohne neu zu laden.
  const filterNav = feed.querySelector<HTMLElement>('[data-filter]');

  function markiere(filter: Filter): void {
    for (const a of filterNav?.querySelectorAll<HTMLElement>('a') ?? []) {
      if (a.dataset.filterId === filter) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  }

  async function setzeFilter(
    filter: Filter,
    speichern: boolean,
  ): Promise<void> {
    const pfad = reihePfad(filter);
    generation += 1;
    laedt = false;
    beobachter.unobserve(wachposten);
    status.hidden = true;
    try {
      const block = await holeBlock(pfad);
      liste.replaceChildren(
        ...block.eintraege.map((el) => document.importNode(el, true)),
      );
      weiter = block.weiter;
      geladen = [];
      document.title = block.titel;
      history.replaceState(null, '', pfad);
      markiere(filter);
      if (speichern) schreibe('local', FILTER_KEY, filter);
      window.scrollTo(0, 0);
      beobachten();
    } catch {
      // Ohne Erfolg wirkt der Link wie ein normaler Link.
      location.assign(pfad);
    }
  }

  filterNav?.addEventListener('click', (ereignis) => {
    const ziel = ereignis.target;
    if (!(ziel instanceof Element)) return;
    const a = ziel.closest<HTMLAnchorElement>('a[data-filter-id]');
    if (!a) return;
    if (
      ereignis.defaultPrevented ||
      ereignis.button !== 0 ||
      ereignis.metaKey ||
      ereignis.ctrlKey ||
      ereignis.shiftKey ||
      ereignis.altKey
    )
      return;
    ereignis.preventDefault();
    void setzeFilter(parseFilter(a.dataset.filterId), true);
  });

  // Position beim Verlassen merken, beim Rücksprung wiederherstellen.
  history.scrollRestoration = 'manual';
  window.addEventListener('pagehide', () => {
    schreibe(
      'session',
      POSITION_KEY,
      JSON.stringify({
        pfad: location.pathname,
        geladen,
        y: window.scrollY,
      }),
    );
  });

  async function stelleWiederHer(): Promise<boolean> {
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    if (nav?.type !== 'back_forward' && nav?.type !== 'reload') return false;
    const roh = lies('session', POSITION_KEY);
    if (!roh) return false;
    let gemerkt: { pfad?: unknown; geladen?: unknown; y?: unknown };
    try {
      gemerkt = JSON.parse(roh);
    } catch {
      return false;
    }
    if (gemerkt.pfad !== location.pathname || !Array.isArray(gemerkt.geladen))
      return false;
    for (const eintrag of gemerkt.geladen) {
      if (typeof eintrag !== 'string' || weiter !== eintrag) break;
      await ladeNaechsten();
      if (status.hidden === false) break;
    }
    if (typeof gemerkt.y === 'number' && Number.isFinite(gemerkt.y)) {
      window.scrollTo(0, gemerkt.y);
    }
    return true;
  }

  aktiviere();

  void (async () => {
    // Auf `/` gewinnt ein gespeicherter Filter. Ausdrücklich aufgerufene Reihen nicht.
    const wiederhergestellt = await stelleWiederHer();
    if (wiederhergestellt) return;
    if (feed.dataset.reihe === 'alle' && location.pathname === '/') {
      const gespeichert = parseFilter(lies('local', FILTER_KEY));
      if (gespeichert !== 'alle') await setzeFilter(gespeichert, false);
    }
  })();
}

const feed = document.querySelector<HTMLElement>('[data-feed]');
const liste = feed?.querySelector<HTMLElement>('[data-feed-liste]');
const status = feed?.querySelector<HTMLElement>('[data-feed-status]');
if (feed && liste && status) start(feed, liste, status);
