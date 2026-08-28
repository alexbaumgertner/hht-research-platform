import type { Access, FieldAccess } from 'payload';

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

/** Public read for published research content. */
export const publicRead: Access = () => true;

function userHasWorkerOrAdminRole(user: unknown): boolean {
  const roles = (user as { roles?: string[] } | null)?.roles;
  return Boolean(roles?.includes('admin') || roles?.includes('worker'));
}

function isWorkerOrAdminRequest(req: {
  user?: unknown;
  headers: { get(name: string): string | null };
}): boolean {
  if (userHasWorkerOrAdminRole(req.user)) return true;

  const headerKey = req.headers.get('x-payload-api-key') || req.headers.get('X-Payload-API-Key');
  const expected = process.env.PAYLOAD_API_KEY;
  return Boolean(expected && headerKey && headerKey === expected);
}

/**
 * Worker authenticates via Payload API key on a Users account,
 * or via X-Payload-API-Key header matching PAYLOAD_API_KEY.
 */
export const isWorkerOrAdmin: Access = ({ req }) => isWorkerOrAdminRequest(req);

export const isWorkerOrAdminFieldLevel: FieldAccess = ({ req }) => isWorkerOrAdminRequest(req);

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
