import { studyToCandidate } from './clinicaltrials.js';

describe('studyToCandidate', () => {
  it('uses the last update post date as publishedOrUpdatedAt', () => {
    const candidate = studyToCandidate({
      protocolSection: {
        identificationModule: { nctId: 'NCT00000001', briefTitle: 'A trial' },
        descriptionModule: { briefSummary: 'Summary.' },
        statusModule: {
          studyFirstPostDateStruct: { date: '2026-06-25' },
          lastUpdatePostDateStruct: { date: '2026-08-21' },
        },
      },
    });
    expect(candidate?.publishedOrUpdatedAt?.toISOString()).toBe('2026-08-21T00:00:00.000Z');
    expect(candidate?.externalIds).toEqual({ nctId: 'NCT00000001' });
    expect(candidate?.originalUrl).toBe('https://clinicaltrials.gov/study/NCT00000001');
  });

  it('falls back to the first post date, and tolerates missing dates', () => {
    const firstPostOnly = studyToCandidate({
      protocolSection: {
        identificationModule: { nctId: 'NCT00000002', briefTitle: 'B' },
        statusModule: { studyFirstPostDateStruct: { date: '2026-06' } },
      },
    });
    expect(firstPostOnly?.publishedOrUpdatedAt?.toISOString()).toBe('2026-06-01T00:00:00.000Z');

    const undated = studyToCandidate({
      protocolSection: { identificationModule: { nctId: 'NCT00000003', briefTitle: 'C' } },
    });
    expect(undated?.publishedOrUpdatedAt).toBeUndefined();
  });

  it('skips studies without an NCT id', () => {
    expect(studyToCandidate({ protocolSection: {} })).toBeNull();
  });
});
