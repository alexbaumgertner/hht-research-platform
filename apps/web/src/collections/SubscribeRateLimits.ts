import type { CollectionConfig } from 'payload';

import { isWorkerOrAdmin } from '../access';

/** Hashed IP windows. Not linked to a subscriber. The sweep deletes rows older than a day. */
export const SubscribeRateLimits: CollectionConfig = {
  slug: 'subscribe-rate-limits',
  admin: { hidden: true },
  access: {
    read: () => false,
    create: isWorkerOrAdmin,
    update: () => false,
    delete: isWorkerOrAdmin,
  },
  fields: [{ name: 'keyHash', type: 'text', required: true, index: true }],
};
