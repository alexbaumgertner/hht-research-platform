import type { CollectionConfig } from 'payload';

import { isAuthenticated, isWorkerOrAdmin, publicRead } from '../access';
import { capCreateDepth, resolveRelationshipId } from './digestHooks';

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
    beforeOperation: [({ args, operation }) => capCreateDepth(args, operation)],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== 'create') return;
        const projectId = resolveRelationshipId(doc.project);
        if (!projectId) return;
        // Email is sent by the worker (`sendDigestPublishedEmail`), not this hook.
        // Nested `payload.update()` *without* `req` starts a second postgres
        // transaction while create still holds the first — that stalls the pool
        // until Vercel FUNCTION_INVOCATION_TIMEOUT (504). Share `req` so this
        // is one SET on the same connection. Jobs queue is not configured.
        await req.payload.db.updateOne({
          collection: 'research-projects',
          id: projectId,
          data: { hasPublishedDigest: true },
          req,
          returning: false,
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
      maxDepth: 1,
    },
    {
      name: 'run',
      type: 'relationship',
      relationTo: 'monitoring-runs',
      required: true,
      // Break circular populate: run.digest → digest.run → …
      maxDepth: 1,
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
