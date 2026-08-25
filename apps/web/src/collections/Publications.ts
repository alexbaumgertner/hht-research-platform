import type { CollectionConfig } from 'payload';

import { isAuthenticated, isWorkerOrAdmin, publicRead } from '../access';

export const Publications: CollectionConfig = {
  slug: 'publications',
  admin: {
    useAsTitle: 'title',
    group: 'Research',
    defaultColumns: ['title', 'importance', 'relevance', 'sourceType', 'project'],
  },
  access: {
    read: publicRead,
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
      name: 'externalIds',
      type: 'group',
      fields: [
        { name: 'pmid', type: 'text' },
        { name: 'doi', type: 'text' },
        { name: 'nctId', type: 'text' },
        { name: 'guid', type: 'text' },
      ],
    },
    {
      name: 'dedupeKey',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'abstractOrBody',
      type: 'textarea',
    },
    {
      name: 'sourceType',
      type: 'select',
      required: true,
      options: [
        { label: 'PubMed', value: 'pubmed' },
        { label: 'ClinicalTrials.gov', value: 'clinicaltrials' },
        { label: 'RSS', value: 'rss' },
      ],
    },
    {
      name: 'originalUrl',
      type: 'text',
      required: true,
    },
    {
      name: 'publishedOrUpdatedAt',
      type: 'date',
    },
    {
      name: 'relevance',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Relevant', value: 'relevant' },
        { label: 'Irrelevant', value: 'irrelevant' },
      ],
    },
    {
      name: 'importance',
      type: 'select',
      options: [
        { label: 'Critical', value: 'critical' },
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
        { label: 'Low', value: 'low' },
      ],
    },
    {
      name: 'summary',
      type: 'group',
      fields: [
        { name: 'objective', type: 'textarea' },
        { name: 'methods', type: 'textarea' },
        { name: 'results', type: 'textarea' },
        { name: 'limitations', type: 'textarea' },
        { name: 'whyItMatters', type: 'textarea' },
      ],
    },
    {
      name: 'firstSeenRun',
      type: 'relationship',
      relationTo: 'monitoring-runs',
    },
  ],
};
