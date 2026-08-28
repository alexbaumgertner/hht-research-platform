import { canUpdateResearchProject, isAuthenticated, isWorkerOrAdmin } from './index';

function mockReq(opts: { user?: { roles?: string[] } | null; apiKey?: string | null }): {
  req: { user: { roles?: string[] } | null; headers: Headers };
} {
  const headers = new Headers();
  if (opts.apiKey) headers.set('X-Payload-API-Key', opts.apiKey);
  return { req: { user: opts.user ?? null, headers } };
}

describe('research-projects access.update', () => {
  const originalKey = process.env.PAYLOAD_API_KEY;

  beforeEach(() => {
    process.env.PAYLOAD_API_KEY = 'test-worker-key';
  });

  afterEach(() => {
    process.env.PAYLOAD_API_KEY = originalKey;
  });

  it('isAuthenticated is true for any logged-in user, including without roles', () => {
    expect(isAuthenticated(mockReq({ user: { roles: [] } }))).toBe(true);
    expect(isAuthenticated(mockReq({ user: null }))).toBe(false);
  });

  it('denies anonymous requests without an API key', () => {
    expect(canUpdateResearchProject(mockReq({ user: null }))).toBe(false);
    expect(isWorkerOrAdmin(mockReq({ user: null }))).toBe(false);
  });

  it('allows full update for admin and worker roles, not merely req.user', () => {
    expect(canUpdateResearchProject(mockReq({ user: { roles: ['admin'] } }))).toBe(true);
    expect(canUpdateResearchProject(mockReq({ user: { roles: ['worker'] } }))).toBe(true);
    expect(
      canUpdateResearchProject({
        ...mockReq({ user: { roles: ['worker'] } }),
        data: { name: 'anything' },
      }),
    ).toBe(true);
    expect(canUpdateResearchProject(mockReq({ user: { roles: [] } }))).toBe(false);
    expect(canUpdateResearchProject(mockReq({ user: {} }))).toBe(false);
  });

  it('allows X-Payload-API-Key to patch lastSuccessfulRunAt only', () => {
    const req = mockReq({ apiKey: 'test-worker-key' });
    expect(
      canUpdateResearchProject({
        ...req,
        data: { lastSuccessfulRunAt: '2026-08-28T00:00:00.000Z' },
      }),
    ).toBe(true);
    expect(canUpdateResearchProject({ ...req, data: {} })).toBe(true);
    expect(canUpdateResearchProject({ ...req, data: { name: 'hijack' } })).toBe(false);
    expect(
      canUpdateResearchProject({
        ...req,
        data: { lastSuccessfulRunAt: '2026-08-28T00:00:00.000Z', name: 'hijack' },
      }),
    ).toBe(false);
  });

  it('rejects a wrong API key', () => {
    expect(
      canUpdateResearchProject({
        ...mockReq({ apiKey: 'wrong' }),
        data: { lastSuccessfulRunAt: '2026-08-28T00:00:00.000Z' },
      }),
    ).toBe(false);
  });
});
