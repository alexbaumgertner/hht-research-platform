import type { CollectionConfig } from 'payload';

import { isAuthenticatedOrWorker, isWorkerOrAdmin } from '../access';

export const AnalyticsCounts: CollectionConfig = {
  slug: 'analytics-counts',
  admin: {
    group: 'Research',
    defaultColumns: ['project', 'issueKey', 'source', 'metric', 'count'],
  },
  access: {
    read: isAuthenticatedOrWorker,
    create: isWorkerOrAdmin,
    update: isWorkerOrAdmin,
    delete: () => false,
  },
  indexes: [{ fields: ['project', 'issueKey', 'source', 'metric'], unique: true }],
  fields: [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'research-projects',
      required: true,
      maxDepth: 0,
    },
    { name: 'issueKey', type: 'text', required: true },
    {
      name: 'source',
      type: 'select',
      required: true,
      options: [
        { label: 'VK', value: 'vk' },
        { label: 'WhatsApp', value: 'wa' },
        { label: 'Facebook', value: 'fb' },
        { label: 'Telegram', value: 'tg' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'metric',
      type: 'select',
      required: true,
      options: [
        { label: 'Page view', value: 'page_view' },
        { label: 'Form submit', value: 'form_submit' },
        { label: 'Confirmation', value: 'confirmation' },
      ],
    },
    { name: 'count', type: 'number', required: true, min: 0, defaultValue: 0 },
  ],
};
