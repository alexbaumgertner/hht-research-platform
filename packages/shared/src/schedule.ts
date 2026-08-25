import type { MonitoringStatus, Schedule } from './index.js';

const MS_DAY = 24 * 60 * 60 * 1000;

const INTERVAL_MS: Record<Schedule, number> = {
  daily: MS_DAY,
  weekly: 7 * MS_DAY,
  monthly: 28 * MS_DAY,
};

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

  return now.getTime() - last.getTime() >= INTERVAL_MS[input.schedule];
}

export function shouldSkipPaused(monitoringStatus: MonitoringStatus): boolean {
  return monitoringStatus === 'paused';
}
