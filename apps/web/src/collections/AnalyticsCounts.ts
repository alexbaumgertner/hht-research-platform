import type { CollectionConfig } from 'payload';

import { isAuthenticatedOrWorker, isWorkerOrAdmin } from '../access';

const SOURCE_PATTERN = /^(vk|wa|fb|tg|other|site:[a-z0-9][a-z0-9-]{1,31})$/;

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
      type: 'text',
      required: true,
      validate: (value: unknown) =>
        typeof value === 'string' && SOURCE_PATTERN.test(value)
          ? true
          : 'Source must be vk, wa, fb, tg, other or site:<key>',
    },
    {
      name: 'metric',
      type: 'select',
      required: true,
      options: [
        { label: 'Page view', value: 'page_view' },
        { label: 'Form submit', value: 'form_submit' },
        { label: 'Confirmation', value: 'confirmation' },
        { label: 'Widget view', value: 'widget_view' },
        { label: 'Outbound click', value: 'outbound_click' },
      ],
    },
    { name: 'count', type: 'number', required: true, min: 0, defaultValue: 0 },
  ],
};
