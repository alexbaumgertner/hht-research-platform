import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FrameLocator, Page } from '@playwright/test';

export const ALLOWED_ORIGIN = 'http://127.0.0.1:4310';
export const BLOCKED_ORIGIN = 'http://localhost:4310';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/** Serves a fixture page from a fake partner origin; `__BASE__` becomes the widget origin. */
export async function servePartnerHost(
  page: Page,
  origin: string,
  fixture: 'partner-host.html' | 'partner-host-iframe.html' = 'partner-host-iframe.html',
  opts: { baseURL?: string; transform?: (html: string) => string } = {},
) {
  const baseURL = opts.baseURL ?? (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
  let html = fs.readFileSync(path.join(FIXTURES, fixture), 'utf8').replaceAll('__BASE__', baseURL);
  if (opts.transform) html = opts.transform(html);
  await page.route(`${origin}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
  );
  await page.goto(`${origin}/`);
}

export function widgetFrame(page: Page): FrameLocator {
  return page.frameLocator('iframe');
}
