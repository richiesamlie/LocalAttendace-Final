import { test, expect } from '@playwright/test';

test.describe('Monthly Reports', () => {
  test('should display reports page', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('teacher123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await page.getByRole('navigation').getByRole('button', { name: 'Monthly Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Monthly Reports' })).toBeVisible();
  });

  test('should display month selector', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('teacher123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await page.getByRole('navigation').getByRole('button', { name: 'Monthly Reports' }).click();
    await expect(page.locator('input[type="month"]')).toBeVisible();
  });
});

test.describe('Settings & Backup', () => {
  test('should display settings page', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('teacher123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await page.getByRole('navigation').getByRole('button', { name: 'Settings & Backup' }).click();
    await expect(page.getByRole('heading', { name: 'Settings & Data Management' })).toBeVisible();
  });

  test('should display Google Drive sync section', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('teacher123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await page.getByRole('navigation').getByRole('button', { name: 'Settings & Backup' }).click();
    await expect(page.getByText('Google Drive Sync')).toBeVisible();
  });

  test('should display download and restore buttons', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('teacher123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await page.getByRole('navigation').getByRole('button', { name: 'Settings & Backup' }).click();
    await expect(page.getByRole('button', { name: 'Download Backup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore Backup' })).toBeVisible();
  });
});