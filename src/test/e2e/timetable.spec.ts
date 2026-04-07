import { test, expect } from '@playwright/test';

test.describe('Timetable', () => {
  test('should display timetable page', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Daily Timetable|Timetable/ }).click();
    await expect(page.getByRole('heading', { name: /Timetable|Schedule/i })).toBeVisible({ timeout: 15000 });
  });

  test('should open add class form', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Daily Timetable|Timetable/ }).click();
    await expect(page.getByRole('heading', { name: /Timetable|Schedule/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Add Class' }).click();
    await expect(page.getByText('Add Class for')).toBeVisible({ timeout: 10000 });
  });
});
