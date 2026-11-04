// Remark42 widget from the own comments host. The configuration goes through
// a global that the widget reads, set here because inline scripts are forbidden
// by the Content Security Policy.
import { THEMES } from '../lib/themes';

interface RemarkConfig {
  host: string;
  site_id: string;
  url: string;
  components: string[];
  theme: 'light' | 'dark';
  locale: string;
}

const section = document.querySelector<HTMLElement>('[data-comments]');

if (section) {
  section.querySelector('[data-comments-nojs]')?.remove();
  const error = section.querySelector<HTMLElement>('[data-comments-error]');
  const host = section.dataset.host ?? '';
  const themeId = document.documentElement.getAttribute('data-theme');
  const dark = THEMES.find((t) => t.id === themeId)?.dark ?? false;
  const config: RemarkConfig = {
    host,
    site_id: section.dataset.siteId ?? '',
    // The canonical address when the domain is known, so comments survive a
    // change of the address the page is reached by.
    url: section.dataset.url || `${location.origin}${location.pathname}`,
    components: ['embed'],
    theme: dark ? 'dark' : 'light',
    locale: section.dataset.locale || 'de',
  };
  (window as unknown as { remark_config: RemarkConfig }).remark_config = config;

  const script = document.createElement('script');
  script.src = `${host}/web/embed.js`;
  script.async = true;
  // The widget shows the same comments, so the static copy steps aside once it is loaded.
  script.onload = () => {
    section
      .querySelector<HTMLElement>('[data-comments-static]')
      ?.setAttribute('hidden', '');
  };
  script.onerror = () => {
    if (error) {
      error.textContent = section.dataset.error ?? '';
      error.hidden = false;
    }
  };
  document.head.append(script);
}
