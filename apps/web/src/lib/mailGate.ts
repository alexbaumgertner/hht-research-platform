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
  const from = env.RESEND_FROM_EMAIL?.trim() ?? '';
  return key.length > 0 && from.length > 0 && !isSandboxFromAddress(env);
}

export function isSandboxFromAddress(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const from = env.RESEND_FROM_EMAIL?.trim() ?? '';
  return from.toLowerCase().endsWith('@resend.dev');
}
