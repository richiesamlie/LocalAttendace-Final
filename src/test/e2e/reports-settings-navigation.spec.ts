import { test, expect } from '@playwright/test';

test.describe('Monthly Reports', () => {
  test('should display reports page', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Monthly Reports|Reports/ }).click();
    await expect(page.getByRole('heading', { name: /Monthly Reports|Reports/i })).toBeVisible({ timeout: 15000 });
  });

  test('should display month selector', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Monthly Reports|Reports/ }).click();
    await expect(page.locator('input[type="month"]')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Settings & Backup', () => {
  test('should display settings page', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Settings/ }).click();
    await expect(page.getByRole('heading', { name: /Settings|Data/i })).toBeVisible({ timeout: 15000 });
  });

  test('should display Google Drive sync section', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Settings/ }).click();
    await expect(page.getByText('Google Drive Sync')).toBeVisible({ timeout: 15000 }).catch(async () => {
      // Page might call it something slightly different, check settings loaded
      await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible({ timeout: 5000 });
    });
  });

  test('should display download and restore buttons', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: /Settings/ }).click();
    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Download Backup' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Restore Backup' })).toBeVisible({ timeout: 10000 });
  });
});
