import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
} from 'payload';

import { isAuthenticated, isAuthenticatedOrWorker, isWorkerOrAdmin } from '../access';

const chatSourceOptions = [
  { label: 'VK', value: 'vk' },
  { label: 'WhatsApp', value: 'wa' },
  { label: 'Facebook', value: 'fb' },
  { label: 'Telegram', value: 'tg' },
  { label: 'Other', value: 'other' },
];

const hiddenToken = {
  admin: { hidden: true, disableListColumn: true, disableListFilter: true },
} as const;

/** Owner may only move a row to unsubscribed. The sweep and local API write the rest. */
const ownerMayOnlyUnsubscribe: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  if (!data || operation !== 'update') return data;
  if (!req.user) return data;
  const roles = (req.user as { roles?: string[] }).roles;
  if (roles?.includes('worker')) return data;

  const next = data.status as string | undefined;
  const previous = (originalDoc as { status?: string } | undefined)?.status;
  if (next && next !== previous && next !== 'unsubscribed') {
    throw new Error('You can only unsubscribe a subscriber');
  }
  if (next === 'unsubscribed') {
    data.unsubscribedAt = new Date().toISOString();
    data.status = 'unsubscribed';
  }
  return data;
};

const deleteDeliveries: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'issue-deliveries',
    where: { subscriber: { equals: id } },
    req,
    overrideAccess: true,
  });
};

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  admin: {
    useAsTitle: 'email',
    group: 'Research',
    defaultColumns: ['email', 'language', 'source', 'status', 'consentAt', 'project'],
  },
  access: {
    read: isAuthenticatedOrWorker,
    create: isWorkerOrAdmin,
    update: isAuthenticatedOrWorker,
    delete: isAuthenticated,
  },
  indexes: [{ fields: ['project', 'email'], unique: true }],
  hooks: {
    beforeChange: [ownerMayOnlyUnsubscribe],
    beforeDelete: [deleteDeliveries],
  },
  fields: [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'research-projects',
      required: true,
      index: true,
      maxDepth: 0,
    },
    { name: 'email', type: 'text', required: true },
    {
      name: 'language',
      type: 'select',
      required: true,
      options: [
        { label: 'Russian', value: 'ru' },
        { label: 'English', value: 'en' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'other',
      options: chatSourceOptions,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
      admin: {
        description:
          'Set to Unsubscribed to stop mail. There is no action that emails this person.',
      },
    },
    { name: 'consentAt', type: 'date', required: true },
    { name: 'confirmationTokenHash', type: 'text', unique: true, index: true, ...hiddenToken },
    { name: 'confirmationExpiresAt', type: 'date', ...hiddenToken },
    { name: 'confirmationSentAt', type: 'date', ...hiddenToken },
    { name: 'unsubscribeTokenHash', type: 'text', unique: true, index: true, ...hiddenToken },
    { name: 'unsubscribedAt', type: 'date', admin: { readOnly: true } },
  ],
};
