import type { AccessArgs } from 'payload';

import { SubscribeRateLimits } from './SubscribeRateLimits';

function req(opts: { user?: { roles?: string[] } | null; apiKey?: string }): AccessArgs {
  const headers = new Headers();
  if (opts.apiKey) headers.set('X-Payload-API-Key', opts.apiKey);
  return { req: { user: opts.user ?? null, headers } } as AccessArgs;
}

describe('subscribe-rate-limits access', () => {
  const originalKey = process.env.PAYLOAD_API_KEY;

  beforeEach(() => {
    process.env.PAYLOAD_API_KEY = 'test-worker-key';
  });

  afterEach(() => {
    process.env.PAYLOAD_API_KEY = originalKey;
  });

  // Payload validates `where` paths against read access on REST deletes, so the worker sweep
  // (`where[createdAt][less_than]`) needs read as well as delete.
  it('lets the worker read and delete, so its createdAt filter is queryable', () => {
    const worker = req({ apiKey: 'test-worker-key' });
    expect(SubscribeRateLimits.access?.read?.(worker)).toBe(true);
    expect(SubscribeRateLimits.access?.delete?.(worker)).toBe(true);
  });

  it('keeps anonymous and plain logged-in requests out', () => {
    for (const args of [req({}), req({ user: { roles: [] } }), req({ apiKey: 'wrong' })]) {
      expect(SubscribeRateLimits.access?.read?.(args)).toBe(false);
      expect(SubscribeRateLimits.access?.delete?.(args)).toBe(false);
    }
  });
});
