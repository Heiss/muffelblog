// Notes in the margin (comments, footnotes) stand next to their paragraph on a
// wide screen and below it on a narrow one, where they are closed until opened.
// The band below the text (links, graph, related memos) is open on a wide
// screen and closed on a phone (layout W24). Without JavaScript both stay open.
const narrow = window.matchMedia('(max-width: 1099px)');
const phone = window.matchMedia('(max-width: 899px)');

function apply(): void {
  for (const details of document.querySelectorAll<HTMLDetailsElement>(
    'aside.margin-note > details',
  ))
    details.open = !narrow.matches;
}

function applyBand(): void {
  for (const band of document.querySelectorAll<HTMLDetailsElement>(
    'details.band',
  ))
    band.open = !phone.matches;
}

apply();
applyBand();
narrow.addEventListener('change', apply);
phone.addEventListener('change', applyBand);
