import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

/**
 * Next.js 16+: this file must be named `proxy.ts` (was `middleware.ts`).
 * Handles locale negotiation and redirects `/` → `/en` (defaultLocale).
 */
export default createMiddleware(routing);

export const config = {
  // Match pages only — skip API, Payload admin, Next internals, and static files.
  matcher: ['/', '/(en|de|tr|ru|uk)/:path*', '/((?!api|admin|_next|_vercel|.*\\..*).*)'],
};
