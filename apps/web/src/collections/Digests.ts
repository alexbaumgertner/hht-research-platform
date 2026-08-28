import type { CollectionConfig } from 'payload';

import { isAuthenticated, isWorkerOrAdmin, publicRead } from '../access';

export const Digests: CollectionConfig = {
  slug: 'digests',
  admin: {
    useAsTitle: 'publishedAt',
    group: 'Research',
    defaultColumns: ['publishedAt', 'project', 'updatedAt'],
  },
  access: {
    read: publicRead,
    create: isWorkerOrAdmin,
    update: isWorkerOrAdmin,
    delete: isAuthenticated,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data;
        const pubs = data.publications as unknown[] | undefined;
        if (!pubs || pubs.length === 0) {
          throw new Error('Cannot publish an empty digest');
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== 'create') return;
        const projectId =
          typeof doc.project === 'object' && doc.project !== null
            ? (doc.project as { id: string | number }).id
            : doc.project;
        if (!projectId) return;
        // Email is sent by the worker, not this hook. Keep this denormalized
        // flag update cheap so POST /api/digests stays within serverless limits.
        await req.payload.update({
          collection: 'research-projects',
          id: projectId,
          data: { hasPublishedDigest: true },
          overrideAccess: true,
          depth: 0,
          select: { id: true },
        });
      },
    ],
  },
  fields: [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'research-projects',
      required: true,
      index: true,
    },
    {
      name: 'run',
      type: 'relationship',
      relationTo: 'monitoring-runs',
      required: true,
    },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'publications',
      type: 'relationship',
      relationTo: 'publications',
      hasMany: true,
      required: true,
      minRows: 1,
      // Cap nested populate (project / firstSeenRun) so a default-depth REST
      // create does not N+1 through every related publication.
      maxDepth: 1,
    },
  ],
};
