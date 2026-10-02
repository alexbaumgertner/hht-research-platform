/** The bare address from `RESEND_FROM_EMAIL`, which may be `Name <a@b>` or `a@b`. Empty when unset. */
export function fromAddress(env: Record<string, string | undefined> = process.env): string {
  const raw = env.RESEND_FROM_EMAIL?.trim() ?? '';
  return (raw.match(/<([^>]*)>/)?.[1] ?? raw).trim();
}

/**
 * Whether mail may go to anyone but the project owner (research R12). Closed while the sender is
 * Resend's sandbox, and on Vercel Preview: previews share the production Resend key and sender,
 * so without this a preview URL could mail real people from the production domain.
 */
export function subscriberMailEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.VERCEL_ENV === 'preview') return false;
  const key = env.RESEND_API_KEY?.trim() ?? '';
  const from = fromAddress(env);
  return key.length > 0 && from.length > 0 && !isSandboxFromAddress(env);
}

export function isSandboxFromAddress(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const from = fromAddress(env);
  return from.toLowerCase().endsWith('@resend.dev');
}
