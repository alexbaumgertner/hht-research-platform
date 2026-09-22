import {
  clampBatch,
  isStaleRun,
  sourceSince,
  formatDigestStepError,
  resolveRunStatus,
  shouldPublishDigest,
  statusAfterDigestStepFailure,
} from './publish.js';

describe('shouldPublishDigest', () => {
  it('publishes only when qualifying items exist', () => {
    expect(shouldPublishDigest({ qualifyingCount: 0 })).toBe(false);
    expect(shouldPublishDigest({ qualifyingCount: 2 })).toBe(true);
  });
});

describe('clampBatch', () => {
  it('limits to batch size', () => {
    expect(clampBatch([1, 2, 3, 4], 2)).toEqual([1, 2]);
  });
});

describe('resolveRunStatus', () => {
  it('marks completed when all succeed', () => {
    expect(resolveRunStatus(['success', 'success'])).toEqual({
      status: 'completed',
      advanceWatermark: true,
    });
  });

  it('marks partial failure and advances watermark', () => {
    expect(resolveRunStatus(['success', 'failure'])).toEqual({
      status: 'completed_partial_failure',
      advanceWatermark: true,
    });
  });

  it('fails without advancing when no success', () => {
    expect(resolveRunStatus(['failure'])).toEqual({
      status: 'failed',
      advanceWatermark: false,
    });
  });
});

describe('statusAfterDigestStepFailure', () => {
  it('maps completed source runs to completed_partial_failure', () => {
    expect(statusAfterDigestStepFailure('completed')).toBe('completed_partial_failure');
    expect(statusAfterDigestStepFailure('completed_partial_failure')).toBe(
      'completed_partial_failure',
    );
  });

  it('keeps failed when no sources succeeded', () => {
    expect(statusAfterDigestStepFailure('failed')).toBe('failed');
  });
});

describe('formatDigestStepError', () => {
  it('prefixes Error messages', () => {
    expect(formatDigestStepError(new Error('CMS POST /api/digests failed: 504'))).toBe(
      'Digest publish step failed: CMS POST /api/digests failed: 504',
    );
  });
});

describe('sourceSince', () => {
  it('prefers the source watermark so a failed source re-fetches its own window', () => {
    expect(
      sourceSince(
        { lastSuccessfulFetchAt: '2026-08-31T17:00:00.000Z' },
        { lastSuccessfulRunAt: '2026-09-22T20:00:00.000Z' },
      )?.toISOString(),
    ).toBe('2026-08-31T17:00:00.000Z');
  });

  it('falls back to the project watermark for sources that never succeeded on their own', () => {
    expect(
      sourceSince(
        { lastSuccessfulFetchAt: null },
        { lastSuccessfulRunAt: '2026-09-22T20:00:00.000Z' },
      )?.toISOString(),
    ).toBe('2026-09-22T20:00:00.000Z');
  });

  it('returns null on the very first run (bootstrap lookback applies)', () => {
    expect(sourceSince({}, { lastSuccessfulRunAt: null })).toBeNull();
  });
});

describe('isStaleRun', () => {
  const now = new Date('2026-09-23T12:00:00.000Z');

  it('flags running runs older than the max age', () => {
    expect(isStaleRun({ status: 'running', startedAt: '2026-09-23T09:00:00.000Z' }, now)).toBe(
      true,
    );
  });

  it('leaves recent or finished runs alone', () => {
    expect(isStaleRun({ status: 'running', startedAt: '2026-09-23T11:30:00.000Z' }, now)).toBe(
      false,
    );
    expect(isStaleRun({ status: 'completed', startedAt: '2026-09-01T00:00:00.000Z' }, now)).toBe(
      false,
    );
  });
});
