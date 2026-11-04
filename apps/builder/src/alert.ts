import type { AlertEvent } from './scheduler.ts';

export interface AlertConfig {
  url: string;
  /** `text`: plain body with a `Title` header (ntfy, Gotify bridges); `json`: `{"text": ...}` (Slack, Mattermost). */
  format: 'text' | 'json';
}

/** An optional webhook for reports. A wrong value stops the builder at the start. */
export function alertConfig(
  env: Record<string, string | undefined> = process.env,
): AlertConfig | undefined {
  const raw = env.MUFFEL_ALERT_WEBHOOK?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`MUFFEL_ALERT_WEBHOOK is not an address: ${raw}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(
      `MUFFEL_ALERT_WEBHOOK must start with http:// or https://: ${raw}`,
    );
  }
  const format = env.MUFFEL_ALERT_FORMAT?.trim() || 'text';
  if (format !== 'text' && format !== 'json') {
    throw new Error(`MUFFEL_ALERT_FORMAT must be "text" or "json": ${format}`);
  }
  return { url: url.href, format };
}

/**
 * Sends one report. It never throws: a broken channel is logged, it must not
 * stop the builder or hide the original problem.
 */
export async function sendAlert(
  config: AlertConfig,
  event: AlertEvent,
  doFetch: typeof fetch = fetch,
): Promise<void> {
  const title =
    event.kind === 'failed'
      ? 'Muffelblog: build failed'
      : 'Muffelblog: build works again';
  const text = `${title}\n${event.message}\n${event.at}`;
  try {
    const res = await doFetch(config.url, {
      method: 'POST',
      headers:
        config.format === 'json'
          ? { 'Content-Type': 'application/json' }
          : { 'Content-Type': 'text/plain; charset=utf-8', Title: title },
      body:
        config.format === 'json'
          ? JSON.stringify({ text })
          : `${event.message}\n${event.at}`,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok)
      console.error(`[builder] alert webhook answered ${res.status}`);
  } catch (error) {
    console.error(
      `[builder] alert webhook failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
