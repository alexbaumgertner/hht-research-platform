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
  /**
   * Position of this candidate in the source's own query key (PubMed EDAT day, ClinicalTrials.gov
   * last-update day, RSS item timestamp). Never the display date. Absent for undated items.
   */
  cursorKey?: string;
};

/** Stable per-source identifier of a candidate (used for boundary-day progress tracking). */
export function candidateId(c: Pick<Candidate, 'externalIds'>): string | undefined {
  return c.externalIds.pmid ?? c.externalIds.nctId ?? c.externalIds.guid;
}

export type FetchCandidatesInput = {
  keywords: string[];
  since: Date | null;
  bootstrapLookbackDays: number;
  /** How many not-yet-processed candidates the caller wants (callers pass batchSize + 1). */
  limit: number;
  /** Ids already processed on the boundary day; adapters drop them before applying `limit`. */
  excludeIds?: string[];
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

/** Oldest cursor key first, undated last. Adapters must not rely on the source's own ordering. */
export function orderByCursor(items: Candidate[]): Candidate[] {
  const keyed = items.filter((c) => c.cursorKey);
  keyed.sort((a, b) => (a.cursorKey! < b.cursorKey! ? -1 : a.cursorKey! > b.cursorKey! ? 1 : 0));
  return [...keyed, ...items.filter((c) => !c.cursorKey)];
}
