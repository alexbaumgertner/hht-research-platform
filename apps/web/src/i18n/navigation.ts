import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

// Keep createNavigation out of routing.ts so proxy.ts can import routing
// without pulling next/root-params into the middleware/proxy bundle.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
