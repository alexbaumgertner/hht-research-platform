import type { AuthStrategy } from 'payload';

import { readSessionCookie, readToken } from './session';

/**
 * Payload auth strategy for the email-code session cookie. Replaces the local
 * (password) strategy, which is disabled on the users collection.
 */
export const emailCodeStrategy: AuthStrategy = {
  name: 'email-code',
  authenticate: async ({ headers, payload }) => {
    const userId = readToken(readSessionCookie(headers.get('cookie')));
    if (!userId) return { user: null };
    try {
      const user = await payload.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
        overrideAccess: true,
      });
      if (!user) return { user: null };
      return { user: { ...user, collection: 'users', _strategy: 'email-code' } };
    } catch {
      // User deleted while the cookie is still around: treat as logged out.
      return { user: null };
    }
  },
};
