import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(process.cwd(), 'playwright/.auth/user.json');

/**
 * Login once, save auth state to a JSON file, then reuse it across all tests.
 * Run with: npx playwright test auth.setup.ts --project=setup
 * Or: npx playwright test (it's configured as a dependency)
 */
setup('authenticate', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="text"]').fill('admin');
  await page.locator('input[type="password"]').fill('teacher123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('http://127.0.0.1:3000/**', { timeout: 15000 });
  // Wait until dashboard content is visible (good enough signal)
  await page.waitForSelector('text=Teacher Assistant', { timeout: 10000 });

  // Save auth state (cookies, localStorage) so subsequent tests skip login
  await page.context().storageState({ path: authFile });
});
