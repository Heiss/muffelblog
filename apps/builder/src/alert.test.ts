import { describe, expect, it } from 'vitest';
import { alertConfig, sendAlert } from './alert.ts';

const event = {
  kind: 'failed' as const,
  message: 'Nextcloud unreachable',
  at: '2026-11-04T10:00:00.000Z',
};

describe('alertConfig', () => {
  it('is off without a webhook', () => {
    expect(alertConfig({})).toBeUndefined();
    expect(alertConfig({ MUFFEL_ALERT_WEBHOOK: ' ' })).toBeUndefined();
  });

  it('reads the webhook, plain text by default', () => {
    expect(
      alertConfig({ MUFFEL_ALERT_WEBHOOK: 'https://ntfy.example/blog' }),
    ).toEqual({
      url: 'https://ntfy.example/blog',
      format: 'text',
    });
  });

  it('knows the json format', () => {
    expect(
      alertConfig({
        MUFFEL_ALERT_WEBHOOK: 'https://h.example/x',
        MUFFEL_ALERT_FORMAT: 'json',
      })?.format,
    ).toBe('json');
  });

  it('stops the build for a wrong address or format', () => {
    expect(() => alertConfig({ MUFFEL_ALERT_WEBHOOK: 'nonsense' })).toThrow(
      /MUFFEL_ALERT_WEBHOOK/,
    );
    expect(() =>
      alertConfig({ MUFFEL_ALERT_WEBHOOK: 'ftp://x.example' }),
    ).toThrow(/MUFFEL_ALERT_WEBHOOK/);
    expect(() =>
      alertConfig({
        MUFFEL_ALERT_WEBHOOK: 'https://h.example',
        MUFFEL_ALERT_FORMAT: 'xml',
      }),
    ).toThrow(/MUFFEL_ALERT_FORMAT/);
  });
});

describe('sendAlert', () => {
  function capture(status = 200) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('', { status });
    }) as unknown as typeof fetch;
    return { calls, fetcher };
  }

  it('posts plain text with a title (ntfy style)', async () => {
    const { calls, fetcher } = capture();
    await sendAlert(
      { url: 'https://ntfy.example/blog', format: 'text' },
      event,
      fetcher,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe('POST');
    expect(String(calls[0]?.init.body)).toContain('Nextcloud unreachable');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Title).toMatch(/Muffelblog/);
    expect(headers['Content-Type']).toMatch(/text\/plain/);
  });

  it('posts json with a text field (Slack style)', async () => {
    const { calls, fetcher } = capture();
    await sendAlert(
      { url: 'https://h.example/x', format: 'json' },
      event,
      fetcher,
    );
    const body = JSON.parse(String(calls[0]?.init.body)) as { text: string };
    expect(body.text).toContain('Nextcloud unreachable');
  });

  it('marks a recovery differently from a failure', async () => {
    const { calls, fetcher } = capture();
    await sendAlert(
      { url: 'https://h.example/x', format: 'json' },
      { ...event, kind: 'recovered', message: 'ok' },
      fetcher,
    );
    const failed = capture();
    await sendAlert(
      { url: 'https://h.example/x', format: 'json' },
      event,
      failed.fetcher,
    );
    expect(String(calls[0]?.init.body)).not.toBe(
      String(failed.calls[0]?.init.body),
    );
  });

  it('never throws: a broken webhook must not stop the builder', async () => {
    const down = (async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;
    await expect(
      sendAlert({ url: 'https://h.example', format: 'text' }, event, down),
    ).resolves.toBeUndefined();
    const bad = capture(500);
    await expect(
      sendAlert(
        { url: 'https://h.example', format: 'text' },
        event,
        bad.fetcher,
      ),
    ).resolves.toBeUndefined();
  });
});
