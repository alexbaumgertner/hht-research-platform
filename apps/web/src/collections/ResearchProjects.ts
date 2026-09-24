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
        if (data.schedule === 'weekly') {
          const hasWeekday = data.publishWeekday != null;
          const hasHour = data.publishHourUtc != null;
          if (hasWeekday !== hasHour) {
            throw new Error('Set both publish weekday and hour, or neither');
          }
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
      type: 'row',
      fields: [
        {
          name: 'publishWeekday',
          type: 'select',
          options: [
            { label: 'Monday', value: 'monday' },
            { label: 'Tuesday', value: 'tuesday' },
            { label: 'Wednesday', value: 'wednesday' },
            { label: 'Thursday', value: 'thursday' },
            { label: 'Friday', value: 'friday' },
            { label: 'Saturday', value: 'saturday' },
            { label: 'Sunday', value: 'sunday' },
          ],
          admin: {
            condition: (data) => data?.schedule === 'weekly',
            description:
              'Weekly issues publish on this day. Leave empty to keep a rolling 7-day cadence.',
          },
        },
        {
          name: 'publishHourUtc',
          type: 'number',
          min: 0,
          max: 23,
          validate: (value: number | null | undefined) => {
            if (value == null) return true;
            if (!Number.isInteger(value) || value < 0 || value > 23) {
              return 'Publish hour must be a whole hour from 0 to 23 (UTC)';
            }
            return true;
          },
          admin: {
            step: 1,
            condition: (data) => data?.schedule === 'weekly' || data?.schedule === 'daily',
            description: 'Hour of day in UTC (0–23) at which the scheduled run publishes.',
          },
        },
      ],
    },
    {
      name: 'audienceContext',
      type: 'textarea',
      admin: {
        description:
          'Who reads the issues, in plain words. Used in the prompts that write the issue text.',
      },
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
