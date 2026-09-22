import type { Summary } from '@hht/shared';

import type { CmsId } from '../cms/client.js';

type PublicationWithSummary = {
  id: CmsId;
  title: string;
  summary?: Partial<Record<keyof Summary, string | null>> | null;
};

export function completeSummary(summary: PublicationWithSummary['summary']): Summary | null {
  if (
    !summary?.objective ||
    !summary.methods ||
    !summary.results ||
    !summary.limitations ||
    !summary.whyItMatters
  ) {
    return null;
  }
  return {
    objective: summary.objective,
    methods: summary.methods,
    results: summary.results,
    limitations: summary.limitations,
    whyItMatters: summary.whyItMatters,
  };
}

/** (publication, locale) pairs that have a complete English summary but no stored translation. */
export function missingTranslations<P extends PublicationWithSummary>(
  publications: P[],
  existing: Array<{ publication: CmsId; locale: string }>,
  locales: readonly string[],
): Array<{ publication: P; locale: string }> {
  const have = new Set(existing.map((t) => `${String(t.publication)}:${t.locale}`));
  return publications
    .filter((p) => completeSummary(p.summary) !== null)
    .flatMap((publication) =>
      locales
        .filter((locale) => !have.has(`${String(publication.id)}:${locale}`))
        .map((locale) => ({ publication, locale })),
    );
}
