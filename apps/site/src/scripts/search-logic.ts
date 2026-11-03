export interface ExcerptPart {
  text: string;
  mark: boolean;
}

/**
 * Splits a Pagefind excerpt into plain text and highlighted parts. Only
 * `<mark>` is honored; all other markup is dropped, so the result can be put
 * into the page as text nodes without any HTML injection.
 */
export function excerptParts(html: string): ExcerptPart[] {
  const parts: ExcerptPart[] = [];
  let mark = false;
  // Tokens: <mark>, </mark>, any other tag (dropped) or text.
  for (const token of html.match(/<[^>]*>|[^<]+|</g) ?? []) {
    if (/^<mark\s*>$/i.test(token)) mark = true;
    else if (/^<\/mark\s*>$/i.test(token)) mark = false;
    else if (token.startsWith('<') && token.endsWith('>')) continue;
    else {
      const text = decode(token);
      if (text !== '') parts.push({ text, mark });
    }
  }
  return parts;
}

function decode(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Filter object for Pagefind: only values the visitor has chosen. */
export function searchFilters(
  kind: string,
  tag: string,
): Record<string, string> {
  const filters: Record<string, string> = {};
  if (kind) filters.kind = kind;
  if (tag) filters.tag = tag;
  return filters;
}

export interface SummaryTexts {
  none: string;
  one: string;
  many: string;
}

export function summaryText(
  texts: SummaryTexts,
  count: number,
  term: string,
): string {
  const template =
    count === 0 ? texts.none : count === 1 ? texts.one : texts.many;
  return template.replace('{count}', String(count)).replace('{term}', term);
}
