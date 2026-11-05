// A tiny webmention receiver for tests and the tutorial. It offers an endpoint
// and prints every message it gets, and whether the source really links to the
// target (what a real receiver does before it shows a mention).
//   docker compose exec builder node /repo/docker/webmention-receiver.mjs [port]
import { createServer } from 'node:http';

const port = Number(process.argv[2] || 9000);

/** A value from a request for the log: no line breaks. */
const forLog = (value) => String(value).replace(/[\r\n\t\v\f]/g, ' ');

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webmention') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      const form = new URLSearchParams(body);
      const source = form.get('source') ?? '';
      const target = form.get('target') ?? '';
      console.log(
        `webmention received: source=${forLog(source)} target=${forLog(target)}`,
      );
      res.statusCode = 202;
      res.end('accepted');
      try {
        const page = await fetch(source, {
          signal: AbortSignal.timeout(10_000),
        });
        const html = await page.text();
        console.log(
          `  source fetched (HTTP ${page.status}), links to the target: ${html.includes(target) ? 'yes' : 'NO'}`,
        );
      } catch (error) {
        console.log(
          `  source not fetched: ${forLog(error instanceof Error ? error.message : error)}`,
        );
      }
    });
    return;
  }
  // Any other address: a page that announces the endpoint.
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Link', '</webmention>; rel="webmention"');
  res.end(
    '<!doctype html><title>Receiver</title><link rel="webmention" href="/webmention"><p>Webmention test receiver</p>',
  );
});

server.listen(port, '0.0.0.0', () =>
  console.log(`webmention test receiver listens on port ${port}`),
);
