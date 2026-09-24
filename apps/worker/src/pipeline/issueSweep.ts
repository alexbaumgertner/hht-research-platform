import {
  CmsHttpError,
  ISSUE_TEXT_MAX_ATTEMPTS,
  type CmsClient,
  type IssueProjectDoc,
  type IssueTextWorkDigest,
} from '../cms/client.js';
import { logError, logInfo, logWarning } from '../log.js';
import { generateIssueText, type IssueText } from './issueText.js';

export const ISSUE_TEXT_ERROR_MAX_CHARS = 300;

export type IssueSweepCms = Pick<
  CmsClient,
  'listIssueTextWork' | 'getProject' | 'listPublicationsForIssue' | 'patchDigest'
>;

export type IssueSweepDeps = {
  generate?: typeof generateIssueText;
  now?: () => Date;
};

export type IssueSweepResult = {
  selected: number;
  generated: number;
  failed: number;
  skipped?: 'cms-rejected-query' | 'cms-unreachable';
};

/** Re-checks the selection rule so a CMS that ignores part of the `where` cannot bypass the attempt cap. */
export function isIssueTextWork(
  digest: Pick<IssueTextWorkDigest, 'issueTextStatus' | 'issueTextAttempts'>,
): boolean {
  if (digest.issueTextStatus === null || digest.issueTextStatus === 'pending') return true;
  return digest.issueTextStatus === 'failed' && digest.issueTextAttempts < ISSUE_TEXT_MAX_ATTEMPTS;
}

export function issueTextSuccessPatch(text: IssueText, now: Date) {
  return {
    issueSummaryPoints: text.issueSummaryPoints,
    issueItemSentences: text.issueItemSentences,
    issueTextStatus: 'ready',
    issueTextSource: 'generated',
    issueTextGeneratedAt: now.toISOString(),
    issueTextError: null,
  } as const;
}

export function issueTextFailurePatch(previousAttempts: number, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    issueTextStatus: 'failed',
    issueTextAttempts: previousAttempts + 1,
    issueTextError: message.slice(0, ISSUE_TEXT_ERROR_MAX_CHARS),
  } as const;
}

/**
 * End-of-job sweep (contract worker-issue-text.md §2): generates English issue text for new,
 * pre-feature and retryable failed digests, hidden ones included. Never throws; each digest
 * is isolated so one failure does not stop the rest.
 */
export async function sweepIssueText(
  cms: IssueSweepCms,
  deps: IssueSweepDeps = {},
): Promise<IssueSweepResult> {
  const generate = deps.generate ?? generateIssueText;
  const now = deps.now ?? (() => new Date());

  let work: IssueTextWorkDigest[];
  try {
    work = (await cms.listIssueTextWork()).filter(isIssueTextWork);
  } catch (err) {
    // 400 ("path cannot be queried") means the web app has not got the issue fields yet
    // (deploy window, R15): expected, so no ERROR/alert. 401/403 (bad key) stay ERROR.
    if (err instanceof CmsHttpError && err.status === 400) {
      logWarning('sweep skipped: cms rejected query', { status: err.status });
      return { selected: 0, generated: 0, failed: 0, skipped: 'cms-rejected-query' };
    }
    logError('sweep list failed', err);
    return { selected: 0, generated: 0, failed: 0, skipped: 'cms-unreachable' };
  }

  const failedRetryable = work.filter((d) => d.issueTextStatus === 'failed').length;
  logInfo('sweep start', { pending: work.length - failedRetryable, failedRetryable });

  const projects = new Map<string, IssueProjectDoc>();
  const result: IssueSweepResult = { selected: work.length, generated: 0, failed: 0 };

  for (const digest of work) {
    const attempt = digest.issueTextAttempts + 1;
    let projectSlug: string | undefined;
    try {
      const projectKey = String(digest.project);
      let project = projects.get(projectKey);
      if (!project) {
        project = await cms.getProject(digest.project);
        projects.set(projectKey, project);
      }
      projectSlug = project.slug;

      const items = await cms.listPublicationsForIssue(digest.publications);
      const text = await generate(project, items, {
        onRetry: (step, reason) =>
          logInfo('validation retry', { digestId: digest.id, step, reason }),
      });

      await cms.patchDigest(digest.id, issueTextSuccessPatch(text, now()));
      result.generated += 1;
      logInfo('issue text generated', {
        digestId: digest.id,
        projectSlug,
        points: text.issueSummaryPoints.length,
        items: text.issueItemSentences.length,
      });
    } catch (err) {
      result.failed += 1;
      logError('issue text generation failed', err, { digestId: digest.id, projectSlug, attempt });
      try {
        await cms.patchDigest(digest.id, issueTextFailurePatch(digest.issueTextAttempts, err));
      } catch (patchErr) {
        logError('issue text failure not recorded', patchErr, { digestId: digest.id, projectSlug });
      }
    }
  }

  logInfo('sweep complete', { ...result });
  return result;
}
