import { THEME_STORAGE_KEY, isThemeId } from '../lib/themes';

const wrapper = document.querySelector<HTMLElement>('[data-theme-switch]');
const select = document.querySelector<HTMLSelectElement>('[data-theme-select]');

if (wrapper && select) {
  // Without JavaScript the switcher stays hidden, it would have no effect.
  wrapper.hidden = false;
  const current = document.documentElement.getAttribute('data-theme');
  if (isThemeId(current)) select.value = current;

  select.addEventListener('change', () => {
    if (!isThemeId(select.value)) return;
    document.documentElement.setAttribute('data-theme', select.value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, select.value);
    } catch {
      /* without storage the choice applies only to this page */
    }
  });
}
