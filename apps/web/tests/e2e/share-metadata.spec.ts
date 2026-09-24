import { test, expect, type APIRequestContext } from '@playwright/test';

const PROJECT_SLUG = 'hht-research';
const TELEGRAM_UA = 'TelegramBot (like TwitterBot)';

async function getReadyIssueId(request: APIRequestContext): Promise<string | null> {
  const res = await request.get(`/api/public/projects/${PROJECT_SLUG}/issues?limit=10&locale=en`);
  if (!res.ok()) return null;
  const body = (await res.json()) as { docs: Array<{ id: string; excerpt: string | null }> };
  return body.docs.find((issue) => issue.excerpt != null)?.id ?? null;
}

async function getMaterialId(request: APIRequestContext): Promise<string | null> {
  const res = await request.get(`/api/public/projects/${PROJECT_SLUG}/materials?locale=en`);
  if (!res.ok()) return null;
  const body = (await res.json()) as { docs: Array<{ id: string }> };
  return body.docs[0]?.id ?? null;
}

function metaContent(head: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = head.match(new RegExp(`<meta (?:property|name)="${escaped}" content="([^"]*)"`));
  return match?.[1] ?? null;
}

/** Requests a page as Telegram's crawler and returns what it sees in `<head>`. */
async function crawlHead(request: APIRequestContext, path: string) {
  const res = await request.get(path, { headers: { 'User-Agent': TELEGRAM_UA } });
  expect(res.status(), path).toBe(200);
  const html = await res.text();
  const headEnd = html.indexOf('</head>');
  expect(headEnd, 'document has a </head>').toBeGreaterThan(0);
  const head = html.slice(0, headEnd);

  return {
    title: metaContent(head, 'og:title'),
    description: metaContent(head, 'og:description'),
    image: metaContent(head, 'og:image'),
    twitterCard: metaContent(head, 'twitter:card'),
  };
}

async function expectShareable(request: APIRequestContext, path: string) {
  const meta = await crawlHead(request, path);
  expect(meta.title, `${path} og:title`).toBeTruthy();
  expect(meta.description, `${path} og:description`).toBeTruthy();
  expect(meta.image, `${path} og:image`).toMatch(/^https?:\/\//);
  expect(meta.twitterCard).toBe('summary_large_image');

  const image = await request.get(new URL(meta.image!).pathname);
  expect(image.status(), `${meta.image}`).toBe(200);
  expect(image.headers()['content-type']).toBe('image/png');

  return meta;
}

test.describe('share metadata for chat-app crawlers', () => {
  test.describe.configure({ mode: 'serial' });
  test('issue page exposes localized og tags and a PNG image', async ({ request }) => {
    const issueId = await getReadyIssueId(request);
    test.skip(!issueId, 'Ready issue seed required');

    const en = await expectShareable(request, `/en/projects/${PROJECT_SLUG}/issues/${issueId}`);
    expect(en.image).toContain(`/en/projects/${PROJECT_SLUG}/issues/${issueId}/opengraph-image`);

    const ru = await expectShareable(request, `/ru/projects/${PROJECT_SLUG}/issues/${issueId}`);
    expect(ru.title).toContain('обновление');
    expect(ru.title).not.toBe(en.title);
  });

  test('material detail page keeps the project image', async ({ request }) => {
    const materialId = await getMaterialId(request);
    test.skip(!materialId, 'Seeded materials required');

    const meta = await expectShareable(
      request,
      `/en/projects/${PROJECT_SLUG}/publications/${materialId}`,
    );
    expect(meta.image).toContain(`/en/projects/${PROJECT_SLUG}/opengraph-image`);
  });

  // The archive page is created in T046; un-fixme this once it exists.
  test.fixme('archive page keeps the project image', async ({ request }) => {
    const meta = await expectShareable(request, `/en/projects/${PROJECT_SLUG}/issues`);
    expect(meta.image).toContain(`/en/projects/${PROJECT_SLUG}/opengraph-image`);
  });

  test('project and home pages expose their own share cards', async ({ request }) => {
    const projectRes = await request.get(`/api/public/projects/${PROJECT_SLUG}`);
    test.skip(!projectRes.ok(), 'Seeded project required');

    const project = await expectShareable(request, `/de/projects/${PROJECT_SLUG}`);
    expect(project.image).toContain(`/de/projects/${PROJECT_SLUG}/opengraph-image`);

    const home = await expectShareable(request, '/tr');
    expect(home.image).toContain('/tr/opengraph-image');
  });

  test('unknown issue image falls back to a PNG card', async ({ request }) => {
    const res = await request.get(
      `/uk/projects/${PROJECT_SLUG}/issues/000000000000000000000000/opengraph-image`,
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  });
});
