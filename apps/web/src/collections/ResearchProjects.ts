import type { CollectionConfig } from 'payload';
import { hasNonEmptyKeywords, type KeywordInput } from '@hht/shared';

import {
  canUpdateResearchProject,
  isAuthenticated,
  isAuthenticatedOrWorker,
  isWorkerOrAdminFieldLevel,
} from '../access';

export const ResearchProjects: CollectionConfig = {
  slug: 'research-projects',
  admin: {
    useAsTitle: 'name',
    group: 'Research',
    defaultColumns: ['name', 'slug', 'monitoringStatus', 'schedule', 'updatedAt'],
  },
  access: {
    read: isAuthenticatedOrWorker,
    create: isAuthenticated,
    update: canUpdateResearchProject,
    delete: isAuthenticated,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (!data) return data;
        const status = data.monitoringStatus;
        const keywords = data.keywords as KeywordInput[] | undefined;
        if (status === 'active' && !hasNonEmptyKeywords(keywords)) {
          throw new Error('Cannot activate monitoring with empty keywords');
        }
        if (operation === 'create' && !data.monitoringStatus) {
          data.monitoringStatus = 'active';
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Used in public URL /[locale]/projects/[slug]',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'keywords',
      type: 'array',
      labels: { singular: 'Keyword', plural: 'Keywords' },
      minRows: 0,
      fields: [
        {
          name: 'value',
          type: 'text',
          required: true,
        },
      ],
      admin: {
        description: 'OR semantics when querying sources. Required to activate monitoring.',
      },
    },
    {
      name: 'schedule',
      type: 'select',
      required: true,
      defaultValue: 'daily',
      options: [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
      ],
    },
    {
      name: 'monitoringStatus',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
      ],
    },
    {
      name: 'lastSuccessfulRunAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Watermark advanced by worker on successful/partial runs',
      },
      access: {
        update: isWorkerOrAdminFieldLevel,
      },
    },
    {
      name: 'bootstrapLookbackDays',
      type: 'number',
      defaultValue: 30,
      min: 1,
      max: 365,
    },
    {
      name: 'emailNotificationEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Send a short link-only email when a digest is published',
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'hasPublishedDigest',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Denormalized: true when ≥1 digest exists (FR-021)',
      },
      access: {
        update: isWorkerOrAdminFieldLevel,
      },
    },
  ],
};
