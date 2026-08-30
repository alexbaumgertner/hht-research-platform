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

function isWorkerOrAdminRequest(req: {
  user?: unknown;
  headers: { get(name: string): string | null };
}): boolean {
  if (userHasWorkerOrAdminRole(req.user)) return true;

  const headerKey = req.headers.get('x-payload-api-key') || req.headers.get('X-Payload-API-Key');
  const expected = process.env.PAYLOAD_API_KEY;
  return Boolean(expected && headerKey && safeEqualString(headerKey, expected));
}

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

/** Deny all writes for anonymous visitors (explicit). */
export const denyWrite: Access = () => false;
