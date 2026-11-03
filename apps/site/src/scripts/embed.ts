import { matchEmbed } from '@muffelblog/core/policy';
import { messages } from '../i18n/messages';

/** Replaces the placeholder with the embedded element, only after the click. */
function start(container: HTMLElement): void {
  const match = matchEmbed(container.dataset.embedSrc ?? '');
  if (match === null) return;

  const frame = document.createElement('iframe');
  frame.src = match.src;
  frame.title = messages.embed.frameTitle(match.label);
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

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('.embed-start');
  const container = button?.closest<HTMLElement>('.embed');
  if (container) start(container);
});
