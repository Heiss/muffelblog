// The frame on phones (layout W24): the menu and the search slide in from the
// right. Without JavaScript the menu opens through its anchor (#site-menu,
// CSS :target) and the search tab leads to the search page.
import { startSearch } from './search';

const phone = window.matchMedia('(max-width: 899px)');
const root = document.documentElement;
const menuTab = document.querySelector<HTMLAnchorElement>(
  '.bottombar [data-quick="menu"]',
);
const searchTab = document.querySelector<HTMLAnchorElement>(
  '.bottombar [data-quick="search"]',
);
const panel = document.querySelector<HTMLElement>('[data-search-panel]');

function setMenu(open: boolean): void {
  root.classList.toggle('menu-open', open);
  menuTab?.setAttribute('aria-expanded', String(open));
  if (open) setSearch(false);
  if (open)
    document.querySelector<HTMLElement>('#site-menu .side-nav a')?.focus();
}

function setSearch(open: boolean): void {
  if (!panel) return;
  panel.hidden = !open;
  searchTab?.setAttribute('aria-expanded', String(open));
  if (!open) return;
  setMenu(false);
  const box = panel.querySelector<HTMLElement>('[data-search]');
  if (box) startSearch(box);
  panel.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
}

function closeAll(): void {
  if (root.classList.contains('menu-open')) menuTab?.focus();
  setMenu(false);
  setSearch(false);
  if (location.hash === '#site-menu') history.replaceState(null, '', ' ');
}

menuTab?.setAttribute('aria-expanded', 'false');
menuTab?.addEventListener('click', (event) => {
  event.preventDefault();
  setMenu(!root.classList.contains('menu-open'));
});
for (const close of document.querySelectorAll(
  '[data-menu-close], .menu-backdrop',
))
  close.addEventListener('click', (event) => {
    event.preventDefault();
    closeAll();
  });

if (panel && searchTab) {
  searchTab.setAttribute('aria-expanded', 'false');
  searchTab.addEventListener('click', (event) => {
    if (!phone.matches) return;
    event.preventDefault();
    setSearch(panel.hidden === true);
  });
  panel.querySelector('[data-search-close]')?.addEventListener('click', () => {
    setSearch(false);
    searchTab.focus();
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAll();
});
// On a wide screen the sidebar is no menu and the panel has no place.
phone.addEventListener('change', () => {
  if (!phone.matches) closeAll();
});
