import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login screen when unauthenticated', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Check that we see the Teacher Assistant login header
    await expect(page.locator('h1', { hasText: 'Teacher Assistant' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Log In' })).toBeVisible();
    await expect(page.locator('text=Sign in to manage your classes')).toBeVisible();
  });

  test('should login successfully with correct password', async ({ page }) => {
    await page.goto('/');
    
    // Fill in the admin password (this uses the default injected in db.ts)
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    
    // After login, we should see the dashboard loading or main layout
    // We can verify this by waiting for the Settings/Admin nav items to appear
    await expect(page.getByRole('button', { name: "Settings & Backup" })).toBeVisible({ timeout: 10000 });
  });

  test('should show error with incorrect password', async ({ page }) => {
    await page.goto('/');
    
    await page.locator('input[type="password"]').fill('wrongpassword123');
    await page.locator('button[type="submit"]').click();
    
    // Expect the error message to render
    await expect(page.locator('text=Invalid password')).toBeVisible();
  });
});
