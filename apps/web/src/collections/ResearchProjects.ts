import type { CollectionConfig } from 'payload';
import {
  hasNonEmptyKeywords,
  normalizeEmbedOrigin,
  PartnerKeySchema,
  type KeywordInput,
} from '@hht/shared';

import {
  canUpdateResearchProject,
  isAuthenticated,
  isAuthenticatedOrWorker,
  isWorkerOrAdminFieldLevel,
} from '../access';
import { revalidateEmbed } from '../lib/embed/revalidateEmbed';

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
    afterChange: [
      ({ doc, previousDoc }) => {
        const watched = ['embedPartners', 'name', 'slug'] as const;
        const changed =
          !previousDoc ||
          watched.some(
            (f) => JSON.stringify(doc[f] ?? null) !== JSON.stringify(previousDoc[f] ?? null),
          );
        if (changed) revalidateEmbed(doc.id);
        return doc;
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const subscribers = await req.payload.find({
          collection: 'subscribers',
          where: { project: { equals: id } },
          depth: 0,
          pagination: false,
          overrideAccess: true,
          req,
        });
        for (const subscriber of subscribers.docs) {
          await req.payload.delete({
            collection: 'subscribers',
            id: subscriber.id,
            overrideAccess: true,
            req,
          });
        }
        await req.payload.delete({
          collection: 'vk-posts',
          where: { project: { equals: id } },
          overrideAccess: true,
          req,
        });
        await req.payload.delete({
          collection: 'analytics-counts',
          where: { project: { equals: id } },
          overrideAccess: true,
          req,
        });
      },
    ],
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
        const partners = data.embedPartners as
          Array<{ key?: string; origins?: Array<{ origin?: string }> }> | undefined;
        if (partners) {
          const keys = new Set<string>();
          for (const partner of partners) {
            const key = partner.key ?? '';
            if (keys.has(key)) throw new Error(`Duplicate embed partner key: ${key}`);
            keys.add(key);
            const seen = new Set<string>();
            for (const row of partner.origins ?? []) {
              const origin = normalizeEmbedOrigin(row.origin ?? '');
              if (!origin) throw new Error(`Invalid embed origin: ${row.origin}`);
              if (seen.has(origin)) throw new Error(`Duplicate embed origin: ${origin}`);
              seen.add(origin);
              row.origin = origin;
            }
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
      name: 'emailFromName',
      type: 'text',
      admin: {
        description:
          'Name shown as the sender of subscriber email. Falls back to the project name.',
      },
    },
    {
      name: 'vkCommunityId',
      type: 'text',
      admin: {
        description:
          'Numeric VK community id, without a minus sign. Empty means VK posting is off.',
      },
    },
    {
      name: 'subscriberCounts',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/admin/SubscriberCounts#SubscriberCounts',
        },
      },
    },
    {
      name: 'subscriberMetrics',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/admin/SubscriberMetrics#SubscriberMetrics',
        },
      },
    },
    {
      type: 'collapsible',
      label: 'Embedding',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'embedPartners',
          type: 'array',
          admin: {
            description:
              'Partner sites that may embed the digest widget. The key is used in the widget URL and in the subscription source site:<key>.',
          },
          fields: [
            { name: 'name', type: 'text', required: true, maxLength: 80 },
            {
              name: 'key',
              type: 'text',
              required: true,
              admin: {
                description:
                  'Lowercase letters, digits and dashes, 2-32 chars. Unique within the project.',
              },
              validate: (value: unknown) =>
                PartnerKeySchema.safeParse(value).success
                  ? true
                  : 'Use 2-32 lowercase letters, digits or dashes, starting with a letter or digit',
            },
            {
              name: 'origins',
              type: 'array',
              minRows: 1,
              admin: {
                description:
                  'Exact origins like https://example.org (no path or wildcard). Duplicates are rejected.',
              },
              fields: [
                {
                  name: 'origin',
                  type: 'text',
                  required: true,
                  validate: (value: unknown) =>
                    typeof value === 'string' && normalizeEmbedOrigin(value) !== null
                      ? true
                      : 'Use an exact https origin like https://example.org (http only for localhost, 127.0.0.1, *.test)',
                },
              ],
            },
            {
              name: 'fallbackCommunityUrl',
              type: 'text',
              admin: { description: 'Optional https URL used in the snippet fallback block.' },
              validate: (value: unknown) => {
                if (value == null || value === '') return true;
                try {
                  return new URL(String(value)).protocol === 'https:' ? true : 'Use an https URL';
                } catch {
                  return 'Use an https URL';
                }
              },
            },
          ],
        },
      ],
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
