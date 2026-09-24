import { timingSafeEqual } from 'node:crypto';
import type { Access, FieldAccess, Where } from 'payload';

export const isAdmin: Access = ({ req: { user } }) => {
  if (!user) return false;
  const roles = (user as { roles?: string[] }).roles;
  return Boolean(roles?.includes('admin'));
};

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => {
  if (!user) return false;
  const roles = (user as { roles?: string[] }).roles;
  return Boolean(roles?.includes('admin'));
};

/** Authenticated Payload user (any logged-in admin user). */
export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user);

function userHasWorkerOrAdminRole(user: unknown): boolean {
  const roles = (user as { roles?: string[] } | null)?.roles;
  return Boolean(roles?.includes('admin') || roles?.includes('worker'));
}

/** Constant-time string compare; false when lengths differ. */
export function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

type RequestLike = {
  user?: unknown;
  headers?: { get(name: string): string | null } | null;
};

function hasWorkerApiKeyHeader(req: RequestLike): boolean {
  const headerKey = req.headers?.get('x-payload-api-key');
  const expected = process.env.PAYLOAD_API_KEY;
  return Boolean(expected && headerKey && safeEqualString(headerKey, expected));
}

function isWorkerOrAdminRequest(req: RequestLike): boolean {
  if (userHasWorkerOrAdminRole(req.user)) return true;
  return hasWorkerApiKeyHeader(req);
}

/**
 * The worker writes either with the header-only X-Payload-API-Key (no `req.user`)
 * or as a Users account with the `worker` role.
 */
export function isWorkerRequest(req: RequestLike): boolean {
  if (req.user) {
    const roles = (req.user as { roles?: string[] }).roles;
    return Boolean(roles?.includes('worker'));
  }
  return hasWorkerApiKeyHeader(req);
}

/**
 * Who is writing, decided by the request rather than the payload (the admin form
 * submits every stored field). `system` is an unauthenticated Local API call
 * (seed scripts, hooks) and is neither an owner edit nor a worker write.
 */
export type WriteOrigin = 'owner' | 'worker' | 'system';

export function classifyWrite(req: RequestLike): WriteOrigin {
  if (isWorkerRequest(req)) return 'worker';
  return req.user ? 'owner' : 'system';
}

export const isWorkerFieldLevel: FieldAccess = ({ req }) => isWorkerRequest(req);

/**
 * Worker authenticates via Payload API key on a Users account,
 * or via X-Payload-API-Key header matching PAYLOAD_API_KEY.
 */
export const isWorkerOrAdmin: Access = ({ req }) => isWorkerOrAdminRequest(req);

export const isWorkerOrAdminFieldLevel: FieldAccess = ({ req }) => isWorkerOrAdminRequest(req);

/**
 * Any logged-in Payload user, or the worker's header API key.
 * Not anonymous — replaces the old always-true publicRead.
 */
export const isAuthenticatedOrWorker: Access = ({ req }) =>
  Boolean(req.user) || isWorkerOrAdminRequest(req);

/**
 * Users.read: admins see everyone; others see only themselves.
 * Returns a Where constraint for non-admin authenticated users.
 */
export const usersReadAccess: Access = ({ req: { user } }): boolean | Where => {
  if (!user) return false;
  const roles = (user as { roles?: string[] }).roles;
  if (roles?.includes('admin')) return true;
  return { id: { equals: user.id } };
};

/**
 * Research-projects update: admin/worker sessions (and native API-key users with
 * those roles) may edit the document. Header-only X-Payload-API-Key may patch
 * lastSuccessfulRunAt only — not name, keywords, owner, etc.
 */
export const canUpdateResearchProject: Access = ({ req, data }) => {
  if (userHasWorkerOrAdminRole(req.user)) return true;
  if (!isWorkerOrAdmin({ req })) return false;

  const keys = Object.keys((data ?? {}) as Record<string, unknown>);
  return keys.every((key) => key === 'lastSuccessfulRunAt');
};

/**
 * Monitored-sources update: owners edit sources in Admin; the header-only worker
 * key may advance the per-source watermark (lastSuccessfulFetchAt) and nothing else.
 */
export const canUpdateMonitoredSource: Access = ({ req, data }) => {
  if (req.user) return true;
  if (!isWorkerOrAdmin({ req })) return false;

  const keys = Object.keys((data ?? {}) as Record<string, unknown>);
  return keys.every((key) => key === 'lastSuccessfulFetchAt');
};

/** Deny all writes for anonymous visitors (explicit). */
export const denyWrite: Access = () => false;
