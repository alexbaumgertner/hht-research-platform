import type { Config } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

const config: Config = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // CI runs against a production build (`next start`, needs a prior
    // `pnpm --filter @hht/web build`); locally use the dev server.
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    // Playwright only treats 2xx/3xx as ready — `/` returns 404 (locale
    // segment required), so probe a real locale route instead.
    url: `${baseURL}/en`,
    // Issue-text translation never reaches the LLM gateway from e2e; the stub also
    // enables `/api/test/issue-translations` for the single-flight spec.
    env: {
      ISSUE_TRANSLATOR: 'stub',
      ISSUE_TRANSLATOR_STUB_DELAY_MS: '0',
      EMAIL_DELIVERY: 'stub',
      RESEND_API_KEY: 'test-key',
      RESEND_FROM_EMAIL: 'news@example.com',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

export default config;
