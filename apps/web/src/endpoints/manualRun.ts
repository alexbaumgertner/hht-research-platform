import type { Endpoint } from 'payload';

import { isAuthenticated } from '../access';

/**
 * Optional owner-triggered monitoring run.
 * Records a manual run stub; full pipeline is executed by the worker
 * (Cloud Run Job or local `pnpm --filter worker start`).
 */
export const manualRunEndpoint: Endpoint = {
  path: '/manual-run',
  method: 'post',
  handler: async (req) => {
    if (!isAuthenticated({ req })) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json?.()) as { projectId?: string } | null;
    const projectId = body?.projectId;
    if (!projectId) {
      return Response.json({ error: 'projectId required' }, { status: 400 });
    }

    const project = await req.payload.findByID({
      collection: 'research-projects',
      id: projectId,
    });

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const run = await req.payload.create({
      collection: 'monitoring-runs',
      data: {
        project: project.id,
        status: 'running',
        triggeredBy: 'manual',
        startedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });

    return Response.json({
      ok: true,
      runId: run.id,
      message:
        'Manual run recorded as running. Execute the worker with MANUAL_RUN_ID or project filter to complete.',
    });
  },
};
