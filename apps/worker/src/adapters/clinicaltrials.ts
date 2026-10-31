import type { Candidate, FetchCandidatesInput, SourceAdapter, TrialMetadata } from './types.js';
import { formatYmd, resolveSinceDate } from './types.js';
import { safeFetch } from '../net/safeFetch.js';

function buildQuery(keywords: string[]): string {
  return keywords.join(' OR ');
}

type DateStruct = { date?: string };

export type Study = {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    descriptionModule?: {
      briefSummary?: string;
    };
    statusModule?: {
      overallStatus?: string;
      studyFirstPostDateStruct?: DateStruct;
      lastUpdatePostDateStruct?: DateStruct;
    };
    designModule?: {
      phases?: string[];
    };
    eligibilityModule?: {
      minimumAge?: string;
      maximumAge?: string;
      sex?: string;
    };
    contactsLocationsModule?: {
      locations?: Array<{
        city?: string;
        country?: string;
        facility?: string;
      }>;
    };
  };
};

const MAX_TRIAL_COUNTRIES = 10;

export function extractTrialMetadata(study: Study): TrialMetadata | undefined {
  const section = study.protocolSection;
  if (!section) return undefined;

  const overallStatus = section.statusModule?.overallStatus?.trim() || undefined;
  const phases = (section.designModule?.phases ?? [])
    .map((p) => p.trim())
    .filter((p) => Boolean(p) && p !== 'NA');
  const countries = [
    ...new Set(
      (section.contactsLocationsModule?.locations ?? [])
        .map((loc) => loc.country?.trim())
        .filter((c): c is string => Boolean(c)),
    ),
  ].slice(0, MAX_TRIAL_COUNTRIES);
  const minimumAge = section.eligibilityModule?.minimumAge?.trim() || undefined;
  const maximumAge = section.eligibilityModule?.maximumAge?.trim() || undefined;
  const sex = section.eligibilityModule?.sex?.trim() || undefined;

  const meta: TrialMetadata = {
    ...(overallStatus ? { overallStatus } : {}),
    ...(phases.length > 0 ? { phases } : {}),
    ...(countries.length > 0 ? { countries } : {}),
    ...(minimumAge ? { minimumAge } : {}),
    ...(maximumAge ? { maximumAge } : {}),
    ...(sex ? { sex } : {}),
  };

  return Object.keys(meta).length > 0 ? meta : undefined;
}

/** Registry dates are "YYYY-MM-DD" or "YYYY-MM". */
function parseRegistryDate(value: string | undefined): Date | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return undefined;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1)));
}

export function studyToCandidate(study: Study): Candidate | null {
  const section = study.protocolSection;
  const id = section?.identificationModule?.nctId;
  if (!id) return null;
  const status = section?.statusModule;
  const trialMetadata = extractTrialMetadata(study);
  return {
    externalIds: { nctId: id },
    title:
      section?.identificationModule?.briefTitle ||
      section?.identificationModule?.officialTitle ||
      'Untitled',
    abstractOrBody: section?.descriptionModule?.briefSummary,
    originalUrl: `https://clinicaltrials.gov/study/${id}`,
    publishedOrUpdatedAt:
      parseRegistryDate(status?.lastUpdatePostDateStruct?.date) ??
      parseRegistryDate(status?.studyFirstPostDateStruct?.date),
    ...(trialMetadata ? { trialMetadata } : {}),
    sourceType: 'clinicaltrials',
  };
}

export async function fetchStudy(nctId: string): Promise<Study> {
  const res = await safeFetch(`https://clinicaltrials.gov/api/v2/studies/${nctId}?format=json`);
  if (!res.ok) {
    throw new Error(`ClinicalTrials.gov study ${nctId} failed: ${res.status}`);
  }
  return (await res.json()) as Study;
}

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

    const res = await safeFetch(`https://clinicaltrials.gov/api/v2/studies?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`ClinicalTrials.gov failed: ${res.status}`);
    }
    const json = (await res.json()) as { studies?: Study[] };
    const studies = json.studies ?? [];

    return studies
      .slice(0, input.limit)
      .map(studyToCandidate)
      .filter((c): c is Candidate => c !== null);
  },
};
