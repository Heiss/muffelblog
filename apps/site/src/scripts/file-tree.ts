// Buttons of the file tree: open or close every folder at once. Without
// JavaScript the buttons stay hidden and each folder opens by its own summary.
const controls = document.querySelector<HTMLElement>('[data-tree-controls]');

function setAll(open: boolean): void {
  for (const folder of document.querySelectorAll<HTMLDetailsElement>(
    '.file-tree details',
  ))
    folder.open = open;
}

if (controls) {
  controls
    .querySelector('[data-tree-open]')
    ?.addEventListener('click', () => setAll(true));
  controls
    .querySelector('[data-tree-close]')
    ?.addEventListener('click', () => setAll(false));
  controls.hidden = false;
}
