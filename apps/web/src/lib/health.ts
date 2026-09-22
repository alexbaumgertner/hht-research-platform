import { isProjectStale, type MonitoringStatus, type Schedule } from '@hht/shared';

export type ProjectHealthInput = {
  slug: string;
  schedule: Schedule;
  monitoringStatus: MonitoringStatus;
  lastSuccessfulRunAt: string | null;
  latestDigestPublishedAt: string | null;
};

export type HealthReport = {
  ok: boolean;
  checkedAt: string;
  projects: Array<ProjectHealthInput & { stale: boolean }>;
};

/** `ok` is false when any active project has missed its schedule (see isProjectStale). */
export function buildHealthReport(
  projects: ProjectHealthInput[],
  now: Date = new Date(),
): HealthReport {
  const rows = projects.map((project) => ({
    ...project,
    stale: isProjectStale({ ...project, now }),
  }));
  return {
    ok: rows.every((row) => !row.stale),
    checkedAt: now.toISOString(),
    projects: rows,
  };
}
