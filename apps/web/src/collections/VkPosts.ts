import type { CollectionConfig } from 'payload';

import { isAuthenticatedOrWorker, isWorkerOrAdmin } from '../access';

export const VkPosts: CollectionConfig = {
  slug: 'vk-posts',
  admin: {
    group: 'Research',
    defaultColumns: ['digest', 'vkCommunityId', 'status', 'vkPostId'],
  },
  access: {
    read: isAuthenticatedOrWorker,
    create: isWorkerOrAdmin,
    update: isWorkerOrAdmin,
    delete: isWorkerOrAdmin,
  },
  indexes: [{ fields: ['digest', 'vkCommunityId'], unique: true }],
  fields: [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'research-projects',
      required: true,
      maxDepth: 0,
    },
    {
      name: 'digest',
      type: 'relationship',
      relationTo: 'digests',
      required: true,
      index: true,
      maxDepth: 0,
    },
    { name: 'vkCommunityId', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Published', value: 'published' },
        { label: 'Failed', value: 'failed' },
        { label: 'Skipped', value: 'skipped' },
      ],
    },
    { name: 'vkPostId', type: 'text' },
    { name: 'lastError', type: 'text' },
  ],
};
