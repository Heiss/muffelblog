// Notes in the margin (comments, footnotes) stand next to their paragraph on a
// wide screen and below it on a narrow one, where they are closed until opened.
// Without JavaScript they stay open below the paragraph.
const narrow = window.matchMedia('(max-width: 1099px)');

function apply(): void {
  for (const details of document.querySelectorAll<HTMLDetailsElement>(
    'aside.margin-note > details',
  ))
    details.open = !narrow.matches;
}

apply();
narrow.addEventListener('change', apply);
