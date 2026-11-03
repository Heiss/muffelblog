import { parse } from 'yaml';

/** Byte order mark that some editors put at the start of a file. */
const BOM = String.fromCharCode(0xfeff);

export type SplitResult =
  | { ok: true; data: Record<string, unknown>; body: string }
  | { ok: false; error: string };

/** Splits the YAML frontmatter from the text of a Markdown file. */
export function splitFrontmatter(raw: string): SplitResult {
  const text = (raw.startsWith(BOM) ? raw.slice(1) : raw).replace(
    /\r\n?/g,
    '\n',
  );
  if (!text.startsWith('---\n')) {
    return { ok: true, data: {}, body: text };
  }

  const lines = text.split('\n');
  const end = lines.indexOf('---', 1);
  if (end === -1) {
    return { ok: false, error: 'The closing separator "---" is missing' };
  }

  const yamlText = lines.slice(1, end).join('\n');
  const body = lines.slice(end + 1).join('\n');

  let value: unknown;
  try {
    value = parse(yamlText, { logLevel: 'error' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.split('\n')[0] : String(error);
    return { ok: false, error: `Invalid YAML (${message})` };
  }

  if (value === null || value === undefined)
    return { ok: true, data: {}, body };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'The frontmatter is not an object' };
  }
  return { ok: true, data: value as Record<string, unknown>, body };
}
