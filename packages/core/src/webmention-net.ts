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

/** True for an IPv4 address that is routable on the public internet. */
function isPublicIPv4(parts: number[]): boolean {
  const [a, b, c] = parts as [number, number, number, number];
  if (a === 0) return false; // "this" network
  if (a === 10) return false; // private
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 0 && c === 0) return false; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return false; // documentation
  if (a === 192 && b === 168) return false; // private
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // documentation
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

/** The eight 16-bit groups of an IPv6 address, or null. */
function ipv6Groups(ip: string): number[] | null {
  let text = ip.split('%')[0] ?? '';
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    const v4 = ipv4Parts(dotted[1] as string);
    if (!v4) return null;
    const hi = ((v4[0] as number) << 8) | (v4[1] as number);
    const lo = ((v4[2] as number) << 8) | (v4[3] as number);
    text =
      text.slice(0, -(dotted[1] as string).length) +
      `${hi.toString(16)}:${lo.toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string) =>
    part === ''
      ? []
      : part
          .split(':')
          .map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : NaN));
  const head = toGroups(halves[0] as string);
  const tail = halves.length === 2 ? toGroups(halves[1] as string) : [];
  let groups: number[];
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    groups = [...head, ...Array<number>(fill).fill(0), ...tail];
  } else groups = head;
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff)
    ? groups
    : null;
}

function embeddedIPv4(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 255, lo >> 8, lo & 255];
}

function isPublicIPv6(g: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const zero = (n: number[]) => n.every((x) => x === 0);
  if (zero(g)) return false; // ::
  if (zero([g0, g1, g2, g3, g4, g5, g6]) && g7 === 1) return false; // ::1
  // IPv4-mapped (::ffff:a.b.c.d): judge by the IPv4 address
  if (zero([g0, g1, g2, g3, g4]) && g5 === 0xffff)
    return isPublicIPv4(embeddedIPv4(g6, g7));
  // IPv4-compatible (::a.b.c.d, deprecated): never public
  if (zero([g0, g1, g2, g3, g4, g5])) return false;
  // NAT64 (64:ff9b::/96): judge by the IPv4 address
  if (g0 === 0x64 && g1 === 0xff9b && zero([g2, g3, g4, g5]))
    return isPublicIPv4(embeddedIPv4(g6, g7));
  if (g0 === 0x100 && zero([g1, g2, g3])) return false; // discard prefix
  if (g0 === 0x2001 && g1 === 0) return false; // Teredo
  if (g0 === 0x2001 && g1 === 0xdb8) return false; // documentation
  if (g0 === 0x2002) return isPublicIPv4(embeddedIPv4(g1, g2)); // 6to4
  if ((g0 & 0xfe00) === 0xfc00) return false; // unique local
  if ((g0 & 0xffc0) === 0xfe80) return false; // link-local
  if ((g0 & 0xff00) === 0xff00) return false; // multicast
  return true;
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
        headers: {
          'user-agent':
            'Muffelblog-Webmention (+https://github.com/Heiss/muffelblog)',
          accept: 'text/html, */*;q=0.1',
          ...(init.body !== undefined
            ? { 'content-length': String(Buffer.byteLength(init.body)) }
            : {}),
          ...init.headers,
        },
        // The checked address is the one that is used: no second look-up.
        lookup: (_host, lookupOptions, callback) => {
          if ((lookupOptions as { all?: boolean }).all)
            (callback as (e: null, a: Resolved[]) => void)(null, [
              { address, family },
            ]);
          else
            (callback as (e: null, a: string, f: number) => void)(
              null,
              address,
              family,
            );
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        const done = () =>
          finish(() =>
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
            }),
          );
        response.on('data', (chunk: Buffer) => {
          const room = options.maxBytes - size;
          if (chunk.length > room) {
            chunks.push(chunk.subarray(0, room));
            size += room;
            truncated = true;
            response.destroy();
            done();
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        response.on('end', done);
        response.on('error', (e) =>
          finish(() => reject(new NetError(e.message))),
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
