import { CmsClient } from './client.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseProject = {
  id: 2,
  name: 'Test project',
  slug: 'test-project',
  keywords: [{ value: 'telangiectasia' }],
  schedule: 'daily',
  monitoringStatus: 'active',
  lastSuccessfulRunAt: null,
};

/** Payload on Postgres returns numeric ids; relationship fields must get them back as numbers. */
function fakePayloadRest(projects: Array<Record<string, unknown>>): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('/api/research-projects')) {
      return jsonResponse({ docs: projects });
    }
    if (url.includes('/api/monitored-sources')) {
      return jsonResponse({
        docs: projects.map((p, i) => ({ id: 4 + i, project: p.id, type: 'pubmed', enabled: true })),
      });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MS_HOUR = 60 * 60 * 1000;

describe('CmsClient.listDueProjects', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = fakePayloadRest([baseProject]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('passes the publish anchor to the due check', async () => {
    // Anchor at yesterday's weekday and this hour, so the latest slot is ~24h ago.
    // A run 26h ago is under the rolling 7-day interval but missed that slot.
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * MS_HOUR);
    const weekly = {
      ...baseProject,
      schedule: 'weekly',
      lastSuccessfulRunAt: new Date(now.getTime() - 26 * MS_HOUR).toISOString(),
    };
    global.fetch = fakePayloadRest([
      {
        ...weekly,
        publishWeekday: WEEKDAYS[yesterday.getUTCDay()],
        publishHourUtc: now.getUTCHours(),
      },
      { ...weekly, id: 3, slug: 'unanchored' },
    ]);

    const projects = await new CmsClient('https://cms.test', 'key').listDueProjects();

    expect(projects.map((p) => p.slug)).toEqual(['test-project']);
  });

  it('keeps numeric source ids so publications.monitoredSource passes Payload relationship validation', async () => {
    const cms = new CmsClient('https://cms.test', 'key');
    const projects = await cms.listDueProjects();

    // Payload rejects "4" (string) for a numeric-id relationship:
    // "This relationship field has the following invalid relationships: 4 0"
    expect(projects).toHaveLength(1);
    expect(projects[0]?.sources[0]?.id).toBe(4);
    expect(projects[0]?.id).toBe(2);
  });
});
