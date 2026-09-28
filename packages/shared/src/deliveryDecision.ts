export const RUSSIAN_WAIT_MS = 6 * 60 * 60 * 1000;
export const DELIVERY_RETRY_GAP_MS = 2 * 60 * 60 * 1000;
export const DELIVERY_ATTEMPTS_FAILED = 4;

export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/** The insert that creates the row is the only sender. A loser does not send. */
export function claimSends(inserted: boolean): boolean {
  return inserted;
}

/** A row that already left `pending` is not sent again. */
export function maySendStatus(status: DeliveryStatus): boolean {
  return status === 'pending';
}

/** Hiding an issue skips deliveries that have not gone out. Sent mail stays sent. */
export function statusAfterHide(status: DeliveryStatus): DeliveryStatus {
  return status === 'pending' ? 'skipped' : status;
}

export type LanguageSend =
  { action: 'send'; bodyLanguage: 'en' | 'ru'; russianFallback: boolean } | { action: 'wait' };

/**
 * English never waits. Russian waits until the translation is ready or 6 hours
 * after `publishedAt`, then the English body plus the fixed Russian note.
 */
export function decideLanguageSend(input: {
  language: 'en' | 'ru';
  russianReady: boolean;
  publishedAt: Date;
  now: Date;
}): LanguageSend {
  if (input.language === 'en') {
    return { action: 'send', bodyLanguage: 'en', russianFallback: false };
  }
  if (input.russianReady) {
    return { action: 'send', bodyLanguage: 'ru', russianFallback: false };
  }
  if (input.now.getTime() < input.publishedAt.getTime() + RUSSIAN_WAIT_MS) {
    return { action: 'wait' };
  }
  return { action: 'send', bodyLanguage: 'en', russianFallback: true };
}

/** The next 00:10 UTC strictly after `now`. */
export function nextQuotaAttemptAt(now: Date): Date {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 10, 0, 0),
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export type DeliveryFailureKind = 'quota' | 'transient';

export type DeliveryFailureResult = {
  status: 'pending' | 'failed';
  attempts: number;
  nextAttemptAt: Date | null;
};

/**
 * A quota 429 does not increase `attempts`. Any other retryable failure does.
 * The failure that sets `attempts` to 4 becomes `failed` and is not scheduled again.
 */
export function applyDeliveryFailure(
  attempts: number,
  kind: DeliveryFailureKind,
  now: Date,
): DeliveryFailureResult {
  if (kind === 'quota') {
    return { status: 'pending', attempts, nextAttemptAt: nextQuotaAttemptAt(now) };
  }
  const nextAttempts = attempts + 1;
  if (nextAttempts >= DELIVERY_ATTEMPTS_FAILED) {
    return { status: 'failed', attempts: DELIVERY_ATTEMPTS_FAILED, nextAttemptAt: null };
  }
  return {
    status: 'pending',
    attempts: nextAttempts,
    nextAttemptAt: new Date(now.getTime() + DELIVERY_RETRY_GAP_MS),
  };
}
