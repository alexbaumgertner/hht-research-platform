import { expect, test, type APIRequestContext } from '@playwright/test';

import { ALLOWED_ORIGIN, BLOCKED_ORIGIN, servePartnerHost, widgetFrame } from './embed-helpers';

const PATH = '/embed/ru/hht-research/e2e-partner/auto-3-form';
const SLUG = 'hht-research';

// These tests flip issue visibility, so they must not overlap.
test.describe.configure({ mode: 'serial' });

async function latestIssueId(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get(`/api/public/projects/${SLUG}/issues?locale=ru`);
  const body = await res.json();
  return String((body.issues ?? body.docs ?? body)[0].id);
}

test('allowed origin renders the latest issue with every required element', async ({
  page,
  request,
}) => {
  await servePartnerHost(page, ALLOWED_ORIGIN);
  const frame = widgetFrame(page);
  const issueId = await latestIssueId(request);
  const detail = await (
    await request.get(`/api/public/projects/${SLUG}/issues/${issueId}?locale=ru`)
  ).json();

  // The first request after a cold start renders the page and initialises Payload.
  await expect(frame.locator('h2#w-heading')).toBeVisible({ timeout: 20_000 });
  await expect(frame.locator('ul.items > li.item')).toHaveCount(Math.min(3, detail.items.length));
  const titles = await frame.locator('ul.items > li.item > a').allTextContents();
  expect(titles).toEqual(detail.items.slice(0, 3).map((i: { title: string }) => i.title));
  for (const point of detail.summary?.points ?? []) {
    await expect(frame.locator('ol')).toContainText(point.text.slice(0, 30));
  }
  await expect(frame.locator('footer p')).toHaveCount(2);
  await expect(frame.locator('a[data-track="archive"]')).toBeVisible();
  if (detail.items.length > 3) {
    await expect(frame.locator('a[data-track="issue"]').last()).toBeVisible();
  }
});

test('option items=5 shows up to five items', async ({ page, request }) => {
  await page.route(ALLOWED_ORIGIN + '/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<iframe src="${new URL(PATH.replace('auto-3', 'auto-5'), page.context().browser() ? process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000' : '').href}" width="400" height="900"></iframe>`,
    }),
  );
  await page.goto(ALLOWED_ORIGIN + '/');
  const issueId = await latestIssueId(request);
  const detail = await (
    await request.get(`/api/public/projects/${SLUG}/issues/${issueId}?locale=ru`)
  ).json();
  await expect(widgetFrame(page).locator('li.item')).toHaveCount(Math.min(5, detail.items.length));
});

test('a blocked origin does not render our content', async ({ page }) => {
  await servePartnerHost(page, BLOCKED_ORIGIN);
  await expect(page.frameLocator('iframe').locator('h2#w-heading')).toHaveCount(0);
  const frame = page.frames().find((f) => f.url().includes('/embed/'));
  // The browser refuses the frame, so it never reaches our document.
  expect(frame ? await frame.content() : '').not.toContain('w-heading');
});

test('routing: 404, canonical options and locale redirects', async ({ request }) => {
  for (const bad of [
    '/embed/ru/hht-research/no-such-partner/auto-3-form',
    '/embed/ru/no-such-project/e2e-partner/auto-3-form',
  ]) {
    const res = await request.get(bad, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect(res.headers()['content-security-policy']).toBe("frame-ancestors 'none'");
  }
  const opts = await request.get('/embed/ru/hht-research/e2e-partner/de-99-x', {
    maxRedirects: 0,
  });
  expect(opts.status()).toBe(308);
  expect(opts.headers().location).toBe('/embed/ru/hht-research/e2e-partner/auto-3-form');
  const loc = await request.get('/embed/xx/hht-research/e2e-partner/auto-3-form', {
    maxRedirects: 0,
  });
  expect(loc.status()).toBe(308);
  expect(loc.headers().location).toBe('/embed/en/hht-research/e2e-partner/auto-3-form');
});

test('headers: partner origins only, no cookies, no X-Frame-Options', async ({ request }) => {
  const res = await request.get(PATH, { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  const h = res.headers();
  expect(h['content-security-policy']).toBe(
    'frame-ancestors http://127.0.0.1:4310 http://partner.test',
  );
  expect(h['x-frame-options']).toBeUndefined();
  expect(h['set-cookie']).toBeUndefined();
  expect(h['x-robots-tag']).toBe('noindex, nofollow');
});

test('hiding the latest issue removes it from the widget; unhiding restores it', async ({
  request,
}) => {
  const id = await latestIssueId(request);
  const link = (html: string) => html.match(/issues\/(\d+)\?src=/)?.[1];
  const before = link(await (await request.get(PATH)).text());
  expect(before).toBe(id);
  try {
    const hide = await request.post(`/api/test/issues/${id}/visibility`, {
      data: { hidden: true },
    });
    expect(hide.ok()).toBe(true);
    await expect
      .poll(async () => link(await (await request.get(PATH)).text()), { timeout: 10_000 })
      .not.toBe(id);
  } finally {
    await request.post(`/api/test/issues/${id}/visibility`, { data: { hidden: false } });
  }
  await expect
    .poll(async () => link(await (await request.get(PATH)).text()), { timeout: 10_000 })
    .toBe(id);
});

// --- translation and empty-state cases (US1 #3, #4, #7) ---

const TEST_ROUTE = '/api/test/issue-translations';
const DIGEST_PENDING_NOTE_TR = 'Çeviri devam ediyor. Şimdilik İngilizce gösteriliyor.';

/** Expires every cached embed page of the project: hiding and unhiding runs the real hooks. */
async function expireEmbedCache(request: APIRequestContext, id: string) {
  await request.post(`/api/test/issues/${id}/visibility`, { data: { hidden: true } });
  await request.post(`/api/test/issues/${id}/visibility`, { data: { hidden: false } });
}

async function resetTranslations(request: APIRequestContext, id: string, delayMs?: number) {
  const res = await request.post(TEST_ROUTE, {
    data: { action: 'reset', digest: Number(id), stubDelayMs: delayMs },
  });
  test.skip(res.status() === 404, 'Server must run with ISSUE_TRANSLATOR=stub');
  expect(res.ok()).toBe(true);
}

test('a ready translation is shown in the widget locale', async ({ request }) => {
  const id = await latestIssueId(request);
  await resetTranslations(request, id, 0);
  await expireEmbedCache(request, id);
  const english = (
    await (await request.get(`/api/public/projects/${SLUG}/issues/${id}?locale=en`)).json()
  ).summary?.points[0]?.text as string;
  const html = await (await request.get('/embed/de/hht-research/e2e-partner/auto-3-form')).text();
  expect(html).toContain(`[de] ${english}`);
  expect(html).not.toContain('role="note"');
  expect(html).toContain('<html lang="de"');
});

test('a slow translation shows English plus the note, then the translation', async ({
  request,
}) => {
  test.setTimeout(90_000);
  const id = await latestIssueId(request);
  const english = (
    await (await request.get(`/api/public/projects/${SLUG}/issues/${id}?locale=en`)).json()
  ).summary?.points[0]?.text as string;
  try {
    await resetTranslations(request, id, 11_000);
    await expireEmbedCache(request, id);
    const html = await (await request.get('/embed/tr/hht-research/e2e-partner/auto-3-form')).text();
    expect(html).toContain(DIGEST_PENDING_NOTE_TR);
    expect(html).toContain('role="note"');
    expect(html).toContain('lang="en"');
    expect(html).toContain(english);
    expect(html).not.toContain(`[tr] ${english}`);

    // When the background translation finishes, the store expires the embed cache (FR-004).
    await expect
      .poll(
        async () =>
          (
            await (await request.get('/embed/tr/hht-research/e2e-partner/auto-3-form')).text()
          ).includes(`[tr] ${english}`),
        { timeout: 30_000, intervals: [500] },
      )
      .toBe(true);
  } finally {
    await resetTranslations(request, id);
  }
});

test('a project without issues shows the coming-soon state with the trust notice', async ({
  request,
}) => {
  const res = await request.get('/embed/ru/embed-empty/e2e-partner/auto-3-form');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).not.toContain('<article');
  expect(html).not.toContain('class="item"');
  expect(html).toContain('Первый обзор скоро появится');
  expect(html).toContain('<footer>');
  expect(res.headers()['content-security-policy']).toBe('frame-ancestors http://127.0.0.1:4310');
});
