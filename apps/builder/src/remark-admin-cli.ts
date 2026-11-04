import { readFileSync } from 'node:fs';
import { createAdminClient, formatComment } from './remark-admin.ts';

// Usage (inside the builder container, see docker/moderate.sh, backup.sh, restore.sh):
//   list [n] | delete <id> <page-url> | block <user-id> [ttl] | unblock <user-id> | export | import
// The password comes from REMARK_ADMIN_PASSWD, the address from REMARK_INTERNAL_URL.
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const client = createAdminClient({
    baseUrl: process.env.REMARK_INTERNAL_URL || 'http://remark42:8080',
    site: process.env.COMMENTS_SITE_ID || 'muffelblog',
    password: process.env.REMARK_ADMIN_PASSWD ?? '',
  });
  switch (command) {
    case 'list': {
      const comments = await client.list(Number(args[0] ?? 20));
      console.log(comments.map(formatComment).join('\n'));
      break;
    }
    case 'delete': {
      if (!args[0] || !args[1])
        throw new Error('usage: delete <comment-id> <page-url>');
      await client.deleteComment(args[0], args[1]);
      console.log(`deleted ${args[0]}`);
      break;
    }
    case 'block': {
      if (!args[0])
        throw new Error('usage: block <user-id> [ttl, for example 7d]');
      await client.block(args[0], args[1]);
      console.log(`blocked ${args[0]}${args[1] ? ` for ${args[1]}` : ''}`);
      break;
    }
    case 'unblock': {
      if (!args[0]) throw new Error('usage: unblock <user-id>');
      await client.unblock(args[0]);
      console.log(`unblocked ${args[0]}`);
      break;
    }
    case 'export':
      process.stdout.write(await client.exportAll());
      break;
    case 'import':
      await client.importAll(new Uint8Array(readFileSync(0)));
      console.error('imported');
      break;
    default:
      throw new Error(
        'commands: list [n] | delete <id> <url> | block <user-id> [ttl] | unblock <user-id> | export | import',
      );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
