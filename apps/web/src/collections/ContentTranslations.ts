import type { CollectionConfig } from 'payload';

import { isWorkerOrAdmin, publicRead } from '../access';

export const ContentTranslations: CollectionConfig = {
  slug: 'content-translations',
  admin: {
    useAsTitle: 'locale',
    group: 'Research',
    defaultColumns: ['locale', 'publication', 'updatedAt'],
  },
  access: {
    read: publicRead,
    create: isWorkerOrAdmin,
    update: isWorkerOrAdmin,
    delete: isWorkerOrAdmin,
  },
  fields: [
    {
      name: 'publication',
      type: 'relationship',
      relationTo: 'publications',
      required: true,
      index: true,
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
      index: true,
    },
    {
      name: 'fields',
      type: 'group',
      fields: [
        { name: 'objective', type: 'textarea' },
        { name: 'methods', type: 'textarea' },
        { name: 'results', type: 'textarea' },
        { name: 'limitations', type: 'textarea' },
        { name: 'whyItMatters', type: 'textarea' },
      ],
    },
  ],
};
