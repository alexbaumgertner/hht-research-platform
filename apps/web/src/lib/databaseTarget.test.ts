import {
  assertLocalDatabaseForScript,
  isLocalDatabaseUrl,
  shouldPushSchema,
} from './databaseTarget';

describe('isLocalDatabaseUrl', () => {
  it('accepts loopback and docker-compose hosts', () => {
    expect(isLocalDatabaseUrl('postgres://payload:payload@localhost:5432/payload')).toBe(true);
    expect(isLocalDatabaseUrl('postgres://u:p@127.0.0.1/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgres://u:p@[::1]:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgres://u:p@postgres:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgres://u:p@host.docker.internal/db')).toBe(true);
  });

  it('rejects managed hosts and garbage', () => {
    expect(
      isLocalDatabaseUrl('postgres://u:p@ep-x-pooler.c-5.eu-central-1.aws.neon.tech/neondb'),
    ).toBe(false);
    expect(isLocalDatabaseUrl('not a url')).toBe(false);
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
  });
});

describe('shouldPushSchema', () => {
  it('pushes only to a local database unless explicitly allowed', () => {
    expect(shouldPushSchema({ DATABASE_URL: 'postgres://u:p@localhost/db' })).toBe(true);
    expect(shouldPushSchema({ DATABASE_URL: 'postgres://u:p@db.neon.tech/db' })).toBe(false);
    expect(
      shouldPushSchema({
        DATABASE_URL: 'postgres://u:p@db.neon.tech/db',
        PAYLOAD_ALLOW_REMOTE_PUSH: '1',
      }),
    ).toBe(true);
  });
});

describe('assertLocalDatabaseForScript', () => {
  it('throws for a remote database without the opt-in flag', () => {
    expect(() =>
      assertLocalDatabaseForScript('seed', { DATABASE_URL: 'postgres://u:p@db.neon.tech/db' }),
    ).toThrow(/seed refuses to run against remote database db\.neon\.tech/);
  });

  it('allows local databases and explicit opt-in', () => {
    expect(() =>
      assertLocalDatabaseForScript('seed', { DATABASE_URL: 'postgres://u:p@localhost/db' }),
    ).not.toThrow();
    expect(() =>
      assertLocalDatabaseForScript('seed', {
        DATABASE_URL: 'postgres://u:p@db.neon.tech/db',
        ALLOW_REMOTE_DATABASE: '1',
      }),
    ).not.toThrow();
  });
});
