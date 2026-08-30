import { CONTENT_TRANSLATION_LOCALES, dedupeKey, type Summary } from '@hht/shared';
import type { CmsClient } from '../cms/client.js';
import { pubmedAdapter } from '../adapters/pubmed.js';
import { clinicalTrialsAdapter } from '../adapters/clinicaltrials.js';
import { rssAdapter } from '../adapters/rss.js';
import type { SourceAdapter } from '../adapters/types.js';
import { classifyRelevance, summarizeAndRank } from './ai.js';
import { translateSummary } from './translate.js';
import {
  clampBatch,
  formatDigestStepError,
  resolveRunStatus,
  shouldPublishDigest,
  statusAfterDigestStepFailure,
} from './publish.js';
import { sendDigestPublishedEmail } from '../notify/digestEmail.js';

const adapters: Record<'pubmed' | 'clinicaltrials' | 'rss', SourceAdapter> = {
  pubmed: pubmedAdapter,
  clinicaltrials: clinicalTrialsAdapter,
  rss: rssAdapter,
};

function shouldTranslateOnPublish(): boolean {
  const raw = process.env.TRANSLATE_ON_PUBLISH;
  if (raw === undefined || raw === '') return true;
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

async function pregenerateTranslations(
  cms: CmsClient,
  publications: Array<{ id: string | number; title: string; summary: Summary }>,
): Promise<void> {
  if (!shouldTranslateOnPublish()) return;

  for (const pub of publications) {
    for (const locale of CONTENT_TRANSLATION_LOCALES) {
      try {
        const { title, ...fields } = await translateSummary(pub.title, pub.summary, locale);
        await cms.createContentTranslation({
          publication: pub.id,
          locale,
          title,
          fields,
        });
      } catch (err) {
        console.error(
          `[worker] translation failed for publication ${pub.id} locale=${locale}`,
          err,
        );
      }
    }
  }
}

export type ProjectForRun = {
  id: string;
  name: string;
  slug: string;
  keywords: string[];
  lastSuccessfulRunAt: string | null;
  bootstrapLookbackDays: number;
  emailNotificationEnabled: boolean;
  ownerEmail?: string;
  sources: Array<{
    id: string;
    type: 'pubmed' | 'clinicaltrials' | 'rss';
    rssUrl?: string | null;
    enabled: boolean;
  }>;
};

export async function runProject(
  cms: CmsClient,
  project: ProjectForRun,
  triggeredBy: 'schedule' | 'manual' = 'schedule',
): Promise<void> {
  const created = await cms.createRun(project.id, triggeredBy);
  const runId = created.doc.id;

  const sourceResults: Array<{
    sourceId: string;
    status: 'success' | 'failure';
    error?: string;
    fetchedCount: number;
    acceptedCount: number;
  }> = [];

  const stats = {
    candidates: 0,
    deduped: 0,
    irrelevant: 0,
    summarized: 0,
    published: 0,
  };

  const qualifying: Array<{ id: string | number; title: string; summary: Summary }> = [];
  const since = project.lastSuccessfulRunAt ? new Date(project.lastSuccessfulRunAt) : null;

  for (const source of project.sources.filter((s) => s.enabled)) {
    try {
      const adapter = adapters[source.type];
      const fetched = await adapter.fetchCandidates({
        keywords: project.keywords,
        since,
        bootstrapLookbackDays: project.bootstrapLookbackDays,
        limit: cms.batchSize,
        rssUrl: source.rssUrl || undefined,
      });
      const batch = clampBatch(fetched, cms.batchSize);
      stats.candidates += batch.length;
      let accepted = 0;

      for (const candidate of batch) {
        const key = dedupeKey(candidate.externalIds, candidate.title, candidate.sourceType);
        const existing = await cms.findPublicationByDedupe(project.id, key);
        if (existing) {
          stats.deduped += 1;
          continue;
        }

        const relevant = await classifyRelevance({
          title: candidate.title,
          abstractOrBody: candidate.abstractOrBody,
          keywords: project.keywords,
        });

        if (!relevant) {
          stats.irrelevant += 1;
          await cms.createPublication({
            project: project.id,
            externalIds: candidate.externalIds,
            dedupeKey: key,
            title: candidate.title,
            abstractOrBody: candidate.abstractOrBody,
            sourceType: candidate.sourceType,
            originalUrl: candidate.originalUrl,
            publishedOrUpdatedAt: candidate.publishedOrUpdatedAt?.toISOString(),
            relevance: 'irrelevant',
            firstSeenRun: runId,
            monitoredSource: source.id,
          });
          continue;
        }

        const { importance, summary } = await summarizeAndRank({
          title: candidate.title,
          abstractOrBody: candidate.abstractOrBody,
          keywords: project.keywords,
        });
        stats.summarized += 1;

        const createdPub = await cms.createPublication({
          project: project.id,
          externalIds: candidate.externalIds,
          dedupeKey: key,
          title: candidate.title,
          abstractOrBody: candidate.abstractOrBody,
          sourceType: candidate.sourceType,
          originalUrl: candidate.originalUrl,
          publishedOrUpdatedAt: candidate.publishedOrUpdatedAt?.toISOString(),
          relevance: 'relevant',
          importance,
          summary,
          firstSeenRun: runId,
          monitoredSource: source.id,
        });
        qualifying.push({ id: createdPub.doc.id, title: candidate.title, summary });
        accepted += 1;
      }

      sourceResults.push({
        sourceId: source.id,
        status: 'success',
        fetchedCount: batch.length,
        acceptedCount: accepted,
      });
    } catch (err) {
      sourceResults.push({
        sourceId: source.id,
        status: 'failure',
        error: err instanceof Error ? err.message : String(err),
        fetchedCount: 0,
        acceptedCount: 0,
      });
    }
  }

  const outcomes = sourceResults.map((r) => r.status);
  const resolved = resolveRunStatus(outcomes);
  let status = resolved.status;
  const { advanceWatermark } = resolved;
  const finishedAt = new Date().toISOString();
  let digestId: string | number | undefined;
  let errorSummary: string | undefined =
    status === 'failed' ? 'No sources processed successfully' : undefined;

  if (shouldPublishDigest({ qualifyingCount: qualifying.length })) {
    try {
      const digest = await cms.createDigest({
        project: project.id,
        run: runId,
        publishedAt: finishedAt,
        publications: qualifying.map((q) => q.id),
      });
      digestId = digest.doc.id;
      stats.published = qualifying.length;

      await pregenerateTranslations(cms, qualifying);

      if (project.emailNotificationEnabled && project.ownerEmail) {
        await sendDigestPublishedEmail({
          to: project.ownerEmail,
          projectName: project.name,
          projectSlug: project.slug,
          projectId: project.id,
        });
      }
    } catch (err) {
      console.error('[worker] digest publish step failed', err);
      errorSummary = formatDigestStepError(err);
      status = statusAfterDigestStepFailure(status);
    }
  }

  await cms.updateRun(runId, {
    status,
    finishedAt,
    sourceResults,
    stats,
    digest: digestId,
    errorSummary,
  });

  if (advanceWatermark) {
    await cms.patchProjectWatermark(project.id, finishedAt);
  }
}
