// Webmentions from the command line, inside the builder container:
//   docker/webmentions.sh list            sent, failed and given-up pairs
//   docker/webmentions.sh send-existing   send the existing entries on purpose
import { readSettings } from '@muffelblog/core';
import path from 'node:path';
import { createWebmentionRunner, loadState } from './webmentions.ts';

const settings = readSettings();
const stateDir = process.env.STATE_DIR || '/data/state';
const releasesDir = process.env.RELEASES_DIR || '/data/releases';
const command = process.argv[2];

if (command === 'list') {
  const state = await loadState(
    path.join(stateDir, 'webmentions.json'),
    console.error,
  );
  const pairs = Object.values(state.pairs).sort((a, b) =>
    b.lastAttemptAt.localeCompare(a.lastAttemptAt),
  );
  if (!state.initialized)
    console.log('Nothing yet: the first start has not happened.');
  for (const p of pairs) {
    console.log(
      `${p.lastAttemptAt}  ${p.status.padEnd(11)} ${p.reason.padEnd(8)} ${p.source} -> ${p.target}${p.error ? `  (${p.error})` : ''}`,
    );
  }
  console.log(
    `${pairs.length} pairs, ${Object.keys(state.entries).length} entries known`,
  );
} else if (command === 'send-existing') {
  if (!settings.webmentionsSend) {
    console.error(
      'Sending is off. Set MUFFEL_WEBMENTIONS_SEND=1 in .env and recreate the builder first.',
    );
    process.exit(1);
  }
  const siteUrl = process.env.SITE_URL?.trim() ?? '';
  try {
    new URL(siteUrl);
  } catch {
    console.error('SITE_URL is needed (the address of the blog).');
    process.exit(1);
  }
  await createWebmentionRunner({
    releasesDir,
    stateDir,
    settings,
    siteUrl,
    alert: async () => {},
    onSummary: () => {},
    log: (line) => console.log(line),
  }).run({ sendExisting: true });
} else {
  console.error('commands: list | send-existing');
  process.exit(2);
}
