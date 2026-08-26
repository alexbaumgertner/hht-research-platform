/**
 * Absolute public site origin for server-side fetches and Payload serverURL.
 * Prefer explicit PUBLIC_SITE_URL; fall back to Vercel deployment URL.
 */
export function getPublicSiteUrl(): string {
  if (process.env.PUBLIC_SITE_URL) {
    return process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  }
  return 'http://localhost:3000';
}
