import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  NetError,
  isPublicAddress,
  safeFetch,
  type SafeFetchOptions,
} from './webmention-net.ts';

// Exact borders of the address rules and the exact behaviour of safeFetch.

describe('isPublicAddress: borders of every IPv4 range', () => {
  const ranges: [string, string, string, string][] = [
    // last public before, first and last inside, first public after
    ['', '0.0.0.0', '0.255.255.255', '1.0.0.0'],
    ['9.255.255.255', '10.0.0.0', '10.255.255.255', '11.0.0.0'],
    ['100.63.255.255', '100.64.0.0', '100.127.255.255', '100.128.0.0'],
    ['126.255.255.255', '127.0.0.0', '127.255.255.255', '128.0.0.0'],
    ['169.253.255.255', '169.254.0.0', '169.254.255.255', '169.255.0.0'],
    ['172.15.255.255', '172.16.0.0', '172.31.255.255', '172.32.0.0'],
    ['191.255.255.255', '192.0.0.0', '192.0.0.255', '192.0.1.0'],
    ['192.0.1.255', '192.0.2.0', '192.0.2.255', '192.0.3.0'],
    ['192.167.255.255', '192.168.0.0', '192.168.255.255', '192.169.0.0'],
    ['198.17.255.255', '198.18.0.0', '198.19.255.255', '198.20.0.0'],
    ['198.51.99.255', '198.51.100.0', '198.51.100.255', '198.51.101.0'],
    ['203.0.112.255', '203.0.113.0', '203.0.113.255', '203.0.114.0'],
    ['223.255.255.255', '224.0.0.0', '255.255.255.255', ''],
  ];
  it.each(ranges)('%s | %s .. %s | %s', (before, first, last, after) => {
    if (before !== '') expect(isPublicAddress(before), before).toBe(true);
    expect(isPublicAddress(first), first).toBe(false);
    expect(isPublicAddress(last), last).toBe(false);
    if (after !== '') expect(isPublicAddress(after), after).toBe(true);
  });
});

describe('isPublicAddress: IPv6', () => {
  it('reads every group, also in the compressed and dotted forms', () => {
    expect(isPublicAddress('2606:4700:4700:0:0:0:0:1111')).toBe(true);
    expect(isPublicAddress('2606:4700::1111')).toBe(true);
    expect(isPublicAddress('::2606:4700')).toBe(false);
    expect(isPublicAddress('fe80::1%eth0')).toBe(false);
    expect(isPublicAddress('2606:4700::1111%1')).toBe(true);
  });

  it('decides by the embedded IPv4 address of mapped and NAT64 forms', () => {
    expect(isPublicAddress('::ffff:1.2.3.4')).toBe(true);
    expect(isPublicAddress('::ffff:192.168.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:c0a8:1')).toBe(false);
    expect(isPublicAddress('::fffe:10.0.0.1')).toBe(true);
    expect(isPublicAddress('1::ffff:8.8.8.8')).toBe(true);
    expect(isPublicAddress('64:ff9b::8.8.8.8')).toBe(true);
    expect(isPublicAddress('64:ff9b::10.0.0.1')).toBe(false);
    expect(isPublicAddress('64:ff9a::8.8.8.8')).toBe(true);
    expect(isPublicAddress('65:ff9b::10.0.0.1')).toBe(true);
    expect(isPublicAddress('64:ff9b:1::10.0.0.1')).toBe(true);
    expect(isPublicAddress('2002:a00:1::')).toBe(false);
    expect(isPublicAddress('2003:a00:1::')).toBe(true);
  });

  it('rejects the old IPv4-compatible form, also with a public address', () => {
    expect(isPublicAddress('::8.8.8.8')).toBe(false);
    expect(isPublicAddress('::1:0')).toBe(false);
    expect(isPublicAddress('::1:0:0')).toBe(true);
    expect(isPublicAddress('::1:0:0:0')).toBe(true);
  });

  it('knows the borders of the special prefixes', () => {
    expect(isPublicAddress('100::')).toBe(false);
    expect(isPublicAddress('100:0:0:1::')).toBe(true);
    expect(isPublicAddress('101::')).toBe(true);
    expect(isPublicAddress('2001::')).toBe(false);
    expect(isPublicAddress('2001:1::')).toBe(true);
    expect(isPublicAddress('2001:db8:ffff::')).toBe(false);
    expect(isPublicAddress('2001:db9::')).toBe(true);
    expect(isPublicAddress('2000:db8::')).toBe(true);
    expect(isPublicAddress('fbff::')).toBe(true);
    expect(isPublicAddress('fdff::')).toBe(false);
    expect(isPublicAddress('fe00::')).toBe(true);
    expect(isPublicAddress('fe7f::')).toBe(true);
    expect(isPublicAddress('febf::')).toBe(false);
    expect(isPublicAddress('fec0::')).toBe(true);
    expect(isPublicAddress('feff::')).toBe(true);
    expect(isPublicAddress('ff00::')).toBe(false);
  });
});

describe('NetError', () => {
  it('carries its own name', () => {
    expect(new NetError('x').name).toBe('NetError');
  });
});

describe('safeFetch: exact behaviour', () => {
  const servers: Server[] = [];
  afterEach(() => {
    for (const s of servers.splice(0)) s.close();
  });

  async function serve(
    handler: (url: string, res: ServerResponse, headers: object) => void,
  ): Promise<{ base: string; port: number }> {
    const server = createServer((req, res) =>
      handler(req.url ?? '', res, { ...req.headers, method: req.method }),
    );
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const port = (server.address() as AddressInfo).port;
    return { base: `http://127.0.0.1:${port}`, port };
  }

  const open: SafeFetchOptions = {
    timeoutMs: 2000,
    maxBytes: 1024,
    maxRedirects: 3,
    allowPrivate: true,
  };

  const messageOf = (promise: Promise<unknown>) =>
    promise.then(
      () => 'no error',
      (error: Error) => `${error.name}: ${error.message}`,
    );

  it('names a broken address, a wrong scheme and credentials exactly', async () => {
    expect(await messageOf(safeFetch(`x${'y'.repeat(200)}`, {}, open))).toBe(
      `NetError: Not an address: "x${'y'.repeat(99)}"`,
    );
    expect(await messageOf(safeFetch('ftp://a.example/', {}, open))).toBe(
      'NetError: Only http and https are allowed, not "ftp:"',
    );
    expect(await messageOf(safeFetch('http://u@a.example/', {}, open))).toBe(
      'NetError: An address with a user name or password is refused',
    );
    expect(await messageOf(safeFetch('http://:p@a.example/', {}, open))).toBe(
      'NetError: An address with a user name or password is refused',
    );
  });

  it('accepts https and goes no further than the address check', async () => {
    expect(
      await messageOf(
        safeFetch('https://[::1]/', {}, { ...open, allowPrivate: false }),
      ),
    ).toBe('NetError: "::1" is not a public address (::1)');
  });

  it('says when a name cannot be resolved', async () => {
    const resolve = async () => [];
    expect(
      await messageOf(
        safeFetch('http://nowhere.test/', {}, { ...open, resolve }),
      ),
    ).toBe('NetError: Cannot resolve "nowhere.test"');
    const failing = async () => {
      throw new Error('dns');
    };
    expect(
      await messageOf(
        safeFetch('http://nowhere.test/', {}, { ...open, resolve: failing }),
      ),
    ).toBe('NetError: Cannot resolve "nowhere.test"');
  });

  it('sends its own headers and the length of a body', async () => {
    let seen: Record<string, unknown> = {};
    const { base } = await serve((_url, res, headers) => {
      seen = headers as Record<string, unknown>;
      res.end('ok');
    });
    await safeFetch(`${base}/`, { method: 'POST', body: 'ä=1' }, open);
    expect(seen['user-agent']).toBe(
      'Muffelblog-Webmention (+https://github.com/Heiss/muffelblog)',
    );
    expect(seen.accept).toBe('text/html, */*;q=0.1');
    expect(seen['content-length']).toBe('4');
    expect(seen.method).toBe('POST');
    await safeFetch(`${base}/`, { headers: { accept: 'x/y' } }, open);
    expect(seen.method).toBe('GET');
    expect(seen.accept).toBe('x/y');
    expect(seen['content-length']).toBeUndefined();
  });

  it('connects to the checked address of a resolved name', async () => {
    const { port } = await serve((_url, res) => res.end('pinned'));
    const resolve = async () => [{ address: '127.0.0.1', family: 4 }];
    const r = await safeFetch(
      `http://blog.example:${port}/`,
      {},
      { ...open, resolve },
    );
    expect(r.body).toBe('pinned');
    expect(r.url).toBe(`http://blog.example:${port}/`);
  });

  it('joins repeated headers and lowers their names', async () => {
    const { base } = await serve((_url, res) => {
      res.setHeader('X-Many', ['a', 'b']);
      res.end('');
    });
    const r = await safeFetch(`${base}/`, {}, open);
    expect(r.headers['x-many']).toBe('a, b');
    expect(r.status).toBe(200);
    expect(r.truncated).toBe(false);
  });

  it('keeps a body of exactly maxBytes whole, across several chunks', async () => {
    const { base } = await serve((_url, res) => {
      res.write('12');
      setTimeout(() => res.end('345'), 20);
    });
    const exact = await safeFetch(`${base}/`, {}, { ...open, maxBytes: 5 });
    expect(exact).toMatchObject({ body: '12345', truncated: false });
    const cut = await safeFetch(`${base}/`, {}, { ...open, maxBytes: 4 });
    expect(cut).toMatchObject({ body: '1234', truncated: true });
    const tiny = await safeFetch(`${base}/`, {}, { ...open, maxBytes: 2 });
    expect(tiny).toMatchObject({ body: '12', truncated: true });
  });

  it('says how long it waited', async () => {
    const { base } = await serve(() => undefined);
    expect(
      await messageOf(safeFetch(`${base}/`, {}, { ...open, timeoutMs: 80 })),
    ).toBe('NetError: Timeout after 80 ms');
  });

  it('reports a refused connection as NetError', async () => {
    const { base } = await serve(() => undefined);
    for (const s of servers.splice(0)) s.close();
    expect(await messageOf(safeFetch(`${base}/`, {}, open))).toMatch(
      /^NetError: .*ECONNREFUSED/,
    );
  });

  it('follows exactly maxRedirects redirects, for GET and HEAD', async () => {
    const { base } = await serve((url, res) => {
      const n = Number(url.slice(1));
      if (n > 0) {
        res.statusCode = 301;
        res.setHeader('Location', `/${n - 1}`);
      }
      res.end(`at ${n}`);
    });
    expect(
      (await safeFetch(`${base}/2`, {}, { ...open, maxRedirects: 2 })).body,
    ).toBe('at 0');
    expect(
      await messageOf(safeFetch(`${base}/3`, {}, { ...open, maxRedirects: 2 })),
    ).toBe('NetError: Too many redirects');
    const head = await safeFetch(
      `${base}/1`,
      { method: 'head' },
      { ...open, maxRedirects: 1 },
    );
    expect(head.url).toBe(`${base}/0`);
  });

  it('does not follow a redirect status without a location or of a POST', async () => {
    const { base } = await serve((url, res) => {
      res.statusCode = url === '/no-location' ? 302 : 303;
      if (url !== '/no-location') res.setHeader('Location', '/x');
      res.end('stay');
    });
    expect((await safeFetch(`${base}/no-location`, {}, open)).status).toBe(302);
    const post = await safeFetch(
      `${base}/p`,
      { method: 'POST', body: '' },
      open,
    );
    expect(post.status).toBe(303);
    expect(post.url).toBe(`${base}/p`);
  });

  it('does not follow other 3xx answers', async () => {
    const { base } = await serve((_url, res) => {
      res.statusCode = 304;
      res.setHeader('Location', '/x');
      res.end();
    });
    expect((await safeFetch(`${base}/`, {}, open)).status).toBe(304);
  });
});
