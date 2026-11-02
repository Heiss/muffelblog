/**
 * Richtlinie für Inhalte von Drittseiten in Artikeln.
 *
 * Die Seite lädt sonst nichts von fremden Servern. Artikel dürfen genau diese
 * Bild-Hosts und Einbettungen verwenden. Memo-Bilder sind davon ausgenommen,
 * sie werden auf die eigene Domain gespiegelt.
 * Dieselben Listen speist später die Content-Security-Policy des Servers.
 */

/** Hosts, von denen Artikel Remote-Bilder laden dürfen (nur https). */
export const ALLOWED_IMAGE_HOSTS = [
  'upload.wikimedia.org',
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
] as const;

export interface EmbedRule {
  host: string;
  label: string;
  /** Erlaubter Pfad der Einbettungs-Adresse, ohne Parameter. */
  path: RegExp;
  /** Adresse, unter der man den Inhalt auf der Ursprungsseite öffnet. */
  openUrl: (url: URL) => string;
}

export const EMBED_RULES: readonly EmbedRule[] = [
  {
    host: 'www.youtube-nocookie.com',
    label: 'YouTube',
    path: /^\/embed\/[A-Za-z0-9_-]{11}$/,
    openUrl: (url) =>
      `https://www.youtube.com/watch?v=${url.pathname.split('/').pop() ?? ''}`,
  },
];

function parseHttps(wert: string): URL | null {
  let url: URL;
  try {
    url = new URL(wert);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '' || url.port !== '')
    return null;
  return url;
}

/** Ist das ein https-Bild von einem freigegebenen Host? */
export function isAllowedImageUrl(wert: string): boolean {
  const url = parseHttps(wert);
  if (url === null) return false;
  return (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(url.hostname);
}

export interface EmbedMatch {
  label: string;
  /** Die geprüfte, normalisierte Einbettungs-Adresse. */
  src: string;
  openUrl: string;
}

/**
 * Prüft eine Einbettungs-Adresse streng gegen die Regeln: https, genauer Host,
 * genauer Pfad, keine Parameter, keine Zugangsdaten. Alles andere liefert null.
 */
export function matchEmbed(wert: string): EmbedMatch | null {
  const url = parseHttps(wert.trim());
  if (url === null) return null;
  // Die Adresse muss schon normalisiert gewesen sein (kein ../, keine Umkodierung).
  if (url.href !== wert.trim()) return null;
  if (url.search !== '' || url.hash !== '') return null;
  for (const regel of EMBED_RULES) {
    if (url.hostname === regel.host && regel.path.test(url.pathname)) {
      return { label: regel.label, src: url.href, openUrl: regel.openUrl(url) };
    }
  }
  return null;
}
