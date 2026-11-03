/**
 * First letter of a term for the letter view: upper case, umlauts and other
 * accents under the base letter, everything else (digits, special characters)
 * under `#`.
 */
export function letterOf(term: string): string {
  const base = term
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/^[^\p{L}\p{N}]+/u, '');
  const first = base.charAt(0).replace('ß', 's').toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

export interface LetterGroup<T> {
  letter: string;
  items: T[];
}

const collator = new Intl.Collator('de', {
  sensitivity: 'base',
  numeric: true,
});

/** Groups terms by letter (A to Z, then `#`) and sorts them inside a letter. */
export function groupByLetter<T extends { title: string }>(
  terms: readonly T[],
): LetterGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const term of terms) {
    const letter = letterOf(term.title);
    const list = groups.get(letter) ?? [];
    list.push(term);
    groups.set(letter, list);
  }
  const rank = (letter: string) => (letter === '#' ? '￿' : letter);
  return [...groups.entries()]
    .sort(([a], [b]) => (rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : 0))
    .map(([letter, items]) => ({
      letter,
      items: [...items].sort(
        (a, b) =>
          collator.compare(a.title, b.title) || a.title.localeCompare(b.title),
      ),
    }));
}
