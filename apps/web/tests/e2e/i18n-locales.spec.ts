import { test, expect } from '@playwright/test';

import {
  PATIENT_CHROME,
  PATIENT_COPY_LOCALES,
  collectChromeStrings,
  findBannedChromeTerms,
  loadLocaleMessages,
} from './patient-facing-copy';

const PROJECT_SLUG = 'hht-research';

test.describe('i18n locales', () => {
  for (const locale of PATIENT_COPY_LOCALES) {
    test(`renders home chrome for ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Mantine Select exposes the control as a textbox with accessible name from label/aria-label
      await expect(
        page.getByRole('textbox', { name: /Language|Sprache|Dil|Язык|Мова/i }),
      ).toBeVisible();
    });

    test(`chrome messages for ${locale} avoid internal terminology`, () => {
      const messages = loadLocaleMessages(locale);
      const violations: string[] = [];

      for (const { key, value } of collectChromeStrings(messages)) {
        const banned = findBannedChromeTerms(value);
        if (banned.length > 0) {
          violations.push(`${key}: "${value}" matches ${banned.map((p) => p.source).join(', ')}`);
        }
      }

      expect(violations, `Banned terms in ${locale} chrome copy`).toEqual([]);
    });

    test(`patient-facing header and home copy for ${locale}`, async ({ page }) => {
      const chrome = PATIENT_CHROME[locale];
      await page.goto(`/${locale}`);

      await expect(page.getByRole('heading', { level: 3, name: chrome.siteName })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: chrome.homeTitle })).toBeVisible();
      await expect(page.getByText(chrome.homeSubtitle)).toBeVisible();

      const homeDescription = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(homeDescription).toBeTruthy();
      expect(findBannedChromeTerms(homeDescription!)).toEqual([]);
    });

    test(`project meta description for ${locale} avoids internal terminology`, async ({ page }) => {
      await page.goto(`/${locale}/projects/${PROJECT_SLUG}`);
      const notFound = page.getByText(/Not found/i);
      if (await notFound.isVisible().catch(() => false)) {
        test.skip(true, 'Seed data required for project chrome checks');
        return;
      }

      const projectDescription = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(projectDescription).toBeTruthy();
      expect(findBannedChromeTerms(projectDescription!)).toEqual([]);
    });
  }
});
