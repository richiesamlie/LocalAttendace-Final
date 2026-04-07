import { test, expect } from '@playwright/test';

test.describe('Schedule', () => {
  test('should display calendar page', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Calendar Events|Schedule/ }).click();
    await expect(page.getByRole('heading', { name: /Calendar|Schedule/i })).toBeVisible({ timeout: 15000 });
  });

  test('should display month navigation', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Calendar Events|Schedule/ }).click();
    await page.waitForSelector('text=Calendar', { timeout: 10000 });
    await expect(page.locator('input[type="month"]')).toBeVisible({ timeout: 10000 });
  });
});
