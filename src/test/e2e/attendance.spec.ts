import { test, expect } from '@playwright/test';

test('Take Attendance - page loads', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Teacher Assistant', { timeout: 10000 });
  
  await page.locator('button', { hasText: 'Take Attendance' }).click();
  await expect(page.locator('h1', { hasText: 'Take Attendance' })).toBeVisible({ timeout: 5000 });
});

test('Take Attendance - toggle tabs', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Teacher Assistant', { timeout: 10000 });
  
  await page.locator('button', { hasText: 'Take Attendance' }).click();
  await expect(page.locator('button', { hasText: "Today's Attendance" })).toBeVisible();
  await page.locator('button', { hasText: 'Past Data' }).click();
  await expect(page.locator('input[type="date"]')).toBeVisible();
});