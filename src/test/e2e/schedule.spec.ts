import { test, expect } from '@playwright/test';

test.describe('Calendar Events', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('teacher123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
  });

  test('should display calendar page', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Calendar Events' }).click();
    await expect(page.getByRole('heading', { name: 'Class Schedule' })).toBeVisible();
  });

  test('should display month navigation', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Calendar Events' }).click();
    await expect(page.locator('input[type="month"]')).toBeVisible();
  });
});