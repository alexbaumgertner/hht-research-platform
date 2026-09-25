import crypto from 'node:crypto';

import {
  backupFileName,
  backupKey,
  orderTables,
  packDump,
  summarize,
  unpackDump,
  type Dump,
} from './backup';
import { cronAuthorized } from './cronAuth';

const key = crypto.randomBytes(32);

const dump: Dump = {
  version: 1,
  createdAt: '2026-09-25T03:00:12.000Z',
  source: 'abcd1234',
  tables: [
    { name: 'research_projects', rows: [{ id: 1, name: 'HHT' }] },
    { name: 'publications', rows: [{ id: 7, title: 'Кириллица и ümlaut', meta: { a: [1] } }] },
    { name: 'digests', rows: [] },
  ],
  sequences: [{ name: 'publications_id_seq', value: '7' }],
};

describe('orderTables', () => {
  it('puts parents before children', () => {
    const order = orderTables(
      ['digests_rels', 'digests', 'publications', 'research_projects'],
      [
        { child: 'digests_rels', parent: 'digests' },
        { child: 'digests_rels', parent: 'publications' },
        { child: 'digests', parent: 'research_projects' },
        { child: 'publications', parent: 'research_projects' },
      ],
    );
    expect(order.indexOf('research_projects')).toBeLessThan(order.indexOf('digests'));
    expect(order.indexOf('digests')).toBeLessThan(order.indexOf('digests_rels'));
    expect(order.indexOf('publications')).toBeLessThan(order.indexOf('digests_rels'));
  });

  it('ignores self references and keeps a cycle instead of dropping tables', () => {
    const order = orderTables(
      ['a', 'b', 'c'],
      [
        { child: 'a', parent: 'a' },
        { child: 'b', parent: 'c' },
        { child: 'c', parent: 'b' },
      ],
    );
    expect(order[0]).toBe('a');
    expect([...order].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('packDump / unpackDump', () => {
  it('round-trips a dump, including non-ASCII text and JSON values', () => {
    expect(unpackDump(packDump(dump, key), key)).toEqual(dump);
  });

  it('rejects a wrong key and a tampered file', () => {
    const file = packDump(dump, key);
    expect(() => unpackDump(file, crypto.randomBytes(32))).toThrow();
    const tampered = Buffer.from(file);
    tampered[tampered.length - 1] ^= 1;
    expect(() => unpackDump(tampered, key)).toThrow();
  });

  it('does not contain the plaintext', () => {
    expect(packDump(dump, key).includes(Buffer.from('research_projects'))).toBe(false);
  });
});

describe('backupKey', () => {
  it('is null when unset and rejects a key that is not 32 bytes', () => {
    expect(backupKey({})).toBeNull();
    expect(() => backupKey({ BACKUP_KEY: Buffer.alloc(16).toString('base64') })).toThrow(
      /32 bytes/,
    );
    expect(backupKey({ BACKUP_KEY: key.toString('base64') })).toEqual(key);
  });
});

describe('summarize and file name', () => {
  it('lists non-empty tables and the date-stamped file name', () => {
    expect(summarize(dump)).toBe(
      'Rows: 2\n  research_projects: 1\n  publications: 1\nSequences: 1',
    );
    expect(backupFileName(dump)).toBe('hht-news-2026-09-25.json.gz.enc');
  });
});

describe('cronAuthorized', () => {
  const request = (auth?: string) =>
    new Request('https://x/api/cron/backup', { headers: auth ? { authorization: auth } : {} });

  it('requires the bearer secret when one is set', () => {
    const env = { CRON_SECRET: 's3cret', VERCEL_ENV: 'production' };
    expect(cronAuthorized(request('Bearer s3cret'), env)).toBe(true);
    expect(cronAuthorized(request('Bearer nope'), env)).toBe(false);
    expect(cronAuthorized(request(), env)).toBe(false);
  });

  it('fails closed on any Vercel deployment without a secret, open only locally', () => {
    expect(cronAuthorized(request(), { VERCEL_ENV: 'preview' })).toBe(false);
    expect(cronAuthorized(request(), { VERCEL_ENV: 'production' })).toBe(false);
    expect(cronAuthorized(request(), {})).toBe(true);
  });
});
