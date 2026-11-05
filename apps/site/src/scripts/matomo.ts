// Statistics with the operator's own Matomo, only when the build set it up
// (MATOMO_URL, MATOMO_SITE_ID). A module from the own host, no inline script.
import { matomoCommands } from '../lib/matomo';

const el = document.querySelector<HTMLElement>('[data-matomo]');
const base = el?.dataset.url;
const siteId = el?.dataset.site;
if (base && siteId) {
  const w = window as unknown as { _paq?: unknown[][] };
  w._paq = w._paq ?? [];
  for (const command of matomoCommands({ base, siteId })) w._paq.push(command);
  const script = document.createElement('script');
  script.async = true;
  script.src = `${base}matomo.js`;
  document.head.append(script);
}
