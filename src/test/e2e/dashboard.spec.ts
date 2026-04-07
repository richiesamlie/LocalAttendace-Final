import { test, expect } from '@playwright/test';

test('Dashboard - shows dashboard content', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=Teacher Assistant', { timeout: 15000 });
  await expect(page.getByText(/Good (Morning|Afternoon|Evening)/)).toBeVisible({ timeout: 5000 });
});
