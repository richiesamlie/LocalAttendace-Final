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

  test('should render slot with empty lesson as placeholder', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Daily Timetable|Timetable/ }).click();
    await expect(page.getByRole('heading', { name: /Timetable|Schedule/i })).toBeVisible({ timeout: 15000 });
    // The seeded tt3 slot has subject "Science" and empty lesson
    const scienceSlot = page.locator('text=Science').first();
    await expect(scienceSlot).toBeVisible({ timeout: 10000 });
    // The lesson input/textarea should show placeholder text (not crash)
    const lessonField = scienceSlot.locator('..').locator('input[placeholder*="lesson"], textarea[placeholder*="lesson"], input[placeholder*="topic"], textarea[placeholder*="topic"]').first();
    await expect(lessonField).toBeVisible({ timeout: 5000 });
  });
});
