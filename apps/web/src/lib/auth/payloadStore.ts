import type { Payload } from 'payload';

import type { OtpStore } from './otp';

const o = { overrideAccess: true } as const;

export function payloadOtpStore(payload: Payload): OtpStore {
  return {
    async countCodesByEmailSince(email, since) {
      const r = await payload.count({
        collection: 'auth-codes',
        where: {
          and: [{ email: { equals: email } }, { createdAt: { greater_than: since.toISOString() } }],
        },
        ...o,
      });
      return r.totalDocs;
    },
    async countCodesByIpSince(ip, since) {
      const r = await payload.count({
        collection: 'auth-codes',
        where: {
          and: [
            { requestIp: { equals: ip } },
            { createdAt: { greater_than: since.toISOString() } },
          ],
        },
        ...o,
      });
      return r.totalDocs;
    },
    async createCode(record) {
      await payload.create({
        collection: 'auth-codes',
        data: { ...record, expiresAt: record.expiresAt.toISOString(), attempts: 0 },
        ...o,
      });
    },
    async latestActiveCode(email, now) {
      const r = await payload.find({
        collection: 'auth-codes',
        where: {
          and: [
            { email: { equals: email } },
            { consumedAt: { exists: false } },
            { expiresAt: { greater_than: now.toISOString() } },
          ],
        },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
        ...o,
      });
      const doc = r.docs[0];
      return doc
        ? {
            id: doc.id,
            codeHash: doc.codeHash,
            attempts: doc.attempts ?? 0,
            delivered: Boolean(doc.delivered),
          }
        : null;
    },
    async updateCode(id, patch) {
      await payload.update({
        collection: 'auth-codes',
        id,
        data: {
          ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
          ...(patch.consumedAt ? { consumedAt: patch.consumedAt.toISOString() } : {}),
        },
        ...o,
      });
    },
    async purgeCodesCreatedBefore(cutoff) {
      await payload.delete({
        collection: 'auth-codes',
        where: { createdAt: { less_than: cutoff.toISOString() } },
        ...o,
      });
    },
    async findAdminUserId(email) {
      const r = await payload.find({
        collection: 'users',
        where: { and: [{ email: { equals: email } }, { roles: { contains: 'admin' } }] },
        limit: 1,
        depth: 0,
        ...o,
      });
      return r.docs[0]?.id ?? null;
    },
  };
}
