import { generateObject } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import type { Importance, Summary } from '@hht/shared';

const ClassificationSchema = z.object({
  relevant: z.boolean(),
  rationale: z.string(),
});

const SummaryImportanceSchema = z.object({
  importance: z.enum(['critical', 'high', 'medium', 'low']),
  summary: z.object({
    objective: z.string(),
    methods: z.string(),
    results: z.string(),
    limitations: z.string(),
    whyItMatters: z.string(),
  }),
});

function getModel() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error('AI_GATEWAY_API_KEY not configured');
  const gateway = createGateway({ apiKey });
  const modelId = process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini';
  return gateway(modelId);
}

export async function classifyRelevance(input: {
  title: string;
  abstractOrBody?: string;
  keywords: string[];
}): Promise<boolean> {
  const { object } = await generateObject({
    model: getModel(),
    schema: ClassificationSchema,
    prompt: `Decide if this research item is relevant to a project with keywords: ${input.keywords.join(', ')}.
Title: ${input.title}
Abstract: ${input.abstractOrBody || '(none)'}
Return relevant=true only if it clearly relates to the topic.`,
  });
  return object.relevant;
}

export async function summarizeAndRank(input: {
  title: string;
  abstractOrBody?: string;
  keywords: string[];
}): Promise<{ importance: Importance; summary: Summary }> {
  const { object } = await generateObject({
    model: getModel(),
    schema: SummaryImportanceSchema,
    prompt: `Summarize this research item in English for a specialist audience monitoring: ${input.keywords.join(', ')}.
Title: ${input.title}
Abstract: ${input.abstractOrBody || '(none)'}
Fill objective, methods, results, limitations, whyItMatters.
Assign importance: critical|high|medium|low based on clinical/scientific impact for the topic.`,
  });
  return object;
}
