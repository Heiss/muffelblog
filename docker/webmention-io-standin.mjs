// A stand-in for webmention.io, for the demo and the tests: receiving
// webmentions can be tried without a domain and without the real service.
// It copies the parts of the API that Muffelblog uses (see the docs of
// webmention.io): the endpoint, /api/mentions.jf2 and /api/deleted. It does
// NOT check that the source links to the target, as the real service does.
//
//   node docker/webmention-io-standin.mjs [port]     (token: WEBMENTION_IO_TOKEN)
//
// Helpers for tests (not part of webmention.io):
//   POST /_standin/mention  JSON {source, target, property?, author?}
//   POST /_standin/delete   JSON {id}
import { createServer } from 'node:http';

const port = Number(process.argv[2] || 8090);
const token = process.env.WEBMENTION_IO_TOKEN || '';
if (!token) {
  console.error('WEBMENTION_IO_TOKEN is missing');
  process.exit(1);
}

/** @type {{ id: number, source: string, target: string, property: string, author?: string, received: string }[]} */
const mentions = [];
/** @type {{ id: number, source: string, target: string, deleted: string }[]} */
const deleted = [];
let nextId = 1000;

const isHttp = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/** A value from a request for the log, quoted: line breaks are escaped. */
const forLog = (value) => JSON.stringify(String(value));

function add(source, target, property = 'mention-of', author) {
  const m = {
    id: nextId++,
    source,
    target,
    property,
    author,
    received: new Date().toISOString(),
  };
  mentions.push(m);
  console.log(`mention ${m.id}: ${forLog(source)} -> ${forLog(target)}`);
  return m;
}

const asJf2 = (m) => ({
  type: 'entry',
  author: { type: 'card', name: m.author ?? '', url: '', photo: '' },
  url: m.source,
  published: null,
  'wm-received': m.received,
  'wm-id': m.id,
  'wm-source': m.source,
  'wm-target': m.target,
  'wm-protocol': 'webmention',
  'wm-property': m.property,
  'wm-private': false,
});

function authorized(req, url) {
  const header = req.headers.authorization ?? '';
  return (
    header === `Bearer ${token}` || url.searchParams.get('token') === token
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) reject(new Error('too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const json = (res, status, value) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(value));
};

function mentionsFeed(url) {
  const since = Number(url.searchParams.get('since_id') ?? 0);
  const perPage = Math.min(
    Number(url.searchParams.get('per-page') ?? 20),
    1000,
  );
  const page = Number(url.searchParams.get('page') ?? 0);
  const list = mentions.filter((m) => m.id > since);
  if (url.searchParams.get('sort-dir') !== 'up') list.reverse();
  return {
    type: 'feed',
    name: 'Webmentions',
    children: list.slice(page * perPage, (page + 1) * perPage).map(asJf2),
  };
}

const deletedList = () =>
  [...deleted].reverse().map((d) => ({
    'wm-id': d.id,
    'wm-source': d.source,
    'wm-target': d.target,
    'wm-deleted': d.deleted,
  }));

// The endpoint the blog announces: /<domain>/webmention
async function receive(req, res) {
  const form = new URLSearchParams(await readBody(req));
  const source = form.get('source') ?? '';
  const target = form.get('target') ?? '';
  if (!isHttp(source) || !isHttp(target))
    return json(res, 400, { error: 'source and target must be http(s)' });
  const m = add(source, target);
  res.setHeader('Location', `/api/status/${m.id}`);
  return json(res, 201, { status: 'queued' });
}

async function addForTest(req, res) {
  const body = JSON.parse(await readBody(req));
  if (!isHttp(body.source) || !isHttp(body.target))
    return json(res, 400, { error: 'source and target must be http(s)' });
  return json(
    res,
    201,
    add(body.source, body.target, body.property, body.author),
  );
}

async function deleteForTest(req, res) {
  const body = JSON.parse(await readBody(req));
  const i = mentions.findIndex((m) => m.id === body.id);
  if (i < 0) return json(res, 404, { error: 'unknown id' });
  const [m] = mentions.splice(i, 1);
  deleted.push({ ...m, deleted: new Date().toISOString() });
  console.log(`mention ${m.id} deleted`);
  return json(res, 200, { deleted: m.id });
}

/** The API answers with the token only, like webmention.io. */
const withToken = (answer) => (req, res, url) =>
  authorized(req, url)
    ? json(res, 200, answer(url))
    : json(res, 401, { error: 'forbidden' });

const ROUTES = {
  'GET /api/mentions.jf2': withToken(mentionsFeed),
  'GET /api/deleted': withToken(deletedList),
  'POST /_standin/mention': addForTest,
  'POST /_standin/delete': deleteForTest,
};

function route(req, url) {
  if (req.method === 'POST' && /^\/[^/]+\/webmention$/.test(url.pathname))
    return receive;
  return ROUTES[`${req.method} ${url.pathname}`];
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://standin');
  const handler = route(req, url);
  if (!handler) return json(res, 404, { error: 'not found' });
  try {
    return await handler(req, res, url);
  } catch (error) {
    return json(res, 400, { error: String(error) });
  }
}).listen(port, () => console.log(`webmention.io stand-in on port ${port}`));
