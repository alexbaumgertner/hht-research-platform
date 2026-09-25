/**
 * Access to cron routes. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 *
 * Fails closed: on any Vercel deployment a missing secret is a misconfiguration
 * and must deny, not allow. Preview databases are branches of production, so an
 * open backup route on a preview would hand out real data. Only local runs
 * (no `VERCEL_ENV`) are open without a secret.
 */
export function cronAuthorized(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const secret = env.CRON_SECRET?.trim();
  if (secret) return request.headers.get('authorization') === `Bearer ${secret}`;
  return !env.VERCEL_ENV;
}
