/**
 * Create (or promote) an admin who signs in with an email code — the
 * "create first user" screen is gone together with passwords.
 * Local databases only unless ALLOW_REMOTE_DATABASE=1 (see lib/databaseTarget.ts).
 *
 * Usage: pnpm --filter @hht/web create-admin you@example.com
 */
import { getPayload } from 'payload';
import config from '@payload-config';

import { assertLocalDatabaseForScript } from '../lib/databaseTarget';
import { normalizeEmail } from '../lib/auth/otp';

async function main() {
  const email = normalizeEmail(process.argv[2] ?? '');
  if (!email.includes('@')) throw new Error('Usage: create-admin <email>');
  assertLocalDatabaseForScript('create-admin');

  const payload = await getPayload({ config });
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  });
  const user = existing.docs[0];

  if (user) {
    const roles = Array.from(new Set([...(user.roles ?? []), 'admin' as const]));
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { roles },
      overrideAccess: true,
    });
    console.log(`Promoted ${email} to admin (id ${user.id}).`);
  } else {
    const created = await payload.create({
      collection: 'users',
      data: { email, roles: ['admin'] },
      overrideAccess: true,
    });
    console.log(`Created admin ${email} (id ${created.id}).`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
