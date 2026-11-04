import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  NetError,
  isPublicAddress,
  safeFetch,
  type SafeFetchOptions,
} from './webmention-net.ts';

describe('isPublicAddress', () => {
  it('accepts ordinary public IPv4 and IPv6 addresses', () => {
    for (const ip of [
      '8.8.8.8',
      '1.1.1.1',
      '93.184.216.34',
      '172.15.255.255',
      '172.32.0.1',
      '100.63.255.255',
      '100.128.0.1',
      '2606:4700:4700::1111',
      '2a00:1450:4001:81b::200e',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });

  it('rejects loopback, private, link-local, shared and reserved IPv4', () => {
    for (const ip of [
      '0.0.0.0',
      '0.1.2.3',
      '10.0.0.1',
      '10.255.255.255',
      '100.64.0.1',
      '100.127.255.255',
      '127.0.0.1',
      '127.255.255.254',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.0.0.1',
      '192.0.2.1',
      '192.168.1.1',
      '198.18.0.1',
      '198.19.255.255',
      '198.51.100.7',
      '203.0.113.9',
      '224.0.0.1',
      '240.0.0.1',
      '255.255.255.255',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it('rejects loopback, unique local, link-local and reserved IPv6', () => {
    for (const ip of [
      '::',
      '::1',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'febf::1',
      'ff02::1',
      '2001:db8::1',
      '2001::1',
      '100::1',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it('checks the IPv4 address inside mapped, NAT64 and 6to4 IPv6 addresses', () => {
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:7f00:1')).toBe(false);
    expect(isPublicAddress('::ffff:10.1.2.3')).toBe(false);
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
    expect(isPublicAddress('64:ff9b::7f00:1')).toBe(false);
    expect(isPublicAddress('64:ff9b::808:808')).toBe(true);
    expect(isPublicAddress('2002:7f00:1::')).toBe(false);
    expect(isPublicAddress('2002:808:808::')).toBe(true);
  });

  it('rejects things that are no address', () => {
    for (const ip of [
      '',
      'localhost',
      '1.2.3',
      '1.2.3.4.5',
      '999.1.1.1',
      'x',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });
});

describe('safeFetch', () => {
  const servers: Server[] = [];
  afterEach(() => {
    for (const s of servers.splice(0)) s.close();
  });

  async function serve(
    handler: (
      req: IncomingMessage,
      res: import('node:http').ServerResponse,
    ) => void,
  ): Promise<string> {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const open: SafeFetchOptions = {
    timeoutMs: 2000,
    maxBytes: 1024,
    maxRedirects: 3,
    allowPrivate: true,
  };

  it('fetches a page, with status, final address and headers', async () => {
    const base = await serve((_req, res) => {
      res.setHeader('Link', '</wm>; rel="webmention"');
      res.end('hello');
    });
    const r = await safeFetch(`${base}/page`, {}, open);
    expect(r.status).toBe(200);
    expect(r.body).toBe('hello');
    expect(r.url).toBe(`${base}/page`);
    expect(r.headers.link).toBe('</wm>; rel="webmention"');
    expect(r.truncated).toBe(false);
  });

  it('sends a POST with a form body', async () => {
    let seen = '';
    let type = '';
    const base = await serve((req, res) => {
      type = String(req.headers['content-type']);
      req.on('data', (c) => (seen += c));
      req.on('end', () => {
        res.statusCode = 202;
        res.end();
      });
    });
    const r = await safeFetch(
      `${base}/wm`,
      {
        method: 'POST',
        body: 'source=a&target=b',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      },
      open,
    );
    expect(r.status).toBe(202);
    expect(seen).toBe('source=a&target=b');
    expect(type).toBe('application/x-www-form-urlencoded');
  });

  it('reads at most maxBytes and says so', async () => {
    const base = await serve((_req, res) => res.end('x'.repeat(5000)));
    const r = await safeFetch(`${base}/`, {}, { ...open, maxBytes: 100 });
    expect(r.body.length).toBe(100);
    expect(r.truncated).toBe(true);
  });

  it('stops after the time limit', async () => {
    const base = await serve(() => {
      /* never answers */
    });
    await expect(
      safeFetch(`${base}/`, {}, { ...open, timeoutMs: 150 }),
    ).rejects.toThrow(/time/i);
  });

  it('follows redirects up to the limit and reports the final address', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/a') {
        res.statusCode = 302;
        res.setHeader('Location', '/b');
        res.end();
      } else res.end('end');
    });
    const r = await safeFetch(`${base}/a`, {}, open);
    expect(r.body).toBe('end');
    expect(r.url).toBe(`${base}/b`);
  });

  it('gives up on too many redirects', async () => {
    const base = await serve((_req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', '/loop');
      res.end();
    });
    await expect(
      safeFetch(`${base}/loop`, {}, { ...open, maxRedirects: 2 }),
    ).rejects.toThrow(/redirect/i);
  });

  it('does not follow a redirect of a POST', async () => {
    const base = await serve((_req, res) => {
      res.statusCode = 307;
      res.setHeader('Location', '/elsewhere');
      res.end();
    });
    const r = await safeFetch(
      `${base}/`,
      { method: 'POST', body: 'a=b' },
      open,
    );
    expect(r.status).toBe(307);
  });

  it('refuses addresses that are not http or https, and credentials in the address', async () => {
    for (const url of [
      'file:///etc/passwd',
      'ftp://example.org/x',
      'gopher://example.org/',
      'javascript:alert(1)',
      'http://user:pw@example.org/',
      'not a url',
    ]) {
      await expect(safeFetch(url, {}, open), url).rejects.toBeInstanceOf(
        NetError,
      );
    }
  });

  it('refuses private and local addresses unless allowed', async () => {
    const base = await serve((_req, res) => res.end('secret'));
    const closed = { ...open, allowPrivate: false };
    await expect(safeFetch(`${base}/`, {}, closed)).rejects.toThrow(
      /not a public address/i,
    );
    await expect(safeFetch('http://localhost:1/', {}, closed)).rejects.toThrow(
      /not a public address/i,
    );
    await expect(safeFetch('http://[::1]:1/', {}, closed)).rejects.toThrow(
      /not a public address/i,
    );
    await expect(
      safeFetch('http://169.254.169.254/latest/meta-data/', {}, closed),
    ).rejects.toThrow(/not a public address/i);
  });

  it('checks every address of a host name and uses exactly the checked one', async () => {
    const closed = { ...open, allowPrivate: false };
    // One public and one private address: the host is refused as a whole.
    await expect(
      safeFetch(
        'http://mixed.example.test/',
        {},
        {
          ...closed,
          resolve: async () => [
            { address: '93.184.216.34', family: 4 },
            { address: '10.0.0.5', family: 4 },
          ],
        },
      ),
    ).rejects.toThrow(/not a public address/i);
  });

  it('checks the address again after a redirect', async () => {
    const base = await serve((_req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', 'http://169.254.169.254/');
      res.end();
    });
    // The first hop is allowed by name, the second goes to a metadata address.
    await expect(
      safeFetch(
        `${base}/`,
        {},
        {
          ...open,
          allowPrivate: false,
          resolve: async (host) =>
            host === '127.0.0.1'
              ? [{ address: '8.8.8.8', family: 4 }]
              : [{ address: host, family: 4 }],
          // connect to the local server although the checked address is public
          connectAddress: () => '127.0.0.1',
        },
      ),
    ).rejects.toThrow(/not a public address/i);
  });

  it('refuses a redirect to another scheme', async () => {
    const base = await serve((_req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', 'file:///etc/passwd');
      res.end();
    });
    await expect(safeFetch(`${base}/`, {}, open)).rejects.toBeInstanceOf(
      NetError,
    );
  });
});
