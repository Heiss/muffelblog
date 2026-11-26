// The term filter of the glossary (layout W24): shows the terms whose name or
// short definition contains the words, and only the letters that still have
// terms. Without JavaScript the field stays hidden and the whole list shows.
const box = document.querySelector<HTMLElement>('[data-term-filter]');
const input = box?.querySelector('input');

function filterTerms(words: string): void {
  const needle = words.trim().toLocaleLowerCase();
  for (const group of document.querySelectorAll<HTMLElement>('.letter-group')) {
    let visible = 0;
    for (const item of group.querySelectorAll<HTMLElement>('li')) {
      const match =
        needle === '' ||
        (item.textContent ?? '').toLocaleLowerCase().includes(needle);
      item.hidden = !match;
      if (match) visible += 1;
    }
    group.hidden = visible === 0;
  }
}

if (box && input) {
  box.hidden = false;
  input.addEventListener('input', () => filterTerms(input.value));
}

export {};
