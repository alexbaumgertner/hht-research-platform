import type { CmsClient, CmsId } from '../cms/client.js';
import { pubmedAdapter } from '../adapters/pubmed.js';
import { clinicalTrialsAdapter } from '../adapters/clinicaltrials.js';
import { rssAdapter } from '../adapters/rss.js';
import type { SourceAdapter } from '../adapters/types.js';
import { logError, logInfo } from '../log.js';
import { sourceSince } from './publish.js';

export type ProjectForCheck = {
  id: CmsId;
  slug: string;
  keywords: string[];
  lastSuccessfulRunAt: string | null;
  bootstrapLookbackDays: number;
  sources: Array<{
    id: CmsId;
    type: 'pubmed' | 'clinicaltrials' | 'rss';
    rssUrl?: string | null;
    enabled: boolean;
    lastSuccessfulFetchAt?: string | null;
  }>;
};

export type CheckProjectDeps = {
  adapters?: Record<'pubmed' | 'clinicaltrials' | 'rss', SourceAdapter>;
};

const defaultAdapters = {
  pubmed: pubmedAdapter,
  clinicaltrials: clinicalTrialsAdapter,
  rss: rssAdapter,
};

/**
 * Daily lightweight check for projects that are not due for a run (spec 004, OQ2): every enabled
 * source is queried once with a minimal limit. No AI calls, no publications, no watermarks, no run
 * record. Only when every source answered is `lastCheckedAt` moved; otherwise an ERROR is logged
 * and the health rule turns unhealthy after 26 h without a check.
 */
export async function checkProject(
  cms: CmsClient,
  project: ProjectForCheck,
  deps: CheckProjectDeps = {},
): Promise<boolean> {
  const sourceAdapters = deps.adapters ?? defaultAdapters;
  let allOk = true;

  for (const source of project.sources.filter((s) => s.enabled)) {
    try {
      await sourceAdapters[source.type].fetchCandidates({
        keywords: project.keywords,
        since: sourceSince(source, project),
        bootstrapLookbackDays: project.bootstrapLookbackDays,
        limit: 1,
        rssUrl: source.rssUrl || undefined,
      });
    } catch (err) {
      allOk = false;
      logError('source check failed', err, {
        projectId: project.id,
        projectSlug: project.slug,
        sourceId: source.id,
        sourceType: source.type,
      });
    }
  }

  if (allOk) {
    await cms.patchProjectChecked(project.id, new Date().toISOString());
    logInfo('project checked', { projectId: project.id, projectSlug: project.slug });
  }
  return allOk;
}
