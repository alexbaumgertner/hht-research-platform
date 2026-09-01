/**
 * Seed hht-research with materials across all five source categories,
 * both importance levels, missing summary/date, and partial translations.
 *
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
        description: 'Monitoring materials related to Hereditary Hemorrhagic Telangiectasia.',
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

  async function ensureSource(input: {
    type: 'pubmed' | 'clinicaltrials' | 'rss';
    label: string;
    displayCategory?: 'news' | 'guideline' | 'social';
    rssUrl?: string;
  }) {
    const found = await payload.find({
      collection: 'monitored-sources',
      where: {
        and: [{ project: { equals: projectId } }, { label: { equals: input.label } }],
      },
      limit: 1,
      overrideAccess: true,
    });
    if (found.docs[0]) return found.docs[0].id as number;

    const created = await payload.create({
      collection: 'monitored-sources',
      data: {
        project: projectId!,
        type: input.type,
        label: input.label,
        enabled: true,
        ...(input.displayCategory ? { displayCategory: input.displayCategory } : {}),
        ...(input.rssUrl ? { rssUrl: input.rssUrl } : {}),
      },
      overrideAccess: true,
    });
    return created.id as number;
  }

  const pubmedSource = await ensureSource({ type: 'pubmed', label: 'PubMed HHT' });
  const trialsSource = await ensureSource({
    type: 'clinicaltrials',
    label: 'ClinicalTrials HHT',
  });
  const newsSource = await ensureSource({
    type: 'rss',
    label: 'HHT News RSS',
    displayCategory: 'news',
    rssUrl: 'https://example.com/hht-news.rss',
  });
  const guidelineSource = await ensureSource({
    type: 'rss',
    label: 'HHT Guidelines RSS',
    displayCategory: 'guideline',
    rssUrl: 'https://example.com/hht-guidelines.rss',
  });
  const socialSource = await ensureSource({
    type: 'rss',
    label: 'HHT Social RSS',
    displayCategory: 'social',
    rssUrl: 'https://example.com/hht-social.rss',
  });

  const run = await payload.create({
    collection: 'monitoring-runs',
    data: {
      project: projectId,
      status: 'completed',
      triggeredBy: 'manual',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      stats: {
        candidates: 8,
        deduped: 0,
        irrelevant: 0,
        summarized: 8,
        published: 8,
      },
    },
    overrideAccess: true,
  });

  const samples: Array<{
    key: string;
    title: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    sourceType: 'pubmed' | 'clinicaltrials' | 'rss';
    monitoredSource: number;
    objective?: string;
    publishedOrUpdatedAt?: string | null;
    url: string;
    translateDe?: boolean;
    includeAbstract?: boolean;
  }> = [
    {
      key: 'pubmed-high',
      title: 'Bevacizumab for severe HHT-related epistaxis',
      importance: 'critical',
      sourceType: 'pubmed',
      monitoredSource: pubmedSource,
      objective: 'Evaluate systemic bevacizumab for refractory epistaxis in HHT.',
      publishedOrUpdatedAt: '2026-08-20T10:00:00.000Z',
      url: 'https://pubmed.ncbi.nlm.nih.gov/seed-pubmed/',
      translateDe: true,
    },
    {
      key: 'trials',
      title: 'Phase II trial of anti-angiogenic therapy in HHT',
      importance: 'high',
      sourceType: 'clinicaltrials',
      monitoredSource: trialsSource,
      objective: 'Assess safety of anti-angiogenic therapy.',
      publishedOrUpdatedAt: '2026-08-18T10:00:00.000Z',
      url: 'https://clinicaltrials.gov/study/NCTSEED',
    },
    {
      key: 'news',
      title: 'New screening clinic opens for HHT families',
      importance: 'medium',
      sourceType: 'rss',
      monitoredSource: newsSource,
      objective: 'Clinic opening announcement covering pulmonary AVM screening.',
      publishedOrUpdatedAt: '2026-08-15T10:00:00.000Z',
      url: 'https://example.com/news/hht-clinic',
    },
    {
      key: 'guideline',
      title: 'Updated international guidelines for HHT management',
      importance: 'high',
      sourceType: 'rss',
      monitoredSource: guidelineSource,
      objective: 'Consensus recommendations for diagnosis and treatment.',
      publishedOrUpdatedAt: '2026-08-12T10:00:00.000Z',
      url: 'https://example.com/guidelines/hht-2026',
    },
    {
      key: 'social',
      title: 'Patient community thread on epistaxis care',
      importance: 'low',
      sourceType: 'rss',
      monitoredSource: socialSource,
      objective: 'Community discussion of home care strategies.',
      publishedOrUpdatedAt: '2026-08-10T10:00:00.000Z',
      url: 'https://example.com/social/hht-thread',
    },
    {
      key: 'no-summary',
      title: 'Brief note without structured summary',
      importance: 'medium',
      sourceType: 'pubmed',
      monitoredSource: pubmedSource,
      publishedOrUpdatedAt: '2026-08-08T10:00:00.000Z',
      url: 'https://pubmed.ncbi.nlm.nih.gov/seed-nosummary/',
    },
    {
      key: 'no-date',
      title: 'Undated registry entry for hepatic AVM',
      importance: 'low',
      sourceType: 'clinicaltrials',
      monitoredSource: trialsSource,
      objective: 'Registry entry missing a source publish date.',
      publishedOrUpdatedAt: null,
      url: 'https://clinicaltrials.gov/study/NCTSEEDNODATE',
    },
    {
      key: 'no-abstract',
      title: 'Trial protocol with summary but no stored abstract',
      importance: 'medium',
      sourceType: 'clinicaltrials',
      monitoredSource: trialsSource,
      objective: 'Protocol summary without collected abstract text.',
      publishedOrUpdatedAt: '2026-08-06T10:00:00.000Z',
      url: 'https://clinicaltrials.gov/study/NCTSEEDNOABS',
      includeAbstract: false,
    },
  ];

  const publicationIds: Array<string | number> = [];

  for (const sample of samples) {
    const existingPub = await payload.find({
      collection: 'publications',
      where: {
        and: [
          { project: { equals: projectId } },
          { dedupeKey: { equals: `seed:${slug}:${sample.key}` } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });

    let pubId = existingPub.docs[0]?.id;
    if (!pubId) {
      const pub = await payload.create({
        collection: 'publications',
        data: {
          project: projectId,
          dedupeKey: `seed:${slug}:${sample.key}`,
          title: sample.title,
          ...(sample.includeAbstract === false
            ? {}
            : { abstractOrBody: sample.objective || sample.title }),
          sourceType: sample.sourceType,
          originalUrl: sample.url,
          relevance: 'relevant',
          importance: sample.importance,
          ...(sample.objective
            ? {
                summary: {
                  objective: sample.objective,
                  methods: 'Narrative methods for seed data.',
                  results: 'Illustrative results for public feed testing.',
                  limitations: 'Seed data is not a real study.',
                  whyItMatters: 'Provides mixed materials for UI verification.',
                },
              }
            : {}),
          ...(sample.publishedOrUpdatedAt
            ? { publishedOrUpdatedAt: sample.publishedOrUpdatedAt }
            : {}),
          firstSeenRun: run.id,
          monitoredSource: sample.monitoredSource,
          externalIds: { pmid: `SEED-${sample.key}` },
        },
        overrideAccess: true,
      });
      pubId = pub.id;
    }
    publicationIds.push(pubId);

    if (sample.translateDe) {
      const existingTr = await payload.find({
        collection: 'content-translations',
        where: {
          and: [{ publication: { equals: pubId } }, { locale: { equals: 'de' } }],
        },
        limit: 1,
        overrideAccess: true,
      });
      if (!existingTr.docs[0]) {
        await payload.create({
          collection: 'content-translations',
          data: {
            publication: pubId,
            locale: 'de',
            title: 'Bevacizumab bei schwerer HHT-bedingter Epistaxis',
            fields: {
              objective:
                'Bewertung von systemischem Bevacizumab bei therapierefraktärer Epistaxis bei HHT.',
              methods: 'Narrative Methoden für Seed-Daten.',
              results: 'Illustrative Ergebnisse für die öffentliche Feed-Prüfung.',
              limitations: 'Seed-Daten sind keine echte Studie.',
              whyItMatters: 'Stellt gemischte Materialien für die UI-Prüfung bereit.',
            },
          },
          overrideAccess: true,
        });
      }
    }
  }

  await payload.create({
    collection: 'digests',
    data: {
      project: projectId,
      run: run.id,
      publishedAt: new Date().toISOString(),
      publications: publicationIds as number[],
    },
    overrideAccess: true,
  });

  const unpublishedExisting = await payload.find({
    collection: 'publications',
    where: {
      and: [
        { project: { equals: projectId } },
        { dedupeKey: { equals: `seed:${slug}:unpublished` } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  let unpublishedId = unpublishedExisting.docs[0]?.id;
  if (!unpublishedId) {
    const unpublished = await payload.create({
      collection: 'publications',
      data: {
        project: projectId,
        dedupeKey: `seed:${slug}:unpublished`,
        title: 'Unpublished item that must not appear publicly',
        abstractOrBody: 'Secret abstract that must not leak.',
        sourceType: 'pubmed',
        originalUrl: 'https://example.com/unpublished',
        relevance: 'relevant',
        importance: 'high',
        firstSeenRun: run.id,
        monitoredSource: pubmedSource,
        externalIds: { pmid: 'SEED-unpublished' },
      },
      overrideAccess: true,
    });
    unpublishedId = unpublished.id;
  }

  console.log(`Seeded project "${slug}" with ${publicationIds.length} materials.`);
  console.log(`Unpublished id for not-found check: ${unpublishedId}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
