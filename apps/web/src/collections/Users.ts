import type { CollectionConfig } from 'payload';

import { isAdmin, isAuthenticated } from '../access';

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'System',
  },
  auth: {
    useAPIKey: true,
  },
  access: {
    read: isAuthenticated,
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
