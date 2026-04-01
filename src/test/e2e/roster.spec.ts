import { test, expect } from '@playwright/test';

test('Student Roster - page loads', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Teacher Assistant', { timeout: 10000 });
  
  // Navigate to Student Roster
  await page.locator('button', { hasText: 'Student Roster' }).click();
  await expect(page.locator('h1', { hasText: 'Student Roster' })).toBeVisible({ timeout: 5000 });
});

test('Student Roster - add student', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Teacher Assistant', { timeout: 10000 });
  
  await page.locator('button', { hasText: 'Student Roster' }).click();
  await page.locator('button', { hasText: 'Add Student' }).click();
  
  const uniqueName = 'RosterTest_' + Date.now();
  await page.fill('input[placeholder="Roll No"]', '1');
  await page.fill('input[placeholder="Student Name"]', uniqueName);
  await page.locator('button[title="Save"]').click();
  
  await expect(page.locator('span', { hasText: uniqueName })).toBeVisible({ timeout: 5000 });
});