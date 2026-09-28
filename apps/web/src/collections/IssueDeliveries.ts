import type { CollectionConfig } from 'payload';

import { isAuthenticatedOrWorker, isWorkerFieldLevel, isWorkerOrAdmin } from '../access';

const hiddenFromAdmin = {
  admin: { hidden: true, disableListColumn: true, disableListFilter: true },
} as const;

export const IssueDeliveries: CollectionConfig = {
  slug: 'issue-deliveries',
  admin: {
    group: 'Research',
    defaultColumns: ['digest', 'subscriber', 'status', 'attempts', 'sentAt'],
  },
  access: {
    read: isAuthenticatedOrWorker,
    create: isWorkerOrAdmin,
    update: isWorkerOrAdmin,
    delete: isWorkerOrAdmin,
  },
  indexes: [{ fields: ['digest', 'subscriber'], unique: true }],
  fields: [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'research-projects',
      required: true,
      index: true,
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
    {
      name: 'subscriber',
      type: 'relationship',
      relationTo: 'subscribers',
      required: true,
      index: true,
      maxDepth: 0,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
        { label: 'Skipped', value: 'skipped' },
      ],
    },
    { name: 'attempts', type: 'number', min: 0, defaultValue: 0 },
    { name: 'nextAttemptAt', type: 'date' },
    { name: 'sentAt', type: 'date' },
    { name: 'resendEmailId', type: 'text', ...hiddenFromAdmin },
    { name: 'lastError', type: 'text' },
    {
      name: 'clicked',
      type: 'checkbox',
      defaultValue: false,
      access: { read: isWorkerFieldLevel, update: isWorkerFieldLevel },
      ...hiddenFromAdmin,
    },
    {
      name: 'clickTokenHash',
      type: 'text',
      unique: true,
      index: true,
      access: { read: isWorkerFieldLevel, update: isWorkerFieldLevel },
      ...hiddenFromAdmin,
    },
  ],
};
