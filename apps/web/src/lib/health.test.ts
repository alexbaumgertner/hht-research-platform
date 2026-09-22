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
