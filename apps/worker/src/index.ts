import { CmsClient } from './cms/client.js';
import { runProject } from './pipeline/runProject.js';

async function main(): Promise<void> {
  console.log('[worker] starting monitoring job');

  if (!process.env.PUBLIC_SITE_URL || !process.env.PAYLOAD_API_KEY) {
    // Allow Docker health / smoke without full env during Phase 2 stub evolution
    if (process.env.WORKER_STUB_EXIT === '1') {
      console.log('[worker] stub exit');
      return;
    }
    throw new Error('PUBLIC_SITE_URL and PAYLOAD_API_KEY are required');
  }

  const cms = new CmsClient();
  const projects = await cms.listDueProjects();
  console.log(`[worker] due projects: ${projects.length}`);

  for (const project of projects) {
    try {
      console.log(`[worker] running project ${project.id} (${project.name})`);
      await runProject(cms, project, 'schedule');
    } catch (err) {
      console.error(`[worker] project ${project.id} failed`, err);
    }
  }

  console.log('[worker] complete');
}

main().catch((err: unknown) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
