import type { CollectionConfig } from 'payload';
import { isValidHttpUrl } from '@hht/shared';

import {
  canUpdateMonitoredSource,
  isAuthenticated,
  isWorkerOrAdmin,
  isWorkerOrAdminFieldLevel,
} from '../access';
import { revalidatePublicContent } from '../lib/publicCache';

/**
 * Public materials only show a source's displayCategory. The worker updates
 * lastSuccessfulFetchAt on every successful fetch, so dropping the caches for any change would
 * evict them during every ingestion run.
 */
export function sourceChangeAffectsPublicReads(
  operation: 'create' | 'update',
  doc: { displayCategory?: unknown },
  previousDoc?: { displayCategory?: unknown },
): boolean {
  return operation === 'create' || doc.displayCategory !== previousDoc?.displayCategory;
}

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
    // Public materials show the source's displayCategory: drop the cached lists when it changes.
    afterChange: [
      ({ doc, previousDoc, operation }) => {
        if (sourceChangeAffectsPublicReads(operation, doc, previousDoc)) revalidatePublicContent();
      },
    ],
    afterDelete: [() => revalidatePublicContent()],
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
    {
      name: 'cursorState',
      type: 'json',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Worker-owned (spec 004): while a backlog is drained, the ids already processed on the watermark day. Cleared when nothing is left over.',
      },
      access: {
        update: isWorkerOrAdminFieldLevel,
      },
    },
  ],
};
