import { test, expect } from '@playwright/test';

const PROJECT_SLUG = 'hht-research';

async function skipWithoutSeed(page: import('@playwright/test').Page) {
  await page.goto(`/en/projects/${PROJECT_SLUG}`);
  const notFound = page.getByText(/Not found/i);
  if (await notFound.isVisible().catch(() => false)) {
    test.skip(true, 'Seed data required for public issue pages');
    return false;
  }
  return true;
}

async function getReadyIssueId(page: import('@playwright/test').Page): Promise<string | null> {
  const res = await page.request.get(
    `/api/public/projects/${PROJECT_SLUG}/issues?limit=10&locale=en`,
  );
  if (!res.ok()) return null;
  const body = (await res.json()) as {
    docs: Array<{ id: string; excerpt: string | null }>;
  };
  const ready = body.docs.find((issue) => issue.excerpt != null);
  return ready?.id ?? null;
}

async function getPendingIssueId(page: import('@playwright/test').Page): Promise<string | null> {
  const res = await page.request.get(
    `/api/public/projects/${PROJECT_SLUG}/issues?limit=10&locale=en`,
  );
  if (!res.ok()) return null;
  const body = (await res.json()) as {
    docs: Array<{ id: string; excerpt: string | null }>;
  };
  const pending = body.docs.find((issue) => issue.excerpt == null);
  return pending?.id ?? null;
}

test.describe('public issue page', () => {
  test('summary anchors lead to items and title opens material detail', async ({ page }) => {
    if (!(await skipWithoutSeed(page))) return;

    const issueId = await getReadyIssueId(page);
    if (!issueId) {
      test.skip(true, 'Ready issue seed required');
      return;
    }

    await page.goto(`/en/projects/${PROJECT_SLUG}/issues/${issueId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /what's new and why it matters/i }),
    ).toBeVisible();

    const firstAnchor = page.locator('section a[href^="#item-"]').first();
    await expect(firstAnchor).toBeVisible();
    const targetId = (await firstAnchor.getAttribute('href'))?.replace('#', '');
    expect(targetId).toMatch(/^item-/);

    await firstAnchor.click();
    await expect(page.locator(`#${targetId}`)).toBeVisible();

    const titleLink = page.locator(`#${targetId} a[href*="/publications/"]`).first();
    await expect(titleLink).toBeVisible();
    await titleLink.click();
    await expect(page).toHaveURL(/\/en\/projects\/hht-research\/publications\//);
  });

  test('pending digest shows summary unavailable with items still listed', async ({ page }) => {
    if (!(await skipWithoutSeed(page))) return;

    const issueId = await getPendingIssueId(page);
    if (!issueId) {
      test.skip(true, 'Pending issue seed required');
      return;
    }

    await page.goto(`/en/projects/${PROJECT_SLUG}/issues/${issueId}`);
    await expect(page.getByText(/summary not available yet/i)).toBeVisible();
    await expect(page.locator('ol li[id^="item-"]').first()).toBeVisible();
  });

  test('unknown id shows not-found, not load-error', async ({ page }) => {
    await page.goto(`/en/projects/${PROJECT_SLUG}/issues/000000000000000000000000`);
    await expect(page.getByText(/this issue could not be found/i)).toBeVisible();
    await expect(page.getByText(/could not be loaded/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /back to project/i })).toBeVisible();
  });
});

test.describe('public issue page accessibility', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });

  test('360px without JavaScript: anchors work and no horizontal scroll', async ({ page }) => {
    if (!(await skipWithoutSeed(page))) return;

    const issueId = await getReadyIssueId(page);
    if (!issueId) {
      test.skip(true, 'Ready issue seed required');
      return;
    }

    await page.goto(`/en/projects/${PROJECT_SLUG}/issues/${issueId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const anchor = page.locator('section a[href^="#item-"]').first();
    await expect(anchor).toBeVisible();
    const targetId = (await anchor.getAttribute('href'))?.replace('#', '');
    await anchor.click();
    await expect(page.locator(`#${targetId}`)).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
