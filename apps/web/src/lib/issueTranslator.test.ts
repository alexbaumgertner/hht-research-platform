import { getIssueTranslator, isStubTranslatorEnabled } from '@/lib/issueTranslator';

describe('getIssueTranslator', () => {
  it('uses the stub only when asked and not on a production deployment', () => {
    expect(isStubTranslatorEnabled({ ISSUE_TRANSLATOR: 'stub' })).toBe(true);
    expect(isStubTranslatorEnabled({ ISSUE_TRANSLATOR: 'stub', VERCEL_ENV: 'preview' })).toBe(true);
    expect(isStubTranslatorEnabled({ ISSUE_TRANSLATOR: 'stub', VERCEL_ENV: 'production' })).toBe(
      false,
    );
    expect(isStubTranslatorEnabled({})).toBe(false);
  });

  it('falls back to the gateway in production even when the stub is requested', () => {
    const translator = getIssueTranslator({
      ISSUE_TRANSLATOR: 'stub',
      VERCEL_ENV: 'production',
      AI_GATEWAY_API_KEY: 'key',
    });
    expect(translator?.kind).toBe('gateway');
  });

  it('returns null without a gateway key', () => {
    expect(getIssueTranslator({})).toBeNull();
  });

  it('stub returns deterministic locale-prefixed text', async () => {
    const translator = getIssueTranslator({ ISSUE_TRANSLATOR: 'stub' });
    const result = await translator!.translate({
      digestId: 'stub-test',
      locale: 'ru',
      text: {
        summaryPoints: ['First.'],
        itemSentences: [{ publicationId: '10', sentence: 'A study.' }],
      },
    });
    expect(result).toEqual({
      summaryPoints: ['[ru] First.'],
      itemSentences: [{ publicationId: '10', sentence: '[ru] A study.' }],
    });
  });
});
