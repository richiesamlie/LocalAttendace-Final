import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('teacher123');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/Good (Morning|Afternoon|Evening)/)).toBeVisible({ timeout: 10000 });
  });

  test('should show error with wrong password', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Invalid username or password')).toBeVisible();
  });
});