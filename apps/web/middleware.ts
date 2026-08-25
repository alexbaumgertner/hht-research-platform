import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(en|de|tr|ru|uk)/:path*', '/((?!api|admin|_next|_vercel|.*\\..*).*)'],
};
