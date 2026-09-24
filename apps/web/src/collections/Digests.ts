import type {
  CollectionConfig,
  RelationshipFieldManyValidation,
  RelationshipFieldSingleValidation,
} from 'payload';
import { relationship } from 'payload/shared';

import {
  isAdminFieldLevel,
  isAuthenticated,
  isAuthenticatedOrWorker,
  isWorkerFieldLevel,
  isWorkerOrAdmin,
} from '../access';
import {
  applyIssueTextRules,
  assertDigestHasPublications,
  capCreateDepth,
  invalidateIssueTranslations,
  resolveRelationshipId,
  stampFeedPublishedAt,
  validateRefsWithinDigest,
} from './digestHooks';

const itemsWithinDigest: RelationshipFieldManyValidation = async (value, options) => {
  const base = await relationship(value, options);
  if (base !== true) return base;
  return validateRefsWithinDigest(value, options.data as Record<string, unknown>);
};

const publicationWithinDigest: RelationshipFieldSingleValidation = async (value, options) => {
  const base = await relationship(value, options);
  if (base !== true) return base;
  return validateRefsWithinDigest(value, options.data as Record<string, unknown>);
};

const workerOnlyWrite = { create: isWorkerFieldLevel, update: isWorkerFieldLevel };
const systemOnlyWrite = { create: () => false, update: () => false };

export const Digests: CollectionConfig = {
  slug: 'digests',
  admin: {
    useAsTitle: 'publishedAt',
    group: 'Research',
    defaultColumns: ['publishedAt', 'project', 'issueTextStatus', 'updatedAt'],
  },
  access: {
    read: isAuthenticatedOrWorker,
    create: isWorkerOrAdmin,
    update: isWorkerOrAdmin,
    delete: isAuthenticated,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        assertDigestHasPublications(data, operation);
        return data;
      },
    ],
    beforeOperation: [({ args, operation }) => capCreateDepth(args, operation)],
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        if (operation !== 'update') return data;
        return applyIssueTextRules({ data, originalDoc, req });
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        if (operation === 'update') {
          await invalidateIssueTranslations(doc, previousDoc, req);
          return;
        }
        if (operation !== 'create') return;
        const projectId = resolveRelationshipId(doc.project);
        if (!projectId) return;
        // Email is sent by the worker (`sendDigestPublishedEmail`), not this hook.
        // Nested `payload.update()` *without* `req` starts a second postgres
        // transaction while create still holds the first — that stalls the pool
        // until Vercel FUNCTION_INVOCATION_TIMEOUT (504). Share `req` so this
        // is one SET on the same connection. Jobs queue is not configured.
        await req.payload.db.updateOne({
          collection: 'research-projects',
          id: projectId,
          data: { hasPublishedDigest: true },
          req,
          returning: false,
        });
        await stampFeedPublishedAt(doc, req);
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
      maxDepth: 1,
    },
    {
      name: 'run',
      type: 'relationship',
      relationTo: 'monitoring-runs',
      required: true,
      // Break circular populate: run.digest → digest.run → …
      maxDepth: 1,
    },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'publications',
      type: 'relationship',
      relationTo: 'publications',
      hasMany: true,
      required: true,
      minRows: 1,
      // Cap nested populate (project / firstSeenRun) so a default-depth REST
      // create does not N+1 through every related publication.
      maxDepth: 1,
    },
    {
      name: 'hiddenFromPublic',
      type: 'checkbox',
      defaultValue: false,
      access: { create: isAdminFieldLevel, update: isAdminFieldLevel },
      admin: {
        position: 'sidebar',
        description:
          'Hide this issue page, its archive entry and its share image. Its materials stay in the public feed.',
      },
    },
    {
      type: 'collapsible',
      label: 'Issue',
      fields: [
        {
          name: 'issueTextStatus',
          type: 'select',
          defaultValue: 'pending',
          options: [
            {
              label: 'Queued for (re)generation (runs at the next hourly check)',
              value: 'pending',
            },
            { label: 'Ready', value: 'ready' },
            { label: 'Failed', value: 'failed' },
          ],
          admin: {
            description:
              'Set to "Queued" to regenerate the issue text. Editing the text below marks it Ready. ' +
              'An edit saved while the hourly check is regenerating this digest is overwritten; re-apply it if that happens.',
          },
        },
        {
          name: 'issueSummaryPoints',
          type: 'array',
          maxRows: 5,
          labels: { singular: 'Summary point', plural: 'Summary points' },
          fields: [
            {
              name: 'text',
              type: 'textarea',
              required: true,
            },
            {
              name: 'items',
              type: 'relationship',
              relationTo: 'publications',
              hasMany: true,
              required: true,
              maxDepth: 0,
              validate: itemsWithinDigest,
              admin: { description: 'The materials in this digest this point is based on.' },
            },
          ],
        },
        {
          name: 'issueItemSentences',
          type: 'array',
          labels: { singular: 'Item sentence', plural: 'Item sentences' },
          fields: [
            {
              name: 'publication',
              type: 'relationship',
              relationTo: 'publications',
              required: true,
              maxDepth: 0,
              validate: publicationWithinDigest,
            },
            {
              name: 'sentence',
              type: 'textarea',
              required: true,
            },
          ],
        },
        {
          name: 'issueTextAttempts',
          type: 'number',
          defaultValue: 0,
          min: 0,
          access: workerOnlyWrite,
          admin: {
            readOnly: true,
            description: 'Failed generation attempts since the last queueing. Stops at 3.',
          },
        },
        {
          name: 'issueTextError',
          type: 'text',
          access: workerOnlyWrite,
          admin: { readOnly: true, description: 'Last generation failure.' },
        },
        {
          name: 'issueTextGeneratedAt',
          type: 'date',
          access: workerOnlyWrite,
          admin: {
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
        {
          name: 'issueTextSource',
          type: 'select',
          options: [
            { label: 'Generated', value: 'generated' },
            { label: 'Edited by owner', value: 'edited' },
          ],
          access: workerOnlyWrite,
          admin: { readOnly: true },
        },
        {
          name: 'issueTextRevision',
          type: 'number',
          defaultValue: 0,
          min: 0,
          access: systemOnlyWrite,
          admin: {
            readOnly: true,
            description: 'Bumped whenever the English text changes; cached translations follow it.',
          },
        },
      ],
    },
  ],
};
