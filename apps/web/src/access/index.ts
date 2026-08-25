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

/**
 * Worker authenticates via Payload API key on a Users account,
 * or via X-Payload-API-Key header matching PAYLOAD_API_KEY.
 */
export const isWorkerOrAdmin: Access = ({ req }) => {
  if (req.user) {
    const roles = (req.user as { roles?: string[] }).roles;
    if (roles?.includes('admin') || roles?.includes('worker')) return true;
  }

  const headerKey = req.headers.get('x-payload-api-key') || req.headers.get('X-Payload-API-Key');
  const expected = process.env.PAYLOAD_API_KEY;
  if (expected && headerKey && headerKey === expected) {
    return true;
  }

  return false;
};

/** Deny all writes for anonymous visitors (explicit). */
export const denyWrite: Access = () => false;
