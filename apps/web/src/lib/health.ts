import {
  isProjectStale,
  type MonitoringStatus,
  type Schedule,
  type ScheduleAnchor,
} from '@hht/shared';

export type ProjectHealthRow = {
  slug: string;
  schedule: Schedule;
  monitoringStatus: MonitoringStatus;
  lastSuccessfulRunAt: string | null;
  latestDigestPublishedAt: string | null;
};

/** The anchor feeds the staleness check only; it is not echoed in the report. */
export type ProjectHealthInput = ProjectHealthRow & {
  anchor?: ScheduleAnchor | null;
};

export type HealthReport = {
  ok: boolean;
  checkedAt: string;
  projects: Array<ProjectHealthRow & { stale: boolean }>;
};

/** `ok` is false when any active project has missed its schedule (see isProjectStale). */
export function buildHealthReport(
  projects: ProjectHealthInput[],
  now: Date = new Date(),
): HealthReport {
  const rows = projects.map(({ anchor, ...project }) => ({
    ...project,
    stale: isProjectStale({ ...project, anchor, now }),
  }));
  return {
    ok: rows.every((row) => !row.stale),
    checkedAt: now.toISOString(),
    projects: rows,
  };
}
