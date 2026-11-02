import { matchEmbed } from '@muffelblog/core/policy';

/** Ersetzt den Platzhalter durch das eingebettete Element, erst nach dem Klick. */
function starten(container: HTMLElement): void {
  const treffer = matchEmbed(container.dataset.embedSrc ?? '');
  if (treffer === null) return;

  const frame = document.createElement('iframe');
  frame.src = treffer.src;
  frame.title = `${treffer.label}: eingebetteter Inhalt`;
  frame.className = 'embed-frame';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer';
  frame.allowFullscreen = true;
  frame.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-presentation',
  );
  container.replaceChildren(frame);
}

document.addEventListener('click', (ereignis) => {
  const ziel = ereignis.target;
  if (!(ziel instanceof Element)) return;
  const knopf = ziel.closest('.embed-start');
  const container = knopf?.closest<HTMLElement>('.embed');
  if (container) starten(container);
});
