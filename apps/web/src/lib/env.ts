/**
 * Read a required environment variable.
 * In non-production, an optional `devFallback` may be used with a warning.
 * Never use a hardcoded secret as a production fallback.
 */
export function requiredEnv(name: string, devFallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production' || devFallback === undefined) {
    throw new Error(`${name} is required`);
  }
  console.warn(`[env] ${name} not set; using development fallback`);
  return devFallback;
}
