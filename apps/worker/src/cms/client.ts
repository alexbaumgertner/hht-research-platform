import {
  DEFAULT_BATCH_SIZE_PER_SOURCE,
  DEFAULT_BOOTSTRAP_LOOKBACK_DAYS,
  isProjectDue,
  keywordText,
  type Importance,
  type IssueTextStatus,
  type KeywordInput,
  type PublishWeekday,
  type Schedule,
  type MonitoringStatus,
  type SourceType,
  type Summary,
} from '@hht/shared';

type Json = Record<string, unknown>;

/**
 * Payload document id as returned by REST. Numeric on Postgres; must be sent back
 * unchanged — relationship validation rejects "4" where it expects 4.
 */
export type CmsId = string | number;

export class CmsHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CmsHttpError';
  }
}

export type IssueTextWorkDigest = {
  id: CmsId;
  project: CmsId;
  publications: CmsId[];
  issueTextStatus: IssueTextStatus | null;
  issueTextAttempts: number;
  hiddenFromPublic: boolean;
};

export type IssueProjectDoc = {
  id: CmsId;
  name: string;
  slug: string;
  keywords: string[];
  audienceContext: string | null;
};

export type IssuePublicationDoc = {
  id: CmsId;
  title: string;
  sourceType: SourceType;
  publicationTypes?: string[] | null;
  importance?: Importance | null;
  publishedOrUpdatedAt?: string | null;
  summary?: Partial<Record<keyof Summary, string | null>> | null;
  abstractOrBody?: string | null;
};

const ISSUE_PUBLICATION_FIELDS = [
  'title',
  'sourceType',
  'publicationTypes',
  'importance',
  'publishedOrUpdatedAt',
  'summary',
  'abstractOrBody',
] as const;

export const ISSUE_TEXT_WORK_LIMIT = 20;
export const ISSUE_TEXT_MAX_ATTEMPTS = 3;

/** Contract worker-issue-text.md §2.1: pending, unset (pre-feature), or failed with attempts < 3. */
export function issueTextWorkQuery(): URLSearchParams {
  return new URLSearchParams({
    depth: '0',
    limit: String(ISSUE_TEXT_WORK_LIMIT),
    sort: 'publishedAt',
    'where[or][0][issueTextStatus][equals]': 'pending',
    'where[or][1][issueTextStatus][exists]': 'false',
    'where[or][2][and][0][issueTextStatus][equals]': 'failed',
    'where[or][2][and][1][issueTextAttempts][less_than]': String(ISSUE_TEXT_MAX_ATTEMPTS),
  });
}

function relationId(value: CmsId | { id: CmsId }): CmsId {
  return typeof value === 'object' ? value.id : value;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env ${name}`);
  return value;
}

export class CmsClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl = process.env.PUBLIC_SITE_URL, apiKey = process.env.PAYLOAD_API_KEY) {
    this.baseUrl = (baseUrl || requireEnv('PUBLIC_SITE_URL')).replace(/\/$/, '');
    this.apiKey = apiKey || requireEnv('PAYLOAD_API_KEY');
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Payload-API-Key': this.apiKey,
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new CmsHttpError(
        `CMS ${init?.method || 'GET'} ${path} failed: ${res.status} ${text}`,
        res.status,
      );
    }
    return res.json() as Promise<T>;
  }

  async listDueProjects(): Promise<
    Array<{
      id: CmsId;
      name: string;
      slug: string;
      keywords: string[];
      schedule: Schedule;
      monitoringStatus: MonitoringStatus;
      lastSuccessfulRunAt: string | null;
      bootstrapLookbackDays: number;
      emailNotificationEnabled: boolean;
      ownerEmail?: string;
      sources: Array<{
        id: CmsId;
        type: 'pubmed' | 'clinicaltrials' | 'rss';
        rssUrl?: string | null;
        enabled: boolean;
        lastSuccessfulFetchAt: string | null;
      }>;
    }>
  > {
    const projects = await this.request<{
      docs: Array<{
        id: string | number;
        name: string;
        slug: string;
        keywords?: Array<{ value?: string } | string>;
        schedule: Schedule;
        publishWeekday?: PublishWeekday | null;
        publishHourUtc?: number | null;
        monitoringStatus: MonitoringStatus;
        lastSuccessfulRunAt?: string | null;
        bootstrapLookbackDays?: number;
        emailNotificationEnabled?: boolean;
        owner?: { email?: string } | string | number;
      }>;
    }>(`/api/research-projects?limit=100&depth=1&where[monitoringStatus][equals]=active`);

    const sources = await this.request<{
      docs: Array<{
        id: string | number;
        project: string | number | { id: string | number };
        type: 'pubmed' | 'clinicaltrials' | 'rss';
        rssUrl?: string | null;
        enabled?: boolean;
        lastSuccessfulFetchAt?: string | null;
      }>;
    }>(`/api/monitored-sources?limit=500&depth=0`);

    return projects.docs
      .map((project) => {
        const keywords = (project.keywords || [])
          .map((k) => (typeof k === 'string' ? k : k.value || ''))
          .filter(Boolean);
        const projectSources = sources.docs
          .filter((s) => {
            const pid = typeof s.project === 'object' ? s.project.id : s.project;
            return String(pid) === String(project.id);
          })
          .map((s) => ({
            id: s.id,
            type: s.type,
            rssUrl: s.rssUrl,
            enabled: s.enabled !== false,
            lastSuccessfulFetchAt: s.lastSuccessfulFetchAt ?? null,
          }));

        const due = isProjectDue({
          monitoringStatus: project.monitoringStatus,
          schedule: project.schedule,
          lastSuccessfulRunAt: project.lastSuccessfulRunAt,
          anchor: {
            publishWeekday: project.publishWeekday ?? null,
            publishHourUtc: project.publishHourUtc ?? null,
          },
        });

        if (!due || keywords.length === 0 || !projectSources.some((s) => s.enabled)) {
          return null;
        }

        const ownerEmail =
          typeof project.owner === 'object' && project.owner && 'email' in project.owner
            ? project.owner.email
            : undefined;

        return {
          id: project.id,
          name: project.name,
          slug: project.slug,
          keywords,
          schedule: project.schedule,
          monitoringStatus: project.monitoringStatus,
          lastSuccessfulRunAt: project.lastSuccessfulRunAt ?? null,
          bootstrapLookbackDays: project.bootstrapLookbackDays ?? DEFAULT_BOOTSTRAP_LOOKBACK_DAYS,
          emailNotificationEnabled: Boolean(project.emailNotificationEnabled),
          ownerEmail,
          sources: projectSources,
        };
      })
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }

  async createRun(projectId: CmsId, triggeredBy: 'schedule' | 'manual') {
    return this.request<{ doc: { id: string | number } }>(`/api/monitoring-runs`, {
      method: 'POST',
      body: JSON.stringify({
        project: projectId,
        status: 'running',
        triggeredBy,
        startedAt: new Date().toISOString(),
      }),
    });
  }

  async updateRun(runId: string | number, data: Json) {
    return this.request(`/api/monitoring-runs/${runId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async findPublicationByDedupe(projectId: CmsId, dedupeKey: string) {
    const qs = new URLSearchParams({
      limit: '1',
      depth: '0',
      'where[and][0][project][equals]': String(projectId),
      'where[and][1][dedupeKey][equals]': dedupeKey,
    });
    const result = await this.request<{ docs: Array<{ id: string | number }> }>(
      `/api/publications?${qs.toString()}`,
    );
    return result.docs[0] ?? null;
  }

  async createPublication(data: Json) {
    return this.request<{ doc: { id: string | number } }>(`/api/publications`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createDigest(data: {
    project: CmsId;
    run: CmsId;
    publishedAt: string;
    publications: CmsId[];
    issueTextStatus: 'pending';
  }) {
    // depth=0 skips populating hasMany publications (and nested relations) on the
    // create response — default depth=2 was exceeding Vercel's function timeout.
    return this.request<{ doc: { id: string | number } }>(`/api/digests?depth=0`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listIssueTextWork(): Promise<IssueTextWorkDigest[]> {
    const result = await this.request<{
      docs: Array<{
        id: CmsId;
        project: CmsId | { id: CmsId };
        publications?: Array<CmsId | { id: CmsId }> | null;
        issueTextStatus?: IssueTextStatus | null;
        issueTextAttempts?: number | null;
        hiddenFromPublic?: boolean | null;
      }>;
    }>(`/api/digests?${issueTextWorkQuery().toString()}`);
    return result.docs.map((doc) => ({
      id: doc.id,
      project: relationId(doc.project),
      publications: (doc.publications ?? []).map(relationId),
      issueTextStatus: doc.issueTextStatus ?? null,
      issueTextAttempts: doc.issueTextAttempts ?? 0,
      hiddenFromPublic: Boolean(doc.hiddenFromPublic),
    }));
  }

  async getProject(id: CmsId): Promise<IssueProjectDoc> {
    const doc = await this.request<{
      id: CmsId;
      name: string;
      slug: string;
      keywords?: KeywordInput[] | null;
      audienceContext?: string | null;
    }>(`/api/research-projects/${id}?depth=0`);
    return {
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      keywords: (doc.keywords ?? []).map(keywordText).filter(Boolean),
      audienceContext: doc.audienceContext ?? null,
    };
  }

  async listPublicationsForIssue(ids: CmsId[]): Promise<IssuePublicationDoc[]> {
    if (ids.length === 0) return [];
    const qs = new URLSearchParams({ depth: '0', pagination: 'false' });
    ids.forEach((id, index) => qs.set(`where[id][in][${index}]`, String(id)));
    for (const field of ISSUE_PUBLICATION_FIELDS) qs.set(`select[${field}]`, 'true');
    const result = await this.request<{ docs: IssuePublicationDoc[] }>(
      `/api/publications?${qs.toString()}`,
    );
    return result.docs;
  }

  async patchDigest(id: CmsId, data: Json) {
    return this.request(`/api/digests/${id}?depth=0`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createContentTranslation(data: {
    publication: string | number;
    locale: string;
    title?: string;
    fields: Json;
  }) {
    return this.request<{ doc: { id: string | number } }>(`/api/content-translations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patchProjectWatermark(projectId: CmsId, at: string) {
    return this.request(`/api/research-projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ lastSuccessfulRunAt: at }),
    });
  }

  async patchSourceWatermark(sourceId: CmsId, at: string) {
    return this.request(`/api/monitored-sources/${sourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ lastSuccessfulFetchAt: at }),
    });
  }

  async listRunningRuns() {
    const qs = new URLSearchParams({
      limit: '100',
      depth: '0',
      'where[status][equals]': 'running',
    });
    const result = await this.request<{
      docs: Array<{
        id: CmsId;
        project: CmsId | { id: CmsId };
        status: string;
        startedAt?: string | null;
      }>;
    }>(`/api/monitoring-runs?${qs.toString()}`);
    return result.docs;
  }

  /** Publications visible on the public feed (carried by a published digest). */
  async listFeedPublications(): Promise<
    Array<{
      id: CmsId;
      title: string;
      sourceType: 'pubmed' | 'clinicaltrials' | 'rss';
      externalIds?: { pmid?: string | null; nctId?: string | null } | null;
      summary?: Record<string, string | null> | null;
      publishedOrUpdatedAt?: string | null;
      publicationTypes?: string[] | null;
    }>
  > {
    const qs = new URLSearchParams({
      limit: '1000',
      depth: '0',
      pagination: 'false',
      'where[feedPublishedAt][exists]': 'true',
    });
    const result = await this.request<{
      docs: Awaited<ReturnType<CmsClient['listFeedPublications']>>;
    }>(`/api/publications?${qs.toString()}`);
    return result.docs;
  }

  async updatePublication(id: CmsId, data: Json) {
    return this.request(`/api/publications/${id}?depth=0`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async listTranslations(): Promise<Array<{ publication: CmsId; locale: string }>> {
    const result = await this.request<{
      docs: Array<{ publication: CmsId | { id: CmsId }; locale: string }>;
    }>(`/api/content-translations?limit=5000&depth=0&pagination=false`);
    return result.docs.map((d) => ({
      publication: typeof d.publication === 'object' ? d.publication.id : d.publication,
      locale: d.locale,
    }));
  }

  async listConfirmedSubscribers(projectId: CmsId) {
    const qs = new URLSearchParams({
      depth: '0',
      limit: '200',
      'where[and][0][project][equals]': String(projectId),
      'where[and][1][status][equals]': 'confirmed',
    });
    return this.request<{
      docs: Array<{
        id: CmsId;
        email: string;
        language: 'en' | 'ru';
        status: 'confirmed';
        source?: string;
      }>;
    }>(`/api/subscribers?${qs.toString()}`);
  }

  async listIssueDeliveries(digestId: CmsId) {
    const qs = new URLSearchParams({
      depth: '1',
      limit: '200',
      'where[digest][equals]': String(digestId),
    });
    return this.request<{ docs: Array<Record<string, unknown>> }>(
      `/api/issue-deliveries?${qs.toString()}`,
    );
  }

  async createIssueDelivery(data: Json) {
    return this.request<{ doc: { id: CmsId } }>(`/api/issue-deliveries?depth=0`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patchIssueDelivery(id: CmsId, data: Json) {
    return this.request(`/api/issue-deliveries/${id}?depth=0`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async listVkPostsForDigest(digestId: CmsId) {
    const qs = new URLSearchParams({
      depth: '0',
      limit: '20',
      'where[digest][equals]': String(digestId),
    });
    return this.request<{ docs: Array<Record<string, unknown>> }>(`/api/vk-posts?${qs.toString()}`);
  }

  async createVkPost(data: Json) {
    return this.request<{ doc: { id: CmsId } }>(`/api/vk-posts?depth=0`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patchVkPost(id: CmsId, data: Json) {
    return this.request(`/api/vk-posts/${id}?depth=0`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async listSubscriptionDigests() {
    const qs = new URLSearchParams({
      depth: '1',
      limit: '30',
      sort: '-publishedAt',
    });
    return this.request<{ docs: Array<Record<string, unknown>> }>(`/api/digests?${qs.toString()}`);
  }

  async deleteWhere(collection: string, query: URLSearchParams) {
    return this.request(`/api/${collection}?${query.toString()}`, { method: 'DELETE' });
  }

  get batchSize(): number {
    return Number(process.env.BATCH_SIZE_PER_SOURCE || DEFAULT_BATCH_SIZE_PER_SOURCE);
  }
}
