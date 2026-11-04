// Writes a comment the way a reader does: login by email, then comment. For tests
// and for the tutorial. Runs inside the builder container:
//   docker compose exec -T builder node /repo/docker/visitor-comment.mjs <page-url> <text> [name] [email]
// Steps: ask Remark42 for a login mail, read the token from Mailpit, redeem it
// (this sets the cookies JWT and XSRF-TOKEN), post the comment with both.
const [pageUrl, text, name = 'Testleser', email = 'leser@example.org'] =
  process.argv.slice(2);
if (!pageUrl || !text) {
  console.error('usage: visitor-comment.mjs <page-url> <text> [name] [email]');
  process.exit(2);
}
const remark = process.env.REMARK_INTERNAL_URL || 'http://remark42:8080';
const mailpit = process.env.MAILPIT_URL || 'http://mailpit:8025';
const site = process.env.COMMENTS_SITE_ID || 'muffelblog';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ok(res, what) {
  if (!res.ok)
    throw new Error(
      `${what}: ${res.status} ${(await res.text()).slice(0, 200)}`,
    );
  return res;
}

// 1. Ask for the login mail.
const ask = new URL(`${remark}/auth/email/login`);
ask.searchParams.set('site', site);
ask.searchParams.set('user', name);
ask.searchParams.set('address', email);
await ok(await fetch(ask), 'login mail request');

// 2. Read the token from the newest mail to this address.
let token;
for (let i = 0; i < 30 && !token; i += 1) {
  const list = await (
    await ok(
      await fetch(
        `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      ),
      'mail search',
    )
  ).json();
  const newest = (list.messages ?? [])[0];
  if (newest) {
    const msg = await (
      await ok(
        await fetch(`${mailpit}/api/v1/message/${newest.ID}`),
        'mail read',
      )
    ).json();
    token = `${msg.Text ?? ''}\n${msg.HTML ?? ''}`.match(
      /eyJ[\w-]+\.[\w-]+\.[\w-]+/,
    )?.[0];
  }
  if (!token) await sleep(1000);
}
if (!token) throw new Error('no login mail with a token arrived in Mailpit');

// 3. Redeem the token: this logs in and sets the cookies.
const login = new URL(`${remark}/auth/email/login`);
login.searchParams.set('token', token);
login.searchParams.set('site', site);
const redeemed = await ok(await fetch(login, { redirect: 'manual' }), 'login');
const cookies = Object.fromEntries(
  redeemed.headers.getSetCookie().map((c) => c.split(';')[0].split('=')),
);
if (!cookies.JWT || !cookies['XSRF-TOKEN'])
  throw new Error(
    `login did not set the cookies (got ${Object.keys(cookies).join(', ')})`,
  );

// 4. Comment, with the cookie and the matching XSRF header.
const post = await fetch(`${remark}/api/v1/comment`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: `JWT=${cookies.JWT}; XSRF-TOKEN=${cookies['XSRF-TOKEN']}`,
    'X-XSRF-TOKEN': cookies['XSRF-TOKEN'],
  },
  body: JSON.stringify({ text, locator: { site, url: pageUrl } }),
});
if (post.status !== 201) {
  console.error(
    `comment refused: ${post.status} ${(await post.text()).slice(0, 200)}`,
  );
  process.exit(1);
}
const created = await post.json();
console.log(
  `comment ${created.id} by ${created.user?.name} (${created.user?.id})`,
);
