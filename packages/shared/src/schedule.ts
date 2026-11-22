import type { MonitoringStatus, PublishWeekday, Schedule } from './index.js';

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

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

/** Per-project publish slot. With neither set, the legacy interval cadence applies. */
export type ScheduleAnchor = {
  publishWeekday?: PublishWeekday | null;
  publishHourUtc?: number | null;
};

export type ScheduleDueInput = {
  monitoringStatus: MonitoringStatus;
  schedule: Schedule;
  lastSuccessfulRunAt: Date | string | null | undefined;
  anchor?: ScheduleAnchor | null;
  now?: Date;
};

/** Index matches `Date#getUTCDay()` (Sunday = 0). */
const WEEKDAY_INDEX: Record<PublishWeekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function validHour(hour: number | null | undefined): hour is number {
  return typeof hour === 'number' && Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

/**
 * Most recent anchored slot at or before `now`: weekly with weekday + hour →
 * `{weekday} {hour}:00 UTC`; daily with hour → `{hour}:00 UTC`. `null` means the
 * legacy interval rule applies (monthly, or no anchor).
 */
export function latestScheduledSlot(
  schedule: Schedule,
  anchor: ScheduleAnchor | null | undefined,
  now: Date,
): Date | null {
  const hour = anchor?.publishHourUtc;
  if (!validHour(hour)) return null;

  const todayAtHour = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour);

  if (schedule === 'daily') {
    const slot = todayAtHour <= now.getTime() ? todayAtHour : todayAtHour - MS_DAY;
    return new Date(slot);
  }

  if (schedule === 'weekly') {
    const weekday = anchor?.publishWeekday;
    if (!weekday) return null;
    const daysBack = (now.getUTCDay() - WEEKDAY_INDEX[weekday] + 7) % 7;
    let slot = todayAtHour - daysBack * MS_DAY;
    if (slot > now.getTime()) slot -= 7 * MS_DAY;
    return new Date(slot);
  }

  return null;
}

function parseLastRun(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const last = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(last.getTime()) ? null : last;
}

/** Whether a project should run given pause state and schedule vs last success. */
export function isProjectDue(input: ScheduleDueInput): boolean {
  if (input.monitoringStatus === 'paused') {
    return false;
  }

  const last = parseLastRun(input.lastSuccessfulRunAt);
  if (!last) {
    return true;
  }

  const now = input.now ?? new Date();
  // Look ahead by the tolerance so a tick a few seconds early still catches the slot.
  const slot = latestScheduledSlot(
    input.schedule,
    input.anchor,
    new Date(now.getTime() + DUE_TOLERANCE_MS),
  );
  if (slot) {
    return last.getTime() < slot.getTime() - DUE_TOLERANCE_MS;
  }

  return now.getTime() - last.getTime() >= INTERVAL_MS[input.schedule] - DUE_TOLERANCE_MS;
}

/** Active project whose last successful run is overdue by more than STALE_GRACE_MS. */
export function isProjectStale(input: ScheduleDueInput): boolean {
  if (input.monitoringStatus === 'paused') return false;

  const last = parseLastRun(input.lastSuccessfulRunAt);
  if (!last) return true;

  const now = input.now ?? new Date();
  // Slot at `now`, not `now + T`: in the half hour before a slot, the previous
  // slot's miss must still count as stale.
  const slot = latestScheduledSlot(input.schedule, input.anchor, now);
  if (slot) {
    return (
      now.getTime() > slot.getTime() + STALE_GRACE_MS &&
      last.getTime() < slot.getTime() - DUE_TOLERANCE_MS
    );
  }

  return now.getTime() - last.getTime() > INTERVAL_MS[input.schedule] + STALE_GRACE_MS;
}

export function shouldSkipPaused(monitoringStatus: MonitoringStatus): boolean {
  return monitoringStatus === 'paused';
}

/** Spec 004 (OQ2): every project is checked daily; no successful check for 26 h is unhealthy. */
export const CHECK_STALE_AFTER_MS = 26 * MS_HOUR;

type CheckInput = {
  monitoringStatus: MonitoringStatus;
  lastCheckedAt: Date | string | null | undefined;
  lastSuccessfulRunAt?: Date | string | null;
  now?: Date;
};

/** Newest of the last check and the last successful run (a run is also a check). */
function lastCheck(input: CheckInput): Date | null {
  const times = [parseLastRun(input.lastCheckedAt), parseLastRun(input.lastSuccessfulRunAt)].filter(
    (d): d is Date => d !== null,
  );
  return times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
}

/** Health rule: independent of publish cadence, so a quiet weekly project is not "stale". */
export function isCheckStale(input: CheckInput): boolean {
  if (input.monitoringStatus === 'paused') return false;
  const last = lastCheck(input);
  if (!last) return true;
  return (input.now ?? new Date()).getTime() - last.getTime() > CHECK_STALE_AFTER_MS;
}

/** Whether the daily lightweight source check should run (hourly ticks, so with tolerance). */
export function isCheckDue(input: CheckInput): boolean {
  if (input.monitoringStatus === 'paused') return false;
  const last = lastCheck(input);
  if (!last) return true;
  return (input.now ?? new Date()).getTime() - last.getTime() >= MS_DAY - DUE_TOLERANCE_MS;
}
