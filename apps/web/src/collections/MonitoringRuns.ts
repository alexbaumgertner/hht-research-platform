import type { CollectionConfig } from 'payload';

import { isAuthenticated, isWorkerOrAdmin } from '../access';

export const MonitoringRuns: CollectionConfig = {
  slug: 'monitoring-runs',
  admin: {
    useAsTitle: 'startedAt',
    group: 'Research',
    defaultColumns: ['startedAt', 'status', 'triggeredBy', 'project'],
  },
  access: {
    read: isAuthenticated,
    create: isWorkerOrAdmin,
    update: isWorkerOrAdmin,
    delete: isAuthenticated,
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
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'running',
      options: [
        { label: 'Running', value: 'running' },
        { label: 'Completed', value: 'completed' },
        { label: 'Completed (partial failure)', value: 'completed_partial_failure' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'triggeredBy',
      type: 'select',
      required: true,
      defaultValue: 'schedule',
      options: [
        { label: 'Schedule', value: 'schedule' },
        { label: 'Manual', value: 'manual' },
      ],
    },
    {
      name: 'startedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'finishedAt',
      type: 'date',
    },
    {
      name: 'sourceResults',
      type: 'array',
      fields: [
        { name: 'sourceId', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          options: [
            { label: 'Success', value: 'success' },
            { label: 'Failure', value: 'failure' },
          ],
        },
        { name: 'error', type: 'text' },
        { name: 'fetchedCount', type: 'number', defaultValue: 0 },
        { name: 'acceptedCount', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'digest',
      type: 'relationship',
      relationTo: 'digests',
    },
    {
      name: 'stats',
      type: 'group',
      fields: [
        { name: 'candidates', type: 'number', defaultValue: 0 },
        { name: 'deduped', type: 'number', defaultValue: 0 },
        { name: 'irrelevant', type: 'number', defaultValue: 0 },
        { name: 'summarized', type: 'number', defaultValue: 0 },
        { name: 'published', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'errorSummary',
      type: 'textarea',
    },
  ],
};
