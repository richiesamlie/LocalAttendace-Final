import { test, expect } from '@playwright/test';

test('Student Roster - page loads', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'Student Roster' }).click();
  await expect(page.locator('h1, h2', { hasText: /Student Roster|Roster/ })).toBeVisible({ timeout: 15000 });
});

test('Student Roster - adds a student', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'Student Roster' }).click();
  await page.locator('button', { hasText: 'Add Student' }).click();
  
  const uniqueName = 'RosterTest_' + Date.now();
  await page.fill('input[placeholder*="Roll"], input[id*="roll"]', '99');
  await page.fill('input[placeholder*="Name"], input[id*="name"]', uniqueName);
  await page.locator('button[title="Save"]').click();
  
  await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10000 });
});
