export type ExternalIds = {
  pmid?: string;
  doi?: string;
  nctId?: string;
  guid?: string;
};

export type TrialMetadata = {
  overallStatus?: string;
  phases?: string[];
  countries?: string[];
  minimumAge?: string;
  maximumAge?: string;
  sex?: string;
};

export type Candidate = {
  externalIds: ExternalIds;
  title: string;
  abstractOrBody?: string;
  originalUrl: string;
  publishedOrUpdatedAt?: Date;
  /** PubMed PublicationType values (e.g. "Randomized Controlled Trial"); feeds importance rubric. */
  publicationTypes?: string[];
  /** ClinicalTrials.gov protocol metadata for patient-facing display. */
  trialMetadata?: TrialMetadata;
  sourceType: 'pubmed' | 'clinicaltrials' | 'rss';
};

export type FetchCandidatesInput = {
  keywords: string[];
  since: Date | null;
  bootstrapLookbackDays: number;
  limit: number;
  rssUrl?: string;
};

export interface SourceAdapter {
  fetchCandidates(input: FetchCandidatesInput): Promise<Candidate[]>;
}

export function resolveSinceDate(
  since: Date | null,
  bootstrapLookbackDays: number,
  now = new Date(),
): Date {
  if (since) return since;
  return new Date(now.getTime() - bootstrapLookbackDays * 24 * 60 * 60 * 1000);
}

export function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}
