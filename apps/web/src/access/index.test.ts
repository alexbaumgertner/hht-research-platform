import type { AccessArgs } from 'payload';

import {
  canUpdateResearchProject,
  isAuthenticated,
  isAuthenticatedOrWorker,
  safeEqualString,
  usersReadAccess,
  isWorkerOrAdmin,
} from './index';

function mockReq(opts: {
  user?: { id?: string; roles?: string[] } | null;
  apiKey?: string | null;
}): AccessArgs {
  const headers = new Headers();
  if (opts.apiKey) headers.set('X-Payload-API-Key', opts.apiKey);
  return { req: { user: opts.user ?? null, headers } } as AccessArgs;
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

  it('rejects wrong-length API keys without throwing', () => {
    expect(isWorkerOrAdmin(mockReq({ apiKey: 'x' }))).toBe(false);
    expect(isWorkerOrAdmin(mockReq({ apiKey: 'test-worker-key-extra' }))).toBe(false);
  });
});

describe('isAuthenticatedOrWorker', () => {
  const originalKey = process.env.PAYLOAD_API_KEY;

  beforeEach(() => {
    process.env.PAYLOAD_API_KEY = 'test-worker-key';
  });

  afterEach(() => {
    process.env.PAYLOAD_API_KEY = originalKey;
  });

  it('denies anonymous callers', () => {
    expect(isAuthenticatedOrWorker(mockReq({ user: null }))).toBe(false);
  });

  it('allows any logged-in user', () => {
    expect(isAuthenticatedOrWorker(mockReq({ user: { roles: [] } }))).toBe(true);
  });

  it('allows valid worker API key', () => {
    expect(isAuthenticatedOrWorker(mockReq({ apiKey: 'test-worker-key' }))).toBe(true);
  });
});

describe('usersReadAccess', () => {
  it('denies anonymous', () => {
    expect(usersReadAccess(mockReq({ user: null }))).toBe(false);
  });

  it('allows admins full read', () => {
    expect(usersReadAccess(mockReq({ user: { id: '1', roles: ['admin'] } }))).toBe(true);
  });

  it('scopes non-admin to self', () => {
    expect(usersReadAccess(mockReq({ user: { id: '42', roles: ['worker'] } }))).toEqual({
      id: { equals: '42' },
    });
  });
});

describe('safeEqualString', () => {
  it('compares equal strings', () => {
    expect(safeEqualString('abc', 'abc')).toBe(true);
    expect(safeEqualString('abc', 'abd')).toBe(false);
    expect(safeEqualString('abc', 'ab')).toBe(false);
  });
});
