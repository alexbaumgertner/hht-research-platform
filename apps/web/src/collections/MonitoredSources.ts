import type { CollectionConfig } from 'payload';
import { isValidHttpUrl } from '@hht/shared';

import {
  canUpdateMonitoredSource,
  isAuthenticated,
  isWorkerOrAdmin,
  isWorkerOrAdminFieldLevel,
} from '../access';

export const MonitoredSources: CollectionConfig = {
  slug: 'monitored-sources',
  admin: {
    useAsTitle: 'label',
    group: 'Research',
    defaultColumns: ['label', 'type', 'enabled', 'project'],
  },
  access: {
    read: isWorkerOrAdmin,
    create: isAuthenticated,
    update: canUpdateMonitoredSource,
    delete: isAuthenticated,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data;
        if (data.type === 'rss') {
          const url = data.rssUrl as string | undefined;
          if (!url || !isValidHttpUrl(url)) {
            throw new Error('RSS sources require a valid http(s) URL');
          }
        }
        return data;
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
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'PubMed', value: 'pubmed' },
        { label: 'ClinicalTrials.gov', value: 'clinicaltrials' },
        { label: 'RSS', value: 'rss' },
      ],
    },
    {
      name: 'label',
      type: 'text',
    },
    {
      name: 'rssUrl',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'rss',
        description: 'Required when type is RSS',
      },
      validate: (
        value: string | null | undefined,
        { siblingData }: { siblingData?: { type?: string } },
      ) => {
        if (siblingData?.type === 'rss') {
          if (!value || !isValidHttpUrl(value)) {
            return 'A valid http(s) RSS URL is required';
          }
        }
        return true;
      },
    },
    {
      name: 'displayCategory',
      type: 'select',
      options: [
        { label: 'News', value: 'news' },
        { label: 'Guideline', value: 'guideline' },
        { label: 'Social', value: 'social' },
      ],
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'rss',
        description: 'Reader-facing badge for RSS materials. Unset defaults to News at read time.',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'lastSuccessfulFetchAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Per-source watermark set by the worker when this source succeeds. A failing source keeps its window for the next run.',
      },
      access: {
        update: isWorkerOrAdminFieldLevel,
      },
    },
  ],
};
