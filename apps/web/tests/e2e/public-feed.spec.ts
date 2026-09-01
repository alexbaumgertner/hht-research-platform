import { test, expect } from '@playwright/test';

test.describe('public materials feed', () => {
  test('flat feed: order, badges, high importance, outbound title links', async ({ page }) => {
    await page.goto('/en/projects/hht-research');

    const notFound = page.getByText(/Not found/i);
    if (await notFound.isVisible().catch(() => false)) {
      test.skip(true, 'Seed data required for public materials feed');
      return;
    }

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // No digest headings / no add-edit-delete controls
    await expect(page.getByRole('button', { name: /add|edit|delete|create/i })).toHaveCount(0);

    // Source badges (five categories)
    for (const label of [/PubMed/i, /Clinical trials/i, /News/i, /Guideline/i, /Social/i]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }

    // High-importance treatment (text label, not colour alone)
    await expect(page.getByText(/High importance/i).first()).toBeVisible();

    // Title links go to the on-site detail page (same tab)
    const titleLink = page.locator('article a[href*="/publications/"]').first();
    await expect(titleLink).toBeVisible();
    await expect(titleLink).not.toHaveAttribute('target', '_blank');
    await expect(page.locator('article a[target="_blank"]')).toHaveCount(0);
    await expect(page.getByText(/opens in a new tab/i)).toHaveCount(0);
  });

  test('filters: search, chips, importance, combined, clear', async ({ page }) => {
    await page.goto('/en/projects/hht-research');
    if (
      await page
        .getByText(/Not found/i)
        .isVisible()
        .catch(() => false)
    ) {
      test.skip(true, 'Seed data required');
      return;
    }

    const search = page.getByLabel(/Search materials/i);
    await search.fill('Bevacizumab');
    await expect(page.getByText(/Bevacizumab/i).first()).toBeVisible();

    // Deselect-all chips still shows all (empty selection = all) — select pubmed only first
    const pubmedChip = page.getByRole('checkbox', { name: /PubMed/i });
    if (await pubmedChip.isVisible().catch(() => false)) {
      await pubmedChip.click();
    }

    // Mantine Switch keeps the native input visually hidden — click the label.
    await page
      .locator('label')
      .filter({ hasText: /High importance only/i })
      .click();

    await expect(page.getByText(/\d+ material/i)).toBeVisible();

    // Over-filter to force no-matches
    await search.fill('zzzz-no-such-material');
    await expect(page.getByText(/No materials match your filters/i)).toBeVisible();
    await page.getByRole('button', { name: /Clear filters/i }).click();
    await expect(page.getByLabel(/Search materials/i)).toHaveValue('');
  });

  test('locale switch preserves filter query and shows fallback note', async ({ page }) => {
    await page.goto('/en/projects/hht-research?q=HHT&important=1');
    if (
      await page
        .getByText(/Not found/i)
        .isVisible()
        .catch(() => false)
    ) {
      test.skip(true, 'Seed data required');
      return;
    }

    const lang = page.getByRole('textbox', { name: /Language/i });
    await lang.click();
    await page.getByRole('option', { name: /Deutsch/i }).click();

    await expect(page).toHaveURL(/\/de\/projects\/hht-research/);
    await expect(page).toHaveURL(/q=HHT/);
    await expect(page).toHaveURL(/important=1/);

    // Untranslated materials show fallback note
    await expect(page.getByText(/Auf Englisch angezeigt|Shown in English/i).first()).toBeVisible();
  });
});
