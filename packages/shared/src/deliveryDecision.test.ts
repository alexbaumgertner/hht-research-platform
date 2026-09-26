import {
  applyDeliveryFailure,
  claimSends,
  decideLanguageSend,
  maySendStatus,
  nextQuotaAttemptAt,
  statusAfterHide,
} from './deliveryDecision';

const publishedAt = new Date('2026-09-26T12:00:00.000Z');

describe('delivery decisions', () => {
  it('lets one claim send and the loser does not', () => {
    expect(claimSends(true)).toBe(true);
    expect(claimSends(false)).toBe(false);
  });

  it('does not send a row that is already sent', () => {
    expect(maySendStatus('sent')).toBe(false);
    expect(maySendStatus('pending')).toBe(true);
  });

  it('moves a pending row to skipped when the issue is hidden', () => {
    expect(statusAfterHide('pending')).toBe('skipped');
    expect(statusAfterHide('sent')).toBe('sent');
  });

  it('waits on Russian inside 6 hours of publishedAt', () => {
    const now = new Date(publishedAt.getTime() + 5 * 60 * 60 * 1000);
    expect(decideLanguageSend({ language: 'ru', russianReady: false, publishedAt, now })).toEqual({
      action: 'wait',
    });
  });

  it('sends English immediately even when Russian is not ready', () => {
    const now = new Date(publishedAt.getTime() + 60 * 60 * 1000);
    expect(decideLanguageSend({ language: 'en', russianReady: false, publishedAt, now })).toEqual({
      action: 'send',
      bodyLanguage: 'en',
      russianFallback: false,
    });
  });

  it('sends Russian after 6 hours as the English body plus the Russian note', () => {
    const now = new Date(publishedAt.getTime() + 6 * 60 * 60 * 1000);
    expect(decideLanguageSend({ language: 'ru', russianReady: false, publishedAt, now })).toEqual({
      action: 'send',
      bodyLanguage: 'en',
      russianFallback: true,
    });
  });

  it('does not increase attempts on a 429 quota', () => {
    const now = new Date('2026-09-26T15:00:00.000Z');
    const result = applyDeliveryFailure(1, 'quota', now);
    expect(result.attempts).toBe(1);
    expect(result.status).toBe('pending');
    expect(result.nextAttemptAt).toEqual(nextQuotaAttemptAt(now));
    expect(result.nextAttemptAt?.toISOString()).toBe('2026-09-27T00:10:00.000Z');
  });

  it('marks failed the attempt that sets attempts to 4', () => {
    const now = new Date('2026-09-26T15:00:00.000Z');
    let attempts = 0;
    let status: 'pending' | 'failed' = 'pending';
    for (let i = 0; i < 3; i += 1) {
      const step = applyDeliveryFailure(attempts, 'transient', now);
      attempts = step.attempts;
      status = step.status;
      expect(status).toBe('pending');
    }
    const last = applyDeliveryFailure(attempts, 'transient', now);
    expect(last).toEqual({ status: 'failed', attempts: 4, nextAttemptAt: null });
  });
});
