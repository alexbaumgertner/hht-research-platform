import {
  isProjectDue,
  isProjectStale,
  latestScheduledSlot,
  shouldSkipPaused,
  type ScheduleAnchor,
} from './schedule';

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

// 2026-09-28 and 2026-09-21 are Mondays; 2026-09-24 is a Thursday.
const MONDAY_4: ScheduleAnchor = { publishWeekday: 'monday', publishHourUtc: 4 };
const weekly = { monitoringStatus: 'active' as const, schedule: 'weekly' as const };

describe('latestScheduledSlot', () => {
  it('returns the latest weekly slot at or before now', () => {
    expect(
      latestScheduledSlot('weekly', MONDAY_4, new Date('2026-09-28T04:00:00.000Z'))?.toISOString(),
    ).toBe('2026-09-28T04:00:00.000Z');
    expect(
      latestScheduledSlot('weekly', MONDAY_4, new Date('2026-09-28T03:59:59.000Z'))?.toISOString(),
    ).toBe('2026-09-21T04:00:00.000Z');
    expect(
      latestScheduledSlot('weekly', MONDAY_4, new Date('2026-09-24T12:00:00.000Z'))?.toISOString(),
    ).toBe('2026-09-21T04:00:00.000Z');
    expect(
      latestScheduledSlot(
        'weekly',
        { publishWeekday: 'sunday', publishHourUtc: 23 },
        new Date('2026-09-28T01:00:00.000Z'),
      )?.toISOString(),
    ).toBe('2026-09-27T23:00:00.000Z');
  });

  it('returns the latest daily slot at or before now', () => {
    const anchor = { publishHourUtc: 6 };
    expect(
      latestScheduledSlot('daily', anchor, new Date('2026-09-24T07:00:00.000Z'))?.toISOString(),
    ).toBe('2026-09-24T06:00:00.000Z');
    expect(
      latestScheduledSlot('daily', anchor, new Date('2026-09-24T05:00:00.000Z'))?.toISOString(),
    ).toBe('2026-09-23T06:00:00.000Z');
  });

  it('crosses month and year boundaries in UTC', () => {
    expect(
      latestScheduledSlot(
        'weekly',
        { publishWeekday: 'thursday', publishHourUtc: 20 },
        new Date('2027-01-01T10:00:00.000Z'),
      )?.toISOString(),
    ).toBe('2026-12-31T20:00:00.000Z');
  });

  it('returns null without a usable anchor or for monthly', () => {
    const now = new Date('2026-09-28T05:00:00.000Z');
    expect(latestScheduledSlot('weekly', null, now)).toBeNull();
    expect(latestScheduledSlot('weekly', { publishHourUtc: 4 }, now)).toBeNull();
    expect(latestScheduledSlot('weekly', { publishWeekday: 'monday' }, now)).toBeNull();
    expect(latestScheduledSlot('daily', { publishWeekday: 'monday' }, now)).toBeNull();
    expect(latestScheduledSlot('monthly', MONDAY_4, now)).toBeNull();
    expect(latestScheduledSlot('daily', { publishHourUtc: 24 }, now)).toBeNull();
  });
});

describe('isProjectDue with an anchor (research R5 worked example)', () => {
  const previousMondayRun = '2026-09-21T04:00:40.000Z';

  it.each([
    ['Mon 03:00:10, last run previous Mon', '2026-09-28T03:00:10.000Z', previousMondayRun, false],
    ['Mon 03:59:50 (early tick)', '2026-09-28T03:59:50.000Z', previousMondayRun, true],
    ['Mon 04:00:20', '2026-09-28T04:00:20.000Z', previousMondayRun, true],
    [
      'Mon 05:00:10 after a 04:00:20 success',
      '2026-09-28T05:00:10.000Z',
      '2026-09-28T04:00:20.000Z',
      false,
    ],
    ['Mon 05:00 after a failed 04:00 run', '2026-09-28T05:00:00.000Z', previousMondayRun, true],
  ])('%s → due %s', (_label, now, last, expected) => {
    expect(
      isProjectDue({ ...weekly, anchor: MONDAY_4, lastSuccessfulRunAt: last, now: new Date(now) }),
    ).toBe(expected);
  });

  it('an early-tick success is not due again later that Monday', () => {
    expect(
      isProjectDue({
        ...weekly,
        anchor: MONDAY_4,
        lastSuccessfulRunAt: '2026-09-28T03:59:50.000Z',
        now: new Date('2026-09-28T05:00:05.000Z'),
      }),
    ).toBe(false);
  });

  it('retries hourly after a failed 04:00 run until a success', () => {
    for (const hour of ['05', '06', '07', '12', '23']) {
      expect(
        isProjectDue({
          ...weekly,
          anchor: MONDAY_4,
          lastSuccessfulRunAt: previousMondayRun,
          now: new Date(`2026-09-28T${hour}:00:05.000Z`),
        }),
      ).toBe(true);
    }
    expect(
      isProjectDue({
        ...weekly,
        anchor: MONDAY_4,
        lastSuccessfulRunAt: '2026-09-28T07:00:05.000Z',
        now: new Date('2026-09-28T08:00:05.000Z'),
      }),
    ).toBe(false);
  });

  it('uses the legacy rule for monthly even with an anchor set', () => {
    const input = {
      monitoringStatus: 'active' as const,
      schedule: 'monthly' as const,
      anchor: MONDAY_4,
    };
    expect(
      isProjectDue({
        ...input,
        lastSuccessfulRunAt: '2026-09-21T04:00:40.000Z',
        now: new Date('2026-09-28T04:00:20.000Z'),
      }),
    ).toBe(false);
    expect(
      isProjectDue({
        ...input,
        lastSuccessfulRunAt: '2026-08-31T12:00:00.000Z',
        now: new Date('2026-09-28T12:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('keeps the legacy rule for a weekly project with no anchor', () => {
    const last = '2026-09-24T20:00:00.000Z';
    expect(
      isProjectDue({
        ...weekly,
        lastSuccessfulRunAt: last,
        now: new Date('2026-09-28T04:00:20.000Z'),
      }),
    ).toBe(false);
    expect(
      isProjectDue({
        ...weekly,
        anchor: { publishWeekday: null, publishHourUtc: null },
        lastSuccessfulRunAt: last,
        now: new Date('2026-10-01T20:00:05.000Z'),
      }),
    ).toBe(true);
  });

  it('daily → weekly on a Thursday after a Thursday run waits for the next Monday slot', () => {
    const thursdayRun = '2026-09-24T04:00:30.000Z';
    for (const now of [
      '2026-09-24T12:00:05.000Z',
      '2026-09-25T04:00:05.000Z',
      '2026-09-27T23:00:05.000Z',
      '2026-09-28T03:00:05.000Z',
    ]) {
      expect(
        isProjectDue({
          ...weekly,
          anchor: MONDAY_4,
          lastSuccessfulRunAt: thursdayRun,
          now: new Date(now),
        }),
      ).toBe(false);
    }
    expect(
      isProjectDue({
        ...weekly,
        anchor: MONDAY_4,
        lastSuccessfulRunAt: thursdayRun,
        now: new Date('2026-09-28T04:00:05.000Z'),
      }),
    ).toBe(true);
  });

  it('anchors a daily schedule to its hour', () => {
    const anchor = { publishHourUtc: 6 };
    const daily = { monitoringStatus: 'active' as const, schedule: 'daily' as const, anchor };
    expect(
      isProjectDue({
        ...daily,
        lastSuccessfulRunAt: '2026-09-23T06:00:30.000Z',
        now: new Date('2026-09-24T05:59:50.000Z'),
      }),
    ).toBe(true);
    expect(
      isProjectDue({
        ...daily,
        lastSuccessfulRunAt: '2026-09-24T06:00:30.000Z',
        now: new Date('2026-09-24T20:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('is still due when never run and never due when paused', () => {
    const now = new Date('2026-09-24T12:00:00.000Z');
    expect(isProjectDue({ ...weekly, anchor: MONDAY_4, lastSuccessfulRunAt: null, now })).toBe(
      true,
    );
    expect(
      isProjectDue({
        monitoringStatus: 'paused',
        schedule: 'weekly',
        anchor: MONDAY_4,
        lastSuccessfulRunAt: null,
        now,
      }),
    ).toBe(false);
  });
});

describe('isProjectStale with an anchor', () => {
  const previousMondayRun = '2026-09-21T04:00:40.000Z';

  it('is stale on Monday 10:01 with no success since the 04:00 slot', () => {
    expect(
      isProjectStale({
        ...weekly,
        anchor: MONDAY_4,
        lastSuccessfulRunAt: previousMondayRun,
        now: new Date('2026-09-28T10:01:00.000Z'),
      }),
    ).toBe(true);
  });

  it('is not stale on Monday 09:59', () => {
    expect(
      isProjectStale({
        ...weekly,
        anchor: MONDAY_4,
        lastSuccessfulRunAt: previousMondayRun,
        now: new Date('2026-09-28T09:59:00.000Z'),
      }),
    ).toBe(false);
  });

  it('is not stale after a success at the slot', () => {
    expect(
      isProjectStale({
        ...weekly,
        anchor: MONDAY_4,
        lastSuccessfulRunAt: '2026-09-28T03:59:50.000Z',
        now: new Date('2026-09-28T10:01:00.000Z'),
      }),
    ).toBe(false);
  });

  it('keeps flagging a missed slot in the half hour before the next one', () => {
    expect(
      isProjectStale({
        ...weekly,
        anchor: MONDAY_4,
        lastSuccessfulRunAt: '2026-09-14T04:00:40.000Z',
        now: new Date('2026-09-28T03:45:00.000Z'),
      }),
    ).toBe(true);
  });

  it('uses the legacy rule without an anchor', () => {
    expect(
      isProjectStale({
        ...weekly,
        lastSuccessfulRunAt: '2026-09-24T20:00:00.000Z',
        now: new Date('2026-09-28T10:01:00.000Z'),
      }),
    ).toBe(false);
  });
});
