import type { AccessArgs } from 'payload';

import { Subscribers } from './Subscribers';

function req(opts: { user?: { roles?: string[] } | null; apiKey?: string }): AccessArgs {
  const headers = new Headers();
  if (opts.apiKey) headers.set('X-Payload-API-Key', opts.apiKey);
  return { req: { user: opts.user ?? null, headers } } as AccessArgs;
}

describe('subscribers access.delete', () => {
  const originalKey = process.env.PAYLOAD_API_KEY;

  beforeEach(() => {
    process.env.PAYLOAD_API_KEY = 'test-worker-key';
  });

  afterEach(() => {
    process.env.PAYLOAD_API_KEY = originalKey;
  });

  const canDelete = (args: AccessArgs) => Subscribers.access?.delete?.(args);

  // The worker sweep purges expired pending and long-unsubscribed rows (spec 006 T039).
  it('lets the worker delete with its API key', () => {
    expect(canDelete(req({ apiKey: 'test-worker-key' }))).toBe(true);
  });

  it('still lets a logged-in owner delete', () => {
    expect(canDelete(req({ user: { roles: [] } }))).toBe(true);
  });

  it('denies anonymous requests and a wrong API key', () => {
    expect(canDelete(req({}))).toBe(false);
    expect(canDelete(req({ apiKey: 'wrong' }))).toBe(false);
  });
});
