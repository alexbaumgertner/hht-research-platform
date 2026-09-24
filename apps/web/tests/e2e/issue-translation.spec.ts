import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * On-demand issue translation (US5): single-flight across concurrent requests,
 * wait-then-fallback, and invalidation on edit. Runs against the seeded digest
 * reserved for this spec and the stub translator (`ISSUE_TRANSLATOR=stub`).
 */

const PROJECT_SLUG = 'hht-research';
const RESERVED_ISSUE_DATE = '2026-09-07T12:00:00.000Z';
const TEST_ROUTE = '/api/test/issue-translations';
const UK_PENDING_NOTE = 'Переклад ще виконується. Поки показано англійський текст.';

type IssueResponse = {
  summary: { points: Array<{ text: string }> } | null;
  items: Array<{ sentence: string | null }>;
  displayedLocale: string;
  isFallback: boolean;
  translation: { status: string };
};

type TestState = {
  rows: Array<{ locale: string; status: string; attempts: number; sourceRevision: number }>;
  invocations: Record<string, number>;
};

// Every test resets the same reserved digest, so they must not overlap.
test.describe.configure({ mode: 'serial' });

let issueId: string;

async function findReservedIssueId(request: APIRequestContext): Promise<string | null> {
  const res = await request.get(`/api/public/projects/${PROJECT_SLUG}/issues?locale=en`);
  if (!res.ok()) return null;
  const { docs } = (await res.json()) as { docs: Array<{ id: string; date: string }> };
  return docs.find((issue) => issue.date === RESERVED_ISSUE_DATE)?.id ?? null;
}

function issueApi(locale: string) {
  return `/api/public/projects/${PROJECT_SLUG}/issues/${issueId}?locale=${locale}`;
}

async function getIssue(request: APIRequestContext, locale: string): Promise<IssueResponse> {
  const res = await request.get(issueApi(locale));
  expect(res.status()).toBe(200);
  return (await res.json()) as IssueResponse;
}

async function reset(request: APIRequestContext, stubDelayMs?: number) {
  const res = await request.post(TEST_ROUTE, {
    data: { action: 'reset', digest: issueId, stubDelayMs },
  });
  expect(res.ok()).toBeTruthy();
}

async function readState(request: APIRequestContext): Promise<TestState> {
  const res = await request.get(`${TEST_ROUTE}?digest=${issueId}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as TestState;
}

async function englishFirstPoint(request: APIRequestContext): Promise<string> {
  const english = await getIssue(request, 'en');
  const text = english.summary?.points[0]?.text;
  expect(text).toBeTruthy();
  return text!;
}

test.beforeEach(async ({ request }) => {
  const id = await findReservedIssueId(request);
  test.skip(!id, 'Seeded single-flight issue required (pnpm --filter @hht/web seed:public-feed)');
  issueId = id!;

  const probe = await request.get(`${TEST_ROUTE}?digest=${issueId}`);
  test.skip(probe.status() === 404, 'Server must run with ISSUE_TRANSLATOR=stub');
});

test.afterAll(async ({ request }) => {
  if (issueId) await reset(request);
});

test('8 concurrent first requests run exactly one translation', async ({ request }) => {
  const english = await englishFirstPoint(request);
  // Long enough that every request arrives while the owner's translation is in flight.
  await reset(request, 1_500);

  const responses = await Promise.all(Array.from({ length: 8 }, () => request.get(issueApi('de'))));

  for (const res of responses) expect(res.status()).toBe(200);
  const bodies = (await Promise.all(responses.map((res) => res.json()))) as IssueResponse[];
  for (const body of bodies) {
    expect(body.translation.status).toBe('ready');
    expect(body.isFallback).toBe(false);
    expect(body.displayedLocale).toBe('de');
    expect(body.summary?.points[0]?.text).toBe(`[de] ${english}`);
  }

  const state = await readState(request);
  const rows = state.rows.filter((row) => row.locale === 'de');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ status: 'ready', attempts: 1 });
  expect(state.invocations.de).toBe(1);
});

test('a slow translation answers English within 8 s, then serves the translation', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const english = await englishFirstPoint(request);
  await reset(request, 11_000);

  const pageUrl = `/uk/projects/${PROJECT_SLUG}/issues/${issueId}`;
  const started = Date.now();
  // The first render is read as server HTML: the page needs no JavaScript, and a
  // browser visit in `next dev` may refresh itself after compiling the route.
  const [apiFallback, fallbackHtml] = await Promise.all([
    (async () => {
      const body = await getIssue(request, 'tr');
      return { body, elapsed: Date.now() - started };
    })(),
    request.get(pageUrl).then((res) => res.text()),
  ]);

  expect(apiFallback.body.translation.status).toBe('pending');
  expect(apiFallback.body.isFallback).toBe(true);
  expect(apiFallback.body.displayedLocale).toBe('en');
  expect(apiFallback.body.summary?.points[0]?.text).toBe(english);
  expect(apiFallback.elapsed).toBeLessThan(10_000);

  expect(fallbackHtml).toContain(UK_PENDING_NOTE);
  expect(fallbackHtml).toContain(english);
  expect(fallbackHtml).not.toContain(`[uk] ${english}`);

  await expect
    .poll(async () => (await readState(request)).rows.find((row) => row.locale === 'uk')?.status, {
      timeout: 20_000,
      intervals: [500],
    })
    .toBe('ready');

  await page.goto(pageUrl);
  await expect(page.getByText(`[uk] ${english}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('note')).toHaveCount(0);

  const state = await readState(request);
  expect(state.invocations.uk).toBe(1);
});

test('editing the English text invalidates cached translations', async ({ request }) => {
  const original = await englishFirstPoint(request);
  await reset(request, 0);

  const first = await getIssue(request, 'ru');
  expect(first.summary?.points[0]?.text).toBe(`[ru] ${original}`);
  const before = (await readState(request)).rows.find((row) => row.locale === 'ru');
  expect(before?.status).toBe('ready');

  const edited = `${original.replace(/ \(edited \d+\)$/, '')} (edited ${Date.now()})`;
  try {
    const edit = await request.post(TEST_ROUTE, {
      data: { action: 'edit-first-point', digest: issueId, text: edited },
    });
    expect(edit.ok()).toBeTruthy();
    const { issueTextRevision } = (await edit.json()) as { issueTextRevision: number };
    expect(issueTextRevision).toBe((before?.sourceRevision ?? 0) + 1);

    expect((await readState(request)).rows).toHaveLength(0);

    const second = await getIssue(request, 'ru');
    expect(second.summary?.points[0]?.text).toBe(`[ru] ${edited}`);

    const state = await readState(request);
    expect(state.invocations.ru).toBe(2);
    expect(state.rows.find((row) => row.locale === 'ru')).toMatchObject({
      status: 'ready',
      attempts: 1,
      sourceRevision: issueTextRevision,
    });
  } finally {
    await request.post(TEST_ROUTE, {
      data: { action: 'edit-first-point', digest: issueId, text: original },
    });
  }
});
