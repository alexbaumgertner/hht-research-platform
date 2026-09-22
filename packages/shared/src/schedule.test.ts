import { isProjectDue, isProjectStale, shouldSkipPaused } from './schedule';

describe('shouldSkipPaused', () => {
  it('skips paused projects', () => {
    expect(shouldSkipPaused('paused')).toBe(true);
    expect(shouldSkipPaused('active')).toBe(false);
  });
});

describe('isProjectDue', () => {
  const now = new Date('2026-08-26T12:00:00.000Z');

  it('is due when never run', () => {
    expect(
      isProjectDue({
        monitoringStatus: 'active',
        schedule: 'daily',
        lastSuccessfulRunAt: null,
        now,
      }),
    ).toBe(true);
  });

  it('is not due when paused', () => {
    expect(
      isProjectDue({
        monitoringStatus: 'paused',
        schedule: 'daily',
        lastSuccessfulRunAt: null,
        now,
      }),
    ).toBe(false);
  });

  it('respects daily interval', () => {
    expect(
      isProjectDue({
        monitoringStatus: 'active',
        schedule: 'daily',
        lastSuccessfulRunAt: '2026-08-26T00:00:00.000Z',
        now,
      }),
    ).toBe(false);

    expect(
      isProjectDue({
        monitoringStatus: 'active',
        schedule: 'daily',
        lastSuccessfulRunAt: '2026-08-25T11:00:00.000Z',
        now,
      }),
    ).toBe(true);
  });

  it('respects weekly and monthly intervals', () => {
    expect(
      isProjectDue({
        monitoringStatus: 'active',
        schedule: 'weekly',
        lastSuccessfulRunAt: '2026-08-20T12:00:00.000Z',
        now,
      }),
    ).toBe(false);

    expect(
      isProjectDue({
        monitoringStatus: 'active',
        schedule: 'monthly',
        lastSuccessfulRunAt: '2026-07-28T12:00:00.000Z',
        now,
      }),
    ).toBe(true);
  });
});

describe('isProjectDue cadence anchoring', () => {
  // Hourly Scheduler ticks land a few seconds/minutes past the hour; a run that
  // started at 20:01 must be due again at the 20:00 tick next day, not 21:00.
  const last = '2026-09-22T20:01:30.000Z';

  it('runs on the same hourly tick next day despite jitter', () => {
    expect(
      isProjectDue({
        monitoringStatus: 'active',
        schedule: 'daily',
        lastSuccessfulRunAt: last,
        now: new Date('2026-09-23T20:00:10.000Z'),
      }),
    ).toBe(true);
  });

  it('does not run an hour early', () => {
    expect(
      isProjectDue({
        monitoringStatus: 'active',
        schedule: 'daily',
        lastSuccessfulRunAt: last,
        now: new Date('2026-09-23T19:02:00.000Z'),
      }),
    ).toBe(false);
  });

  it('keeps weekly issues on the same weekday and hour', () => {
    expect(
      isProjectDue({
        monitoringStatus: 'active',
        schedule: 'weekly',
        lastSuccessfulRunAt: last,
        now: new Date('2026-09-29T20:00:05.000Z'),
      }),
    ).toBe(true);
  });
});

describe('isProjectStale', () => {
  const base = {
    monitoringStatus: 'active' as const,
    schedule: 'daily' as const,
  };

  it('is not stale within interval plus grace', () => {
    expect(
      isProjectStale({
        ...base,
        lastSuccessfulRunAt: '2026-09-22T20:00:00.000Z',
        now: new Date('2026-09-24T01:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('is stale once a scheduled run is overdue by more than the grace period', () => {
    expect(
      isProjectStale({
        ...base,
        lastSuccessfulRunAt: '2026-09-22T20:00:00.000Z',
        now: new Date('2026-09-24T03:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('never flags paused projects', () => {
    expect(
      isProjectStale({
        ...base,
        monitoringStatus: 'paused',
        lastSuccessfulRunAt: '2026-01-01T00:00:00.000Z',
        now: new Date('2026-09-24T03:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('flags an active project that never succeeded', () => {
    expect(isProjectStale({ ...base, lastSuccessfulRunAt: null, now: new Date() })).toBe(true);
  });
});
