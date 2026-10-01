import { expect, test } from '@playwright/test';

const PROJECT = 'hht-research';

test.describe('subscriptions', () => {
  test('subscribe without JavaScript, then confirm from the stub', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    const issue = await page.request.get(
      `/api/public/projects/${PROJECT}/issues?limit=10&locale=en`,
    );
    if (!issue.ok()) {
      test.skip(true, 'Seed data required');
      return;
    }
    const body = (await issue.json()) as { docs: Array<{ id: string; excerpt: string | null }> };
    const issueId = body.docs.find((row) => row.excerpt)?.id;
    if (!issueId) {
      test.skip(true, 'Ready issue seed required');
      return;
    }

    const email = `reader.${Date.now()}@example.com`;
    await page.goto(`/ru/projects/${PROJECT}/issues/${issueId}?src=tg`);
    await expect(page.getByRole('radio', { name: 'Русский' })).toBeChecked();
    await page.getByLabel('Почта').fill(email);
    await page.getByRole('button', { name: 'Подписаться' }).click();
    await expect(page.getByText('Отметьте согласие')).toBeVisible();

    await page.getByLabel('Почта').fill(email);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Подписаться' }).click();
    await expect(page.getByText('Проверьте почту.')).toBeVisible();

    const stub = await page.request.get('/api/test/emails');
    expect(stub.ok()).toBeTruthy();
    const messages = (await stub.json()) as { messages: Array<{ to: string; text: string }> };
    const confirmation = messages.messages.find((message) => message.to === email);
    expect(confirmation?.text).toContain('/ru/subscribe/confirm/');
    const link = confirmation?.text.match(/https?:\/\/\S+\/ru\/subscribe\/confirm\/\S+/)?.[0];
    expect(link).toBeTruthy();
    await page.goto(link!);
    await expect(page.getByText('Адрес подтверждён')).toBeVisible();

    await page.goto(`/ru/projects/${PROJECT}/issues/${issueId}`);
    await page.getByLabel('Почта').fill(email);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Подписаться' }).click();
    await expect(page.getByText('Проверьте почту.')).toBeVisible();

    const listed = await page.request.get(`/api/test/subscribers?slug=${PROJECT}`);
    const subscribers = (await listed.json()) as {
      docs: Array<{ email: string; source: string; language: string; status: string }>;
    };
    const rows = subscribers.docs.filter((row) => row.email === email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: 'tg', language: 'ru', status: 'confirmed' });
    await context.close();
  });

  test('German page presets English and the privacy note is English', async ({ page }) => {
    await page.goto(`/de/projects/${PROJECT}`);
    const missing = page.getByText('Dieses Projekt wurde nicht gefunden');
    if (await missing.isVisible().catch(() => false)) {
      test.skip(true, 'Seed data required');
      return;
    }
    await expect(page.getByRole('radio', { name: 'Englisch' })).toBeChecked();
    await page.getByRole('link', { name: 'Datenschutz' }).click();
    await expect(page).toHaveURL(/\/de\/privacy/);
    await expect(page.getByRole('heading', { name: 'Datenschutz' })).toBeVisible();
    await expect(page.getByText('GDPR Article 9(2)(a)')).toBeVisible();
    await expect(page.getByText(/come only from news@example\.com/)).toBeVisible();
  });

  test('source from the issue page is kept on the project form', async ({ page }) => {
    const issue = await page.request.get(
      `/api/public/projects/${PROJECT}/issues?limit=10&locale=en`,
    );
    if (!issue.ok()) {
      test.skip(true, 'Seed data required');
      return;
    }
    const body = (await issue.json()) as { docs: Array<{ id: string; excerpt: string | null }> };
    const issueId = body.docs.find((row) => row.excerpt)?.id;
    if (!issueId) {
      test.skip(true, 'Ready issue seed required');
      return;
    }
    await page.goto(`/en/projects/${PROJECT}/issues/${issueId}?src=wa`);
    await page.getByRole('link', { name: 'Back to project' }).click();
    const email = `plus.${Date.now()}+hht@example.com`;
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByText('Check your inbox.')).toBeVisible();
    const listed = await page.request.get(`/api/test/subscribers?slug=${PROJECT}`);
    const subscribers = (await listed.json()) as { docs: Array<{ email: string; source: string }> };
    expect(subscribers.docs.find((row) => row.email === email.toLowerCase())?.source).toBe('wa');
  });

  test('unsubscribe GET does not change status and the button does', async ({ page }) => {
    const issue = await page.request.get(
      `/api/public/projects/${PROJECT}/issues?limit=10&locale=en`,
    );
    if (!issue.ok()) {
      test.skip(true, 'Seed data required');
      return;
    }
    const body = (await issue.json()) as { docs: Array<{ id: string; excerpt: string | null }> };
    const issueId = body.docs.find((row) => row.excerpt)?.id;
    if (!issueId) {
      test.skip(true, 'Ready issue seed required');
      return;
    }
    const email = `leave.${Date.now()}@example.com`;
    await page.goto(`/en/projects/${PROJECT}/issues/${issueId}`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Subscribe' }).click();
    const stub = await page.request.get('/api/test/emails');
    const messages = (await stub.json()) as { messages: Array<{ to: string; text: string }> };
    const confirmation = messages.messages.find((message) => message.to === email);
    const link = confirmation?.text.match(/https?:\/\/\S+\/en\/subscribe\/confirm\/\S+/)?.[0];
    expect(link).toBeTruthy();
    await page.goto(link!);
    const welcome = (
      (await (await page.request.get('/api/test/emails')).json()) as {
        messages: Array<{ to: string; text: string }>;
      }
    ).messages.filter((message) => message.to === email);
    const unsubscribe = welcome
      .map((message) => message.text.match(/https?:\/\/\S+\/en\/unsubscribe\/\S+/)?.[0])
      .find(Boolean);
    expect(unsubscribe).toBeTruthy();
    expect(unsubscribe).not.toContain('@');
    await page.goto(unsubscribe!);
    await expect(page.getByRole('button', { name: 'Unsubscribe' })).toBeVisible();
    const before = await page.request.get(`/api/test/subscribers?slug=${PROJECT}`);
    const beforeRows = (await before.json()) as { docs: Array<{ email: string; status: string }> };
    expect(beforeRows.docs.find((row) => row.email === email)?.status).toBe('confirmed');
    await page.getByRole('button', { name: 'Unsubscribe' }).click();
    await expect(page.getByText('You are unsubscribed.')).toBeVisible();
    await page.goto(unsubscribe!);
    await expect(page.getByText('You are not subscribed.')).toBeVisible();
  });

  test('mail links stay on PUBLIC_SITE_URL and issue mail supports one-click unsubscribe', async ({
    page,
    baseURL,
  }) => {
    const site = new URL(process.env.PUBLIC_SITE_URL || baseURL!).origin;
    const issue = await page.request.get(
      `/api/public/projects/${PROJECT}/issues?limit=10&locale=en`,
    );
    const body = issue.ok()
      ? ((await issue.json()) as { docs: Array<{ id: string; excerpt: string | null }> })
      : { docs: [] };
    const issueId = body.docs.find((row) => row.excerpt)?.id;
    test.skip(!issueId, 'Ready issue seed required');

    type Stubbed = {
      to: string;
      from: string;
      subject: string;
      text: string;
      html: string | null;
      headers: Record<string, string>;
    };
    const inbox = async (to: string) =>
      (
        (await (await page.request.get('/api/test/emails')).json()) as { messages: Stubbed[] }
      ).messages.filter((message) => message.to === to);
    const hosts = (message: Stubbed) =>
      new Set(
        [
          ...JSON.stringify([message.text, message.html, message.headers]).matchAll(
            /https?:\/\/[^/"\\\s<>]+/g,
          ),
        ].map((m) => m[0]),
      );

    const email = `oneclick.${Date.now()}@example.com`;
    await page.goto(`/en/projects/${PROJECT}/issues/${issueId}`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByText('Check your inbox.')).toBeVisible();

    const [confirmation] = await inbox(email);
    expect(confirmation).toBeDefined();
    expect(confirmation.from).toMatch(/<news@example\.com>$/);
    expect(confirmation.headers['List-Unsubscribe']).toBeUndefined();
    expect([...hosts(confirmation)]).toEqual([site]);

    const link = confirmation.text.match(/https?:\/\/\S+\/en\/subscribe\/confirm\/\S+/)?.[0];
    await page.goto(link!);
    const welcome = (await inbox(email)).find(
      (message) => message !== confirmation && message.headers['List-Unsubscribe'],
    );
    test.skip(!welcome, 'Welcome issue needs a ready issue from the last 14 days');

    expect(welcome!.from).toMatch(/<news@example\.com>$/);
    expect(welcome!.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(welcome!.text).toMatch(/\/en\/unsubscribe\//);
    expect(welcome!.html).toMatch(/\/en\/unsubscribe\//);
    expect([...hosts(welcome!)]).toEqual([site]);

    // RFC 8058: mailbox providers POST `List-Unsubscribe=One-Click` with no cookies or page.
    const oneClick = new URL(welcome!.headers['List-Unsubscribe'].replace(/^<|>$/g, ''));
    const res = await page.request.post(oneClick.pathname, {
      form: { 'List-Unsubscribe': 'One-Click' },
    });
    expect(res.status()).toBe(200);
    const listed = await page.request.get(`/api/test/subscribers?slug=${PROJECT}`);
    const rows = (await listed.json()) as { docs: Array<{ email: string; status: string }> };
    expect(rows.docs.find((row) => row.email === email)?.status).toBe('unsubscribed');
  });
});
