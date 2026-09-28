import { createHmac } from 'node:crypto';

import { verifySvixSignature } from './svixVerify';

const secret = `whsec_${Buffer.from('test-webhook-secret').toString('base64')}`;

function sign(id: string, timestamp: string, body: string) {
  const key = Buffer.from(Buffer.from('test-webhook-secret').toString('base64'), 'base64');
  const digest = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return `v1,${digest}`;
}

describe('verifySvixSignature', () => {
  const now = Date.parse('2026-09-26T12:00:00.000Z');
  const timestamp = String(Math.floor(now / 1000));
  const body = '{"type":"email.complained"}';
  const id = 'msg_123';

  it('accepts a v1 signature over id.timestamp.rawBody', () => {
    expect(
      verifySvixSignature({
        secret,
        id,
        timestamp,
        signature: sign(id, timestamp, body),
        rawBody: body,
        now,
      }),
    ).toBe(true);
  });

  it('rejects a timestamp more than 5 minutes away', () => {
    const stale = String(Math.floor(now / 1000) - 6 * 60);
    expect(
      verifySvixSignature({
        secret,
        id,
        timestamp: stale,
        signature: sign(id, stale, body),
        rawBody: body,
        now,
      }),
    ).toBe(false);
  });

  it('rejects when no v1 signature matches', () => {
    expect(
      verifySvixSignature({
        secret,
        id,
        timestamp,
        signature: 'v1,bm90LXRoZS1kaWdlc3Q',
        rawBody: body,
        now,
      }),
    ).toBe(false);
  });
});
