import { buildHealthReport } from './health';

const now = new Date('2026-09-24T12:00:00.000Z');

describe('buildHealthReport', () => {
  it('is ok when every active project ran within its schedule', () => {
    const report = buildHealthReport(
      [
        {
          slug: 'hht',
          schedule: 'daily',
          monitoringStatus: 'active',
          lastSuccessfulRunAt: '2026-09-23T20:00:00.000Z',
          latestDigestPublishedAt: '2026-09-22T20:06:40.000Z',
        },
      ],
      now,
    );
    expect(report.ok).toBe(true);
    expect(report.projects[0]).toMatchObject({ slug: 'hht', stale: false });
  });

  it('is not ok when an active project is overdue', () => {
    const report = buildHealthReport(
      [
        {
          slug: 'hht',
          schedule: 'daily',
          monitoringStatus: 'active',
          lastSuccessfulRunAt: '2026-09-20T20:00:00.000Z',
          latestDigestPublishedAt: null,
        },
      ],
      now,
    );
    expect(report.ok).toBe(false);
    expect(report.projects[0]?.stale).toBe(true);
  });

  describe('check-based staleness (spec 004, 26 h)', () => {
    const weekly = {
      slug: 'hht',
      schedule: 'weekly' as const,
      monitoringStatus: 'active' as const,
      lastSuccessfulRunAt: '2026-09-21T04:00:40.000Z',
      latestDigestPublishedAt: '2026-09-21T04:05:00.000Z',
      anchor: { publishWeekday: 'monday' as const, publishHourUtc: 4 },
    };

    it('a weekly project checked within 26 h is healthy between its weekly runs', () => {
      const report = buildHealthReport(
        [{ ...weekly, lastCheckedAt: '2026-09-24T04:00:30.000Z' }],
        now,
      );
      expect(report.ok).toBe(true);
      expect(report.projects[0]).toMatchObject({ stale: false });
    });

    it('is unhealthy when the last check is older than 26 h, whatever the publish cadence', () => {
      const report = buildHealthReport(
        [{ ...weekly, lastCheckedAt: '2026-09-23T09:59:00.000Z' }],
        now,
      );
      expect(report.ok).toBe(false);
      expect(report.projects[0]?.stale).toBe(true);
    });
  });

  describe('with a weekly Monday 04:00 UTC anchor', () => {
    const anchored = {
      slug: 'hht',
      schedule: 'weekly' as const,
      monitoringStatus: 'active' as const,
      lastSuccessfulRunAt: '2026-09-14T04:02:00.000Z',
      latestDigestPublishedAt: '2026-09-14T04:05:00.000Z',
      anchor: { publishWeekday: 'monday' as const, publishHourUtc: 4 },
    };

    it('is not stale shortly after a run', () => {
      const report = buildHealthReport([anchored], new Date('2026-09-15T05:00:00.000Z'));
      expect(report.ok).toBe(true);
    });

    it('is stale when neither a check nor a run happened for more than 26 h', () => {
      const report = buildHealthReport([anchored], new Date('2026-09-15T10:01:00.000Z'));
      expect(report.ok).toBe(false);
      expect(report.projects[0]?.stale).toBe(true);
    });

    it('does not echo the anchor in the report rows', () => {
      const report = buildHealthReport([anchored], now);
      expect(Object.keys(report.projects[0] ?? {}).sort()).toEqual([
        'lastCheckedAt',
        'lastSuccessfulRunAt',
        'latestDigestPublishedAt',
        'monitoringStatus',
        'schedule',
        'slug',
        'stale',
      ]);
    });
  });

  it('ignores paused projects', () => {
    const report = buildHealthReport(
      [
        {
          slug: 'old',
          schedule: 'daily',
          monitoringStatus: 'paused',
          lastSuccessfulRunAt: null,
          latestDigestPublishedAt: null,
        },
      ],
      now,
    );
    expect(report.ok).toBe(true);
  });
});
