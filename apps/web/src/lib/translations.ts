import type { ContentTranslationLocale, Summary } from '@hht/shared';
import { generateObject } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { z } from 'zod';

const SummaryZod = z.object({
  objective: z.string(),
  methods: z.string(),
  results: z.string(),
  limitations: z.string(),
  whyItMatters: z.string(),
});

export type TranslationLookup = {
  hit: boolean;
  fields: Summary | null;
};

export function cacheKey(publicationId: string, locale: ContentTranslationLocale): string {
  return `${publicationId}:${locale}`;
}

/** Pure helper for Jest: whether a cached translation should be reused. */
export function shouldUseCachedTranslation(cached: Summary | null | undefined): boolean {
  return Boolean(
    cached?.objective &&
    cached.methods &&
    cached.results &&
    cached.limitations &&
    cached.whyItMatters,
  );
}

export async function translateSummary(
  summary: Summary,
  locale: ContentTranslationLocale,
): Promise<Summary> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY not configured');
  }

  const gateway = createGateway({ apiKey });
  const modelId = process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini';

  const { object } = await generateObject({
    model: gateway(modelId),
    schema: SummaryZod,
    prompt: `Translate the following research summary sections from English to locale "${locale}". Preserve scientific meaning. Return the same five fields.\n\n${JSON.stringify(summary, null, 2)}`,
  });

  return object;
}
