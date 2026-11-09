import { expect, test, type Page } from '@playwright/test';

import { ALLOWED_ORIGIN, BLOCKED_ORIGIN, servePartnerHost } from './embed-helpers';

const FRAME = 'iframe[data-dw-frame], [data-digest-widget] iframe';
const FALLBACK = '[data-digest-widget] > p';

async function frameHeights(page: Page) {
  const handle = await page.locator(FRAME).first().elementHandle();
  const frame = await handle!.contentFrame();
  const inner = await frame!.evaluate(() => ({
    html: Math.ceil(document.documentElement.getBoundingClientRect().height),
    scroll: document.documentElement.scrollHeight,
    client: document.documentElement.clientHeight,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  const outer = await handle!.evaluate((el) => Math.round(el.getBoundingClientRect().height));
  return { inner, outer, frame: frame! };
}

for (const width of [320, 1280]) {
  test(`frame fits its content at ${width}px without inner scrollbars`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html');
    await expect(page.locator(FRAME)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(FALLBACK)).toBeHidden();
    await expect
      .poll(async () => {
        const { inner, outer } = await frameHeights(page);
        return Math.abs(outer - inner.html);
      })
      .toBeLessThanOrEqual(2);
    const { inner } = await frameHeights(page);
    expect(inner.scroll).toBeLessThanOrEqual(inner.client);
    expect(inner.overflowX).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('outer height follows a change of the inner content', async ({ page }) => {
  await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html');
  await expect(page.locator(FRAME)).toBeVisible({ timeout: 20_000 });
  const { outer, frame } = await frameHeights(page);
  await frame.evaluate(() => {
    const filler = document.createElement('div');
    filler.style.height = '400px';
    document.body.appendChild(filler);
  });
  await expect
    .poll(async () => (await frameHeights(page)).outer, { timeout: 5_000 })
    .toBeGreaterThanOrEqual(outer + 390);
});

test('data-theme=auto follows the browser; light forces light', async ({ page }) => {
  const bg = async () => {
    const { frame } = await frameHeights(page);
    return frame.evaluate(() => getComputedStyle(document.body).backgroundColor);
  };
  await page.emulateMedia({ colorScheme: 'dark' });
  await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html');
  await expect(page.locator(FRAME)).toBeVisible({ timeout: 20_000 });
  expect(await bg()).toBe('rgb(26, 27, 30)');

  await page.unrouteAll();
  await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html', {
    transform: (html) => html.replace('data-locale="ru"', 'data-locale="ru" data-theme="light"'),
  });
  await expect(page.locator(FRAME)).toBeVisible({ timeout: 20_000 });
  expect(await bg()).toBe('rgb(255, 255, 255)');
});

test('two containers size independently', async ({ page }) => {
  await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html', {
    transform: (html) =>
      html.replace(
        '<script async',
        `<div data-digest-widget data-project="hht-research" data-partner="e2e-partner" data-items="1"><p>second fallback</p></div><script async`,
      ),
  });
  await expect(page.locator('[data-digest-widget] iframe')).toHaveCount(2);
  await expect(page.locator('[data-digest-widget] iframe').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('[data-digest-widget] iframe').nth(1)).toBeVisible({ timeout: 20_000 });
  const heights = await page
    .locator('[data-digest-widget] iframe')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(heights[0]).toBeGreaterThan(heights[1]);
});

test('plain frame snippet keeps its fixed height and scrolls inside', async ({ page }) => {
  await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host-iframe.html');
  const frameEl = page.locator('iframe');
  await expect(page.frameLocator('iframe').locator('footer')).toBeVisible({ timeout: 20_000 });
  expect(Math.round((await frameEl.boundingBox())!.height)).toBe(900);
});

test.describe('failure modes keep the partner fallback', () => {
  test.setTimeout(40_000);

  async function expectFallbackAfterTimeout(page: Page) {
    await page.waitForTimeout(10_500);
    await expect(page.locator(FALLBACK)).toBeVisible();
    await expect(page.locator('[data-digest-widget] iframe')).toHaveCount(0);
  }

  test('embed page unreachable', async ({ page }) => {
    await page.route('**/embed/ru/**', (route) => route.abort());
    await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html');
    await expectFallbackAfterTimeout(page);
  });

  test('loader script unreachable', async ({ page }) => {
    await page.route('**/embed/v1.js', (route) => route.abort());
    await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html');
    await page.waitForTimeout(1_000);
    await expect(page.locator(FALLBACK)).toBeVisible();
    await expect(page.locator('[data-digest-widget] iframe')).toHaveCount(0);
  });

  test('unknown partner', async ({ page }) => {
    await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html', {
      transform: (html) => html.replace('e2e-partner', 'no-such-partner'),
    });
    await expectFallbackAfterTimeout(page);
  });

  test('origin not in the allow-list', async ({ page }) => {
    await servePartnerHost(page, BLOCKED_ORIGIN, 'partner-host.html');
    await expectFallbackAfterTimeout(page);
  });

  test('a ready that arrives after the timeout is ignored', async ({ page }) => {
    await page.route('**/embed/ru/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 11_000));
      await route.continue().catch(() => undefined);
    });
    await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html');
    await page.waitForTimeout(12_500);
    await expect(page.locator(FALLBACK)).toBeVisible();
    await expect(page.locator('[data-digest-widget] iframe')).toHaveCount(0);
  });
});

test('a message from the host page itself does not move the frame (FR-013)', async ({ page }) => {
  await servePartnerHost(page, ALLOWED_ORIGIN, 'partner-host.html');
  await expect(page.locator(FRAME)).toBeVisible({ timeout: 20_000 });
  const before = (await frameHeights(page)).outer;
  await page.evaluate(() => postMessage({ type: 'digest-widget:size', v: 1, height: 5000 }, '*'));
  await page.waitForTimeout(300);
  expect((await frameHeights(page)).outer).toBe(before);
});
