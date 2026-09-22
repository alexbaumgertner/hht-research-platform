import type { MonitoringStatus, Schedule } from './index.js';

const MS_DAY = 24 * 60 * 60 * 1000;

const INTERVAL_MS: Record<Schedule, number> = {
  daily: MS_DAY,
  weekly: 7 * MS_DAY,
  monthly: 28 * MS_DAY,
};

/**
 * Hourly Scheduler ticks jitter by a few minutes. Without slack, a run that
 * started at 20:01 is only 23h59m old at the next day's 20:00 tick, so the
 * cadence drifts one hour per interval. Must stay well under one tick (1h).
 */
export const DUE_TOLERANCE_MS = 30 * 60 * 1000;

/** How late a scheduled run may be before the project counts as stale (health/alerts). */
export const STALE_GRACE_MS = 6 * 60 * 60 * 1000;

export type ScheduleDueInput = {
  monitoringStatus: MonitoringStatus;
  schedule: Schedule;
  lastSuccessfulRunAt: Date | string | null | undefined;
  now?: Date;
};

/** Whether a project should run given pause state and schedule vs last success. */
export function isProjectDue(input: ScheduleDueInput): boolean {
  if (input.monitoringStatus === 'paused') {
    return false;
  }

  const now = input.now ?? new Date();
  if (!input.lastSuccessfulRunAt) {
    return true;
  }

  const last =
    typeof input.lastSuccessfulRunAt === 'string'
      ? new Date(input.lastSuccessfulRunAt)
      : input.lastSuccessfulRunAt;

  if (Number.isNaN(last.getTime())) {
    return true;
  }

  return now.getTime() - last.getTime() >= INTERVAL_MS[input.schedule] - DUE_TOLERANCE_MS;
}

/** Active project whose last successful run is overdue by more than STALE_GRACE_MS. */
export function isProjectStale(input: ScheduleDueInput): boolean {
  if (input.monitoringStatus === 'paused') return false;
  if (!input.lastSuccessfulRunAt) return true;

  const last = new Date(input.lastSuccessfulRunAt);
  if (Number.isNaN(last.getTime())) return true;

  const now = input.now ?? new Date();
  return now.getTime() - last.getTime() > INTERVAL_MS[input.schedule] + STALE_GRACE_MS;
}

export function shouldSkipPaused(monitoringStatus: MonitoringStatus): boolean {
  return monitoringStatus === 'paused';
}
