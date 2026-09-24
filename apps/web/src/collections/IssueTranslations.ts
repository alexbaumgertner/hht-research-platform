import type { CollectionConfig } from 'payload';

import { denyWrite, isAuthenticated } from '../access';

/**
 * Cached translation of one issue's English text into one locale, and the
 * single-flight lock for that pair: the unique (digest, locale) index makes a
 * second concurrent claim fail in Postgres, across instances. Written by the web
 * app through the Local API with `overrideAccess`; never over REST.
 */
export const IssueTranslations: CollectionConfig = {
  slug: 'issue-translations',
  admin: {
    useAsTitle: 'locale',
    group: 'Research',
    defaultColumns: ['digest', 'locale', 'status', 'sourceRevision', 'updatedAt'],
  },
  access: {
    read: isAuthenticated,
    create: denyWrite,
    update: denyWrite,
    delete: isAuthenticated,
  },
  indexes: [{ fields: ['digest', 'locale'], unique: true }],
  fields: [
    {
      name: 'digest',
      type: 'relationship',
      relationTo: 'digests',
      required: true,
      index: true,
      maxDepth: 0,
    },
    {
      name: 'locale',
      type: 'select',
      required: true,
      options: [
        { label: 'German', value: 'de' },
        { label: 'Turkish', value: 'tr' },
        { label: 'Russian', value: 'ru' },
        { label: 'Ukrainian', value: 'uk' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Ready', value: 'ready' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'sourceRevision',
      type: 'number',
      required: true,
      admin: { description: "The digest's issueTextRevision this row was translated from." },
    },
    {
      name: 'leaseExpiresAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'retryAfter',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'attempts',
      type: 'number',
      defaultValue: 1,
      min: 1,
    },
    {
      name: 'error',
      type: 'text',
    },
    {
      name: 'summaryPoints',
      type: 'array',
      admin: { description: 'Positional: row i translates English summary point i.' },
      fields: [{ name: 'text', type: 'textarea', required: true }],
    },
    {
      name: 'itemSentences',
      type: 'array',
      fields: [
        {
          name: 'publication',
          type: 'relationship',
          relationTo: 'publications',
          required: true,
          maxDepth: 0,
        },
        { name: 'sentence', type: 'textarea', required: true },
      ],
    },
  ],
};
