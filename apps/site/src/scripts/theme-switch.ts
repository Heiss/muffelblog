import { THEME_STORAGE_KEY, isThemeId } from '../lib/themes';

const huelle = document.querySelector<HTMLElement>('[data-theme-switch]');
const auswahl = document.querySelector<HTMLSelectElement>(
  '[data-theme-select]',
);

if (huelle && auswahl) {
  // Ohne JavaScript bleibt der Umschalter verborgen, er hätte keine Wirkung.
  huelle.hidden = false;
  const aktuell = document.documentElement.getAttribute('data-theme');
  if (isThemeId(aktuell)) auswahl.value = aktuell;

  auswahl.addEventListener('change', () => {
    if (!isThemeId(auswahl.value)) return;
    document.documentElement.setAttribute('data-theme', auswahl.value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, auswahl.value);
    } catch {
      /* ohne Speicher gilt die Wahl nur für diese Seite */
    }
  });
}
