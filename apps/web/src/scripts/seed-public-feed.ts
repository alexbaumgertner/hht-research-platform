/**
 * Seed one research project with digests + mixed-importance publications.
 * Usage: DATABASE_URL=... PAYLOAD_SECRET=... pnpm --filter @hht/web seed:public-feed
 */
import { getPayload } from 'payload';
import config from '@payload-config';

async function seed() {
  const payload = await getPayload({ config });

  const existingUsers = await payload.find({
    collection: 'users',
    limit: 1,
    overrideAccess: true,
  });

  let ownerId = existingUsers.docs[0]?.id;
  if (!ownerId) {
    const owner = await payload.create({
      collection: 'users',
      data: {
        email: process.env.SEED_OWNER_EMAIL || 'owner@example.com',
        password: process.env.SEED_OWNER_PASSWORD || 'ChangeMe123!',
        roles: ['admin'],
      },
      overrideAccess: true,
    });
    ownerId = owner.id;
  }

  const slug = 'hht-research';
  const existing = await payload.find({
    collection: 'research-projects',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  });

  let projectId = existing.docs[0]?.id;
  if (!projectId) {
    const project = await payload.create({
      collection: 'research-projects',
      data: {
        name: 'HHT Research',
        slug,
        description: 'Monitoring publications related to Hereditary Hemorrhagic Telangiectasia.',
        keywords: [{ value: 'HHT' }, { value: 'hereditary hemorrhagic telangiectasia' }],
        schedule: 'daily',
        monitoringStatus: 'active',
        emailNotificationEnabled: false,
        owner: ownerId,
        hasPublishedDigest: false,
      },
      overrideAccess: true,
    });
    projectId = project.id;
  }

  const run = await payload.create({
    collection: 'monitoring-runs',
    data: {
      project: projectId,
      status: 'completed',
      triggeredBy: 'manual',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      stats: {
        candidates: 4,
        deduped: 0,
        irrelevant: 0,
        summarized: 4,
        published: 4,
      },
    },
    overrideAccess: true,
  });

  const samples = [
    {
      title: 'Bevacizumab for severe HHT-related epistaxis',
      importance: 'critical' as const,
      objective: 'Evaluate systemic bevacizumab for refractory epistaxis in HHT.',
    },
    {
      title: 'Screening protocols for pulmonary AVMs in HHT',
      importance: 'high' as const,
      objective: 'Compare imaging strategies for detecting pulmonary AVMs.',
    },
    {
      title: 'Quality of life after nasal closure procedures',
      importance: 'medium' as const,
      objective: 'Assess patient-reported outcomes after surgical interventions.',
    },
    {
      title: 'Case report: atypical hepatic involvement',
      importance: 'low' as const,
      objective: 'Describe an uncommon hepatic presentation of HHT.',
    },
  ];

  const publicationIds: Array<string | number> = [];
  for (const [index, sample] of samples.entries()) {
    const pub = await payload.create({
      collection: 'publications',
      data: {
        project: projectId,
        dedupeKey: `seed:${slug}:${index}`,
        title: sample.title,
        abstractOrBody: sample.objective,
        sourceType: 'pubmed',
        originalUrl: `https://pubmed.ncbi.nlm.nih.gov/seed${index}/`,
        relevance: 'relevant',
        importance: sample.importance,
        summary: {
          objective: sample.objective,
          methods: 'Narrative methods for seed data.',
          results: 'Illustrative results for public feed testing.',
          limitations: 'Seed data is not a real study.',
          whyItMatters: 'Provides mixed importance levels for UI filters.',
        },
        firstSeenRun: run.id,
        externalIds: { pmid: `SEED${index}` },
      },
      overrideAccess: true,
    });
    publicationIds.push(pub.id);
  }

  await payload.create({
    collection: 'digests',
    data: {
      project: projectId,
      run: run.id,
      publishedAt: new Date().toISOString(),
      publications: publicationIds,
    },
    overrideAccess: true,
  });

  console.log(`Seeded project "${slug}" with ${publicationIds.length} publications.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
