import { clampBatch, resolveRunStatus, shouldPublishDigest } from './publish.js';

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
