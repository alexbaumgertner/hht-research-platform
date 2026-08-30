'use client';

import { useLayoutEffect } from 'react';

const STORAGE_KEY = 'mantine-color-scheme-value';

/**
 * Applies Mantine's color-scheme attribute without rendering a <script>.
 * Next.js 16 warns (and skips execution) when <script> is rendered from React
 * during client navigations such as locale switches.
 */
export function MantineColorSchemeInit() {
  useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const colorScheme =
        stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
      const computed =
        colorScheme !== 'auto'
          ? colorScheme
          : window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
      document.documentElement.setAttribute('data-mantine-color-scheme', computed);
    } catch {
      // localStorage / matchMedia can throw in restricted contexts
    }
  }, []);

  return null;
}
