import { readFileSync } from 'node:fs';
import { createAdminClient, formatComment } from './remark-admin.ts';

type Client = ReturnType<typeof createAdminClient>;

function need(value: string | undefined, usage: string): string {
  if (!value) throw new Error(`usage: ${usage}`);
  return value;
}

// One function per command; each checks its own arguments.
const COMMANDS: Record<
  string,
  (client: Client, args: string[]) => Promise<void>
> = {
  async list(client, args) {
    const comments = await client.list(Number(args[0] ?? 20));
    console.log(comments.map(formatComment).join('\n'));
  },
  async delete(client, args) {
    const usage = 'delete <comment-id> <page-url>';
    const id = need(args[0], usage);
    await client.deleteComment(id, need(args[1], usage));
    console.log(`deleted ${id}`);
  },
  async block(client, args) {
    const user = need(args[0], 'block <user-id> [ttl, for example 7d]');
    await client.block(user, args[1]);
    console.log(`blocked ${user}${args[1] ? ` for ${args[1]}` : ''}`);
  },
  async unblock(client, args) {
    const user = need(args[0], 'unblock <user-id>');
    await client.unblock(user);
    console.log(`unblocked ${user}`);
  },
  async export(client) {
    process.stdout.write(await client.exportAll());
  },
  async import(client) {
    await client.importAll(new Uint8Array(readFileSync(0)));
    console.error('imported');
  },
};

// Usage (inside the builder container, see docker/moderate.sh, backup.sh, restore.sh):
//   list [n] | delete <id> <page-url> | block <user-id> [ttl] | unblock <user-id> | export | import
// The password comes from REMARK_ADMIN_PASSWD, the address from REMARK_INTERNAL_URL.
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const run =
    command && Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
  if (!run)
    throw new Error(
      'commands: list [n] | delete <id> <url> | block <user-id> [ttl] | unblock <user-id> | export | import',
    );
  const client = createAdminClient({
    baseUrl: process.env.REMARK_INTERNAL_URL || 'http://remark42:8080',
    site: process.env.COMMENTS_SITE_ID || 'muffelblog',
    password: process.env.REMARK_ADMIN_PASSWD ?? '',
  });
  await run(client, args);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
