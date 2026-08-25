import { isProjectDue, shouldSkipPaused } from './schedule';

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
