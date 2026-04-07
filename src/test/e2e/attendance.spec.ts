import { test, expect } from '@playwright/test';

test('Take Attendance - page loads', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'Take Attendance' }).click();
  await expect(page.locator('h1, h2', { hasText: 'Take Attendance' })).toBeVisible({ timeout: 15000 });
});

test('Take Attendance - toggle tabs', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'Take Attendance' }).click();
  await expect(page.locator('h1, h2', { hasText: 'Take Attendance' })).toBeVisible({ timeout: 10000 });
  // Toggle to Past Data if available
  await page.locator('button', { hasText: "Today's Attendance" }).waitFor({ timeout: 5000 });
  const pastDataBtn = page.locator('button', { hasText: 'Past Data' });
  if (await pastDataBtn.isVisible()) {
    await pastDataBtn.click();
    await expect(page.locator('input[type="date"]')).toBeVisible({ timeout: 5000 });
  }
});
