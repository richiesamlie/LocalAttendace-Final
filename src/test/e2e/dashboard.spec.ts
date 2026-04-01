import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should show dashboard after login', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('teacher123');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/Good (Morning|Afternoon|Evening)/)).toBeVisible({ timeout: 10000 });
  });
});