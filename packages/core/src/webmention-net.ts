import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

/** A request to a foreign server was refused or failed. The message is safe to log. */
export class NetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetError';
  }
}

// --- Addresses ---------------------------------------------------------------

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const numbers = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return numbers.every((n) => n >= 0 && n <= 255) ? numbers : null;
}

// Ranges that are not routable on the public internet (RFC 6890 and friends).
const NON_PUBLIC_IPV4: readonly [string, number][] = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 3], // multicast, reserved, broadcast
];

const ipv4Number = (parts: number[]): number =>
  parts.reduce((n, p) => n * 256 + p, 0);

const NON_PUBLIC_IPV4_RANGES = NON_PUBLIC_IPV4.map(([base, bits]) => ({
  base: ipv4Number(ipv4Parts(base) as number[]),
  size: 2 ** (32 - bits),
}));

/** True for an IPv4 address that is routable on the public internet. */
function isPublicIPv4(parts: number[]): boolean {
  const n = ipv4Number(parts);
  return !NON_PUBLIC_IPV4_RANGES.some(
    (r) => n >= r.base && n < r.base + r.size,
  );
}

/** Replaces a trailing dotted IPv4 part (`::ffff:1.2.3.4`) by two groups. */
function expandDottedTail(text: string): string | null {
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (!dotted) return text;
  const v4 = ipv4Parts(dotted[1] as string);
  if (!v4) return null;
  const hi = ((v4[0] as number) << 8) | (v4[1] as number);
  const lo = ((v4[2] as number) << 8) | (v4[3] as number);
  return (
    text.slice(0, -(dotted[1] as string).length) +
    `${hi.toString(16)}:${lo.toString(16)}`
  );
}

const hexGroups = (part: string): number[] =>
  part === ''
    ? []
    : part
        .split(':')
        .map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : NaN));

/** The eight 16-bit groups of an IPv6 address, or null. */
function ipv6Groups(ip: string): number[] | null {
  const text = expandDottedTail(ip.split('%')[0] ?? '');
  if (text === null) return null;
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = hexGroups(halves[0] as string);
  const tail = halves.length === 2 ? hexGroups(halves[1] as string) : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 2 && fill < 1) return null;
  const groups =
    halves.length === 2
      ? [...head, ...Array<number>(fill).fill(0), ...tail]
      : head;
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff)
    ? groups
    : null;
}

function embeddedIPv4(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 255, lo >> 8, lo & 255];
}

const allZero = (n: number[]) => n.every((x) => x === 0);

/**
 * Rules for IPv6, in order: the first that matches decides. `false` means not
 * public; a number pair names the groups of an embedded IPv4 address, which
 * then decides.
 */
const IPV6_RULES: readonly [
  (g: number[]) => boolean,
  false | [number, number],
][] = [
  [(g) => allZero(g), false], // ::
  [(g) => allZero(g.slice(0, 7)) && g[7] === 1, false], // ::1
  [(g) => allZero(g.slice(0, 5)) && g[5] === 0xffff, [6, 7]], // IPv4-mapped
  [(g) => allZero(g.slice(0, 6)), false], // IPv4-compatible (deprecated)
  [(g) => g[0] === 0x64 && g[1] === 0xff9b && allZero(g.slice(2, 6)), [6, 7]], // NAT64
  [(g) => g[0] === 0x100 && allZero(g.slice(1, 4)), false], // discard prefix
  [(g) => g[0] === 0x2001 && g[1] === 0, false], // Teredo
  [(g) => g[0] === 0x2001 && g[1] === 0xdb8, false], // documentation
  [(g) => g[0] === 0x2002, [1, 2]], // 6to4
  [(g) => ((g[0] as number) & 0xfe00) === 0xfc00, false], // unique local
  [(g) => ((g[0] as number) & 0xffc0) === 0xfe80, false], // link-local
  [(g) => ((g[0] as number) & 0xff00) === 0xff00, false], // multicast
];

function isPublicIPv6(g: number[]): boolean {
  const rule = IPV6_RULES.find(([matches]) => matches(g));
  if (!rule) return true;
  const verdict = rule[1];
  if (verdict === false) return false;
  return isPublicIPv4(
    embeddedIPv4(g[verdict[0]] as number, g[verdict[1]] as number),
  );
}

/**
 * True if `ip` is an IPv4 or IPv6 address that is routable on the public
 * internet. Everything else (private, loopback, link-local, shared, reserved,
 * or not an address at all) is false.
 */
export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const parts = ipv4Parts(ip);
    return parts !== null && isPublicIPv4(parts);
  }
  if (kind === 6) {
    const groups = ipv6Groups(ip);
    return groups !== null && isPublicIPv6(groups);
  }
  return false;
}

// --- Requests ----------------------------------------------------------------

export interface Resolved {
  address: string;
  family: number;
}

export interface SafeFetchOptions {
  /** Time limit for one request (one hop), in milliseconds. */
  timeoutMs: number;
  /** Most bytes read from a response body. */
  maxBytes: number;
  /** Most redirects followed (GET and HEAD only). */
  maxRedirects: number;
  /** Lift the address check. Only for tests and the tutorial. */
  allowPrivate: boolean;
  /** Resolves a host name. Default: the system resolver. Injectable for tests. */
  resolve?: (host: string) => Promise<Resolved[]>;
  /** Tests only: the address to connect to instead of the checked one. */
  connectAddress?: (checked: string) => string;
}

export interface SafeFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface SafeResponse {
  status: number;
  /** Address of the response after redirects. */
  url: string;
  /** Header names in lower case. */
  headers: Record<string, string>;
  /** At most `maxBytes` bytes, decoded as UTF-8. */
  body: string;
  truncated: boolean;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

async function systemResolve(host: string): Promise<Resolved[]> {
  return dnsLookup(host, { all: true, verbatim: true });
}

function parseTarget(address: string): URL {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new NetError(`Not an address: "${address.slice(0, 100)}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new NetError(
      `Only http and https are allowed, not "${url.protocol}"`,
    );
  if (url.username !== '' || url.password !== '')
    throw new NetError('An address with a user name or password is refused');
  return url;
}

async function checkedAddress(
  url: URL,
  options: SafeFetchOptions,
): Promise<Resolved> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const kind = isIP(host);
  const found: Resolved[] =
    kind !== 0
      ? [{ address: host, family: kind }]
      : await (options.resolve ?? systemResolve)(host).catch(() => {
          throw new NetError(`Cannot resolve "${host}"`);
        });
  if (found.length === 0) throw new NetError(`Cannot resolve "${host}"`);
  if (!options.allowPrivate) {
    const bad = found.find((f) => !isPublicAddress(f.address));
    if (bad)
      throw new NetError(`"${host}" is not a public address (${bad.address})`);
  }
  return found[0] as Resolved;
}

/** A DNS look-up that always answers with the address that was checked. */
function pinnedLookup(address: string, family: number) {
  return (
    _host: string,
    lookupOptions: unknown,
    callback: (...args: unknown[]) => void,
  ) => {
    if ((lookupOptions as { all?: boolean }).all)
      callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

function requestHeaders(init: SafeFetchInit): Record<string, string> {
  return {
    'user-agent':
      'Muffelblog-Webmention (+https://github.com/Heiss/muffelblog)',
    accept: 'text/html, */*;q=0.1',
    ...(init.body !== undefined
      ? { 'content-length': String(Buffer.byteLength(init.body)) }
      : {}),
    ...init.headers,
  };
}

/** Reads a response up to `maxBytes`; more is cut off and marked as truncated. */
function readResponse(
  response: http.IncomingMessage,
  url: URL,
  maxBytes: number,
): Promise<SafeResponse> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    const done = () =>
      resolve({
        status: response.statusCode ?? 0,
        url: url.href,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([k, v]) => [
            k.toLowerCase(),
            Array.isArray(v) ? v.join(', ') : (v ?? ''),
          ]),
        ),
        body: Buffer.concat(chunks).toString('utf8'),
        truncated,
      });
    response.on('data', (chunk: Buffer) => {
      const room = maxBytes - size;
      if (chunk.length <= room) {
        chunks.push(chunk);
        size += chunk.length;
        return;
      }
      chunks.push(chunk.subarray(0, room));
      size += room;
      truncated = true;
      response.destroy();
      done();
    });
    response.on('end', done);
    response.on('error', (e) => reject(new NetError(e.message)));
  });
}

function once(
  url: URL,
  target: Resolved,
  init: SafeFetchInit,
  options: SafeFetchOptions,
): Promise<SafeResponse> {
  const address = options.connectAddress?.(target.address) ?? target.address;
  const family = isIP(address) || target.family;
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const request = transport.request(
      url,
      {
        method: init.method ?? 'GET',
        headers: requestHeaders(init),
        // The checked address is the one that is used: no second look-up.
        lookup: pinnedLookup(address, family) as never,
      },
      (response) => {
        readResponse(response, url, options.maxBytes).then(
          (r) => finish(() => resolve(r)),
          (e: unknown) => finish(() => reject(e)),
        );
      },
    );
    const timer = setTimeout(() => {
      request.destroy();
      finish(() =>
        reject(new NetError(`Timeout after ${options.timeoutMs} ms`)),
      );
    }, options.timeoutMs);
    request.on('error', (e) => finish(() => reject(new NetError(e.message))));
    if (init.body !== undefined) request.write(init.body);
    request.end();
  });
}

/**
 * Fetches an address from a foreign server and keeps the instance safe:
 * only http and https, no credentials in the address, the host name is
 * resolved and every address must be public (unless `allowPrivate`), the
 * connection goes to exactly the checked address (no second look-up, so no
 * DNS rebinding), time and size are limited, and every redirect of a GET is
 * checked again. A redirect of a POST is not followed.
 */
export async function safeFetch(
  address: string,
  init: SafeFetchInit,
  options: SafeFetchOptions,
): Promise<SafeResponse> {
  let url = parseTarget(address);
  const method = (init.method ?? 'GET').toUpperCase();
  for (let hop = 0; ; hop += 1) {
    const target = await checkedAddress(url, options);
    const response = await once(url, target, init, options);
    const location = response.headers.location;
    if (
      REDIRECTS.has(response.status) &&
      location !== undefined &&
      (method === 'GET' || method === 'HEAD')
    ) {
      if (hop >= options.maxRedirects) throw new NetError('Too many redirects');
      url = parseTarget(new URL(location, url).href);
      continue;
    }
    return response;
  }
}
