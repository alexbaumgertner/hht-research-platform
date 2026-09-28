import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { parseChatSource } from '@hht/shared';

import { routing } from './i18n/routing';

/**
 * Next.js 16+: this file must be named `proxy.ts` (was `middleware.ts`).
 * Handles locale negotiation and redirects `/` → `/en` (defaultLocale).
 * The first recognized `src` query in a browser session is kept as a session cookie.
 */
const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = await handleI18n(request);
  const incoming = request.nextUrl.searchParams.get('src');
  const source = parseChatSource(incoming);
  if (source !== 'other' && !request.cookies.get('src') && response instanceof NextResponse) {
    response.cookies.set('src', source, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: request.nextUrl.protocol === 'https:',
    });
  }
  return response;
}

export const config = {
  // Match pages only — skip API, Payload admin, Next internals, and static files.
  matcher: ['/', '/(en|de|tr|ru|uk)/:path*', '/((?!api|admin|_next|_vercel|.*\\..*).*)'],
};
