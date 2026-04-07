import { test, expect } from '@playwright/test';

test('Authentication - login works correctly', async ({ page }) => {
  // Start from login page (tests that auth state was saved properly)
  await page.goto('/');
  // Should be on dashboard since storageState provides auth
  await page.waitForSelector('text=Teacher Assistant', { timeout: 15000 });
  await expect(page.getByText(/Good (Morning|Afternoon|Evening)/)).toBeVisible({ timeout: 5000 });
});
