import path from 'path';
import { fileURLToPath } from 'url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { resendAdapter } from '@payloadcms/email-resend';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { Users } from './collections/Users';
import { ResearchProjects } from './collections/ResearchProjects';
import { MonitoredSources } from './collections/MonitoredSources';
import { MonitoringRuns } from './collections/MonitoringRuns';
import { Publications } from './collections/Publications';
import { Digests } from './collections/Digests';
import { ContentTranslations } from './collections/ContentTranslations';
import { manualRunEndpoint } from './endpoints/manualRun';
import { getPublicSiteUrl } from './lib/siteUrl';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    ResearchProjects,
    MonitoredSources,
    MonitoringRuns,
    Publications,
    Digests,
    ContentTranslations,
  ],
  endpoints: [manualRunEndpoint],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  email: resendAdapter({
    defaultFromAddress: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    defaultFromName: process.env.RESEND_FROM_NAME || 'Research Monitoring',
    apiKey: process.env.RESEND_API_KEY || '',
  }),
  sharp,
  serverURL: getPublicSiteUrl(),
});
