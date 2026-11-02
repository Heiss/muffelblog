import { parse } from 'yaml';

/** Byte-Order-Marke, die manche Editoren an den Dateianfang setzen. */
const BOM = String.fromCharCode(0xfeff);

export type SplitResult =
  | { ok: true; data: Record<string, unknown>; body: string }
  | { ok: false; error: string };

/** Trennt das YAML-Frontmatter vom Text einer Markdown-Datei. */
export function splitFrontmatter(roh: string): SplitResult {
  const text = (roh.startsWith(BOM) ? roh.slice(1) : roh).replace(
    /\r\n?/g,
    '\n',
  );
  if (!text.startsWith('---\n')) {
    return { ok: true, data: {}, body: text };
  }

  const zeilen = text.split('\n');
  const ende = zeilen.indexOf('---', 1);
  if (ende === -1) {
    return { ok: false, error: 'Die schließende Trennlinie "---" fehlt' };
  }

  const yamlText = zeilen.slice(1, ende).join('\n');
  const body = zeilen.slice(ende + 1).join('\n');

  let wert: unknown;
  try {
    wert = parse(yamlText, { logLevel: 'error' });
  } catch (fehler) {
    const meldung =
      fehler instanceof Error ? fehler.message.split('\n')[0] : String(fehler);
    return { ok: false, error: `Ungültiges YAML (${meldung})` };
  }

  if (wert === null || wert === undefined) return { ok: true, data: {}, body };
  if (typeof wert !== 'object' || Array.isArray(wert)) {
    return { ok: false, error: 'Das Frontmatter ist kein Objekt' };
  }
  return { ok: true, data: wert as Record<string, unknown>, body };
}
