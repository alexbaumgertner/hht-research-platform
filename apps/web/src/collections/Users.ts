import type { CollectionConfig } from 'payload';

import { isAdmin, usersReadAccess } from '../access';
import { emailCodeStrategy } from '../lib/auth/strategy';

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'System',
  },
  auth: {
    useAPIKey: true,
    // No passwords: admins sign in with a one-time code sent by email
    // (/api/auth/request-code + verify-code). Fields stay so the schema is unchanged.
    disableLocalStrategy: { enableFields: true, optionalPassword: true },
    strategies: [emailCodeStrategy],
  },
  access: {
    read: usersReadAccess,
    create: async ({ req }) => {
      const users = await req.payload.find({
        collection: 'users',
        limit: 1,
        overrideAccess: true,
      });
      if (users.totalDocs === 0) return true;
      return isAdmin({ req });
    },
    update: isAdmin,
    delete: isAdmin,
    admin: ({ req: { user } }) => {
      if (!user) return false;
      const roles = (user as { roles?: string[] }).roles;
      return Boolean(roles?.includes('admin'));
    },
  },
  fields: [
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['admin'],
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Worker', value: 'worker' },
      ],
      access: {
        create: ({ req: { user } }) => Boolean(user),
        update: ({ req: { user } }) => {
          const roles = (user as { roles?: string[] } | null)?.roles;
          return Boolean(roles?.includes('admin'));
        },
      },
    },
  ],
};
