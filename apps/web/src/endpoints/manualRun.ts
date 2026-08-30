import type { Endpoint } from 'payload';

import { isAuthenticated } from '../access';

type ManualRunUser = {
  id?: string | number;
  roles?: string[];
} | null;

type ProjectOwner = string | number | { id?: string | number } | null | undefined;

/**
 * Admin may trigger any project; otherwise the caller must own the project.
 * Pure helper for unit tests.
 */
export function canTriggerManualRun(input: {
  user: ManualRunUser;
  projectOwner: ProjectOwner;
}): boolean {
  if (!input.user) return false;
  if (input.user.roles?.includes('admin')) return true;

  const ownerId =
    input.projectOwner != null && typeof input.projectOwner === 'object'
      ? input.projectOwner.id
      : input.projectOwner;

  if (ownerId == null || input.user.id == null) return false;
  return String(ownerId) === String(input.user.id);
}

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

    let project: { id: string | number; owner?: ProjectOwner };
    try {
      project = await req.payload.findByID({
        collection: 'research-projects',
        id: projectId,
        depth: 0,
      });
    } catch {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    if (
      !canTriggerManualRun({
        user: req.user as ManualRunUser,
        projectOwner: project.owner,
      })
    ) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const run = await req.payload.create({
      collection: 'monitoring-runs',
      data: {
        project: project.id as number,
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
