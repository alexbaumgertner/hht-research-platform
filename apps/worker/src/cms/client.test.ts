import { CmsClient } from './client.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Payload on Postgres returns numeric ids; relationship fields must get them back as numbers. */
const fakePayloadRest: typeof fetch = async (input) => {
  const url = String(input);
  if (url.includes('/api/research-projects')) {
    return jsonResponse({
      docs: [
        {
          id: 2,
          name: 'Test project',
          slug: 'test-project',
          keywords: [{ value: 'telangiectasia' }],
          schedule: 'daily',
          monitoringStatus: 'active',
          lastSuccessfulRunAt: null,
        },
      ],
    });
  }
  if (url.includes('/api/monitored-sources')) {
    return jsonResponse({
      docs: [{ id: 4, project: 2, type: 'pubmed', enabled: true }],
    });
  }
  throw new Error(`Unexpected fetch ${url}`);
};

describe('CmsClient.listDueProjects', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = fakePayloadRest;
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
