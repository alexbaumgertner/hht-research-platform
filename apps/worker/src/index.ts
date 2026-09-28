import { CmsClient } from './cms/client.js';
import { logError, logInfo } from './log.js';
import { sweepIssueText } from './pipeline/issueSweep.js';
import { isStaleRun } from './pipeline/publish.js';
import { runProject } from './pipeline/runProject.js';
import { subscriptionCms } from './pipeline/subscriptionCms.js';
import { sweepSubscriptions } from './pipeline/subscriptionSweep.js';

/** Mark runs left `running` by a killed/crashed job as failed so history stays truthful. */
async function reapStaleRuns(cms: CmsClient): Promise<void> {
  try {
    const now = new Date();
    for (const run of await cms.listRunningRuns()) {
      if (!isStaleRun(run, now)) continue;
      await cms.updateRun(run.id, {
        status: 'failed',
        finishedAt: now.toISOString(),
        errorSummary:
          'Run did not finish (worker timeout or crash); marked failed by the next run.',
      });
      logError('reaped stale run', undefined, { runId: run.id, startedAt: run.startedAt });
    }
  } catch (err) {
    logError('stale run reaper failed', err);
  }
}

async function main(): Promise<void> {
  logInfo('starting monitoring job');

  if (!process.env.PUBLIC_SITE_URL || !process.env.PAYLOAD_API_KEY) {
    // Allow Docker health / smoke without full env during Phase 2 stub evolution
    if (process.env.WORKER_STUB_EXIT === '1') {
      logInfo('stub exit');
      return;
    }
    throw new Error('PUBLIC_SITE_URL and PAYLOAD_API_KEY are required');
  }

  const cms = new CmsClient();
  await reapStaleRuns(cms);

  try {
    const projects = await cms.listDueProjects();
    logInfo('due projects', { count: projects.length, slugs: projects.map((p) => p.slug) });

    for (const project of projects) {
      try {
        logInfo('running project', { projectId: project.id, projectSlug: project.slug });
        await runProject(cms, project, 'schedule');
      } catch (err) {
        logError('project failed', err, { projectId: project.id, projectSlug: project.slug });
      }
    }
  } finally {
    // Separate from runs: a sweep failure never touches run status or watermarks.
    await sweepIssueText(cms);
    try {
      await sweepSubscriptions({ cms: subscriptionCms(cms) });
    } catch (err) {
      logError('subscription sweep failed', err);
    }
  }

  logInfo('complete');
}

main().catch((err: unknown) => {
  logError('fatal', err);
  process.exit(1);
});
