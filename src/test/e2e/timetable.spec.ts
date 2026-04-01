import { test, expect } from '@playwright/test';

test.describe('Timetable', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('teacher123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
  });

  test('should display timetable page', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Daily Timetable' }).click();
    await expect(page.getByRole('heading', { name: 'Daily Class Schedule' })).toBeVisible();
  });

  test('should open add class form', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Daily Timetable' }).click();
    await page.getByRole('button', { name: 'Add Class' }).click();
    await expect(page.getByText('Add Class for')).toBeVisible();
  });
});