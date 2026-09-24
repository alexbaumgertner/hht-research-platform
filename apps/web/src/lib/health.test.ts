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

  describe('with a weekly Monday 04:00 UTC anchor', () => {
    const anchored = {
      slug: 'hht',
      schedule: 'weekly' as const,
      monitoringStatus: 'active' as const,
      lastSuccessfulRunAt: '2026-09-14T04:02:00.000Z',
      latestDigestPublishedAt: '2026-09-14T04:05:00.000Z',
      anchor: { publishWeekday: 'monday' as const, publishHourUtc: 4 },
    };

    it('is not stale before the slot grace ends', () => {
      const report = buildHealthReport([anchored], new Date('2026-09-21T09:59:00.000Z'));
      expect(report.ok).toBe(true);
    });

    it('is stale once the grace ends with no run since the slot', () => {
      const report = buildHealthReport([anchored], new Date('2026-09-21T10:01:00.000Z'));
      expect(report.ok).toBe(false);
      expect(report.projects[0]?.stale).toBe(true);
    });

    it('does not echo the anchor in the report rows', () => {
      const report = buildHealthReport([anchored], now);
      expect(Object.keys(report.projects[0] ?? {}).sort()).toEqual([
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
