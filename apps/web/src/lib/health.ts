import {
  isCheckStale,
  type MonitoringStatus,
  type Schedule,
  type ScheduleAnchor,
} from '@hht/shared';

export type ProjectHealthRow = {
  slug: string;
  schedule: Schedule;
  monitoringStatus: MonitoringStatus;
  lastSuccessfulRunAt: string | null;
  /** Last daily source check; null before the first one (a successful run also counts). */
  lastCheckedAt?: string | null;
  latestDigestPublishedAt: string | null;
};

/** The anchor is accepted for callers' convenience; staleness no longer depends on publish slots. */
export type ProjectHealthInput = ProjectHealthRow & {
  anchor?: ScheduleAnchor | null;
};

export type HealthReport = {
  ok: boolean;
  checkedAt: string;
  projects: Array<ProjectHealthRow & { stale: boolean }>;
};

/**
 * `ok` is false when any active project has had no successful source check for 26 h (see
 * isCheckStale). Checks are daily for every project, independent of the publish cadence.
 */
export function buildHealthReport(
  projects: ProjectHealthInput[],
  now: Date = new Date(),
): HealthReport {
  const rows = projects.map(({ anchor: _anchor, ...project }) => ({
    ...project,
    lastCheckedAt: project.lastCheckedAt ?? null,
    stale: isCheckStale({
      monitoringStatus: project.monitoringStatus,
      lastCheckedAt: project.lastCheckedAt,
      lastSuccessfulRunAt: project.lastSuccessfulRunAt,
      now,
    }),
  }));
  return {
    ok: rows.every((row) => !row.stale),
    checkedAt: now.toISOString(),
    projects: rows,
  };
}
