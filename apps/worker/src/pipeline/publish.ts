export type PublishDecisionInput = {
  qualifyingCount: number;
};

/** Empty qualifying set → do not publish a digest (FR-010). */
export function shouldPublishDigest(input: PublishDecisionInput): boolean {
  return input.qualifyingCount > 0;
}

export function clampBatch<T>(items: T[], limit: number): T[] {
  return items.slice(0, Math.max(0, limit));
}

export type SourceOutcome = 'success' | 'failure';

export function resolveRunStatus(outcomes: SourceOutcome[]): {
  status: 'completed' | 'completed_partial_failure' | 'failed';
  advanceWatermark: boolean;
} {
  if (outcomes.length === 0) {
    return { status: 'failed', advanceWatermark: false };
  }
  const failures = outcomes.filter((o) => o === 'failure').length;
  const successes = outcomes.filter((o) => o === 'success').length;
  if (successes === 0) {
    return { status: 'failed', advanceWatermark: false };
  }
  if (failures > 0) {
    return { status: 'completed_partial_failure', advanceWatermark: true };
  }
  return { status: 'completed', advanceWatermark: true };
}
