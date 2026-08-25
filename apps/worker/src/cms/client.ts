import {
  DEFAULT_BATCH_SIZE_PER_SOURCE,
  DEFAULT_BOOTSTRAP_LOOKBACK_DAYS,
  isProjectDue,
  type Schedule,
  type MonitoringStatus,
} from '@hht/shared';

type Json = Record<string, unknown>;

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
      throw new Error(`CMS ${init?.method || 'GET'} ${path} failed: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async listDueProjects(): Promise<
    Array<{
      id: string;
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
        id: string;
        type: 'pubmed' | 'clinicaltrials' | 'rss';
        rssUrl?: string | null;
        enabled: boolean;
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
            id: String(s.id),
            type: s.type,
            rssUrl: s.rssUrl,
            enabled: s.enabled !== false,
          }));

        const due = isProjectDue({
          monitoringStatus: project.monitoringStatus,
          schedule: project.schedule,
          lastSuccessfulRunAt: project.lastSuccessfulRunAt,
        });

        if (!due || keywords.length === 0 || !projectSources.some((s) => s.enabled)) {
          return null;
        }

        const ownerEmail =
          typeof project.owner === 'object' && project.owner && 'email' in project.owner
            ? project.owner.email
            : undefined;

        return {
          id: String(project.id),
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

  async createRun(projectId: string, triggeredBy: 'schedule' | 'manual') {
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

  async findPublicationByDedupe(projectId: string, dedupeKey: string) {
    const qs = new URLSearchParams({
      limit: '1',
      depth: '0',
      'where[and][0][project][equals]': projectId,
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

  async createDigest(data: Json) {
    return this.request<{ doc: { id: string | number } }>(`/api/digests`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patchProjectWatermark(projectId: string, finishedAt: string) {
    return this.request(`/api/research-projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ lastSuccessfulRunAt: finishedAt }),
    });
  }

  get batchSize(): number {
    return Number(process.env.BATCH_SIZE_PER_SOURCE || DEFAULT_BATCH_SIZE_PER_SOURCE);
  }
}
