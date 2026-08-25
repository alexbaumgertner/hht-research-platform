import type { Candidate, FetchCandidatesInput, SourceAdapter } from './types.js';
import { formatYmd, resolveSinceDate } from './types.js';

function buildQuery(keywords: string[]): string {
  return keywords.join(' OR ');
}

type Study = {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    descriptionModule?: {
      briefSummary?: string;
    };
  };
};

export const clinicalTrialsAdapter: SourceAdapter = {
  async fetchCandidates(input: FetchCandidatesInput): Promise<Candidate[]> {
    const since = resolveSinceDate(input.since, input.bootstrapLookbackDays);
    const sinceYmd = formatYmd(since);
    const params = new URLSearchParams({
      'query.term': buildQuery(input.keywords),
      'filter.advanced': `AREA[LastUpdatePostDate]RANGE[${sinceYmd},MAX]`,
      pageSize: String(input.limit),
      format: 'json',
    });

    const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`ClinicalTrials.gov failed: ${res.status}`);
    }
    const json = (await res.json()) as { studies?: Study[] };
    const studies = json.studies ?? [];

    return studies.slice(0, input.limit).flatMap((study) => {
      const id = study.protocolSection?.identificationModule?.nctId;
      const title =
        study.protocolSection?.identificationModule?.briefTitle ||
        study.protocolSection?.identificationModule?.officialTitle ||
        'Untitled';
      if (!id) return [];
      return [
        {
          externalIds: { nctId: id },
          title,
          abstractOrBody: study.protocolSection?.descriptionModule?.briefSummary,
          originalUrl: `https://clinicaltrials.gov/study/${id}`,
          sourceType: 'clinicaltrials' as const,
        },
      ];
    });
  },
};
