import { test, expect } from '@playwright/test';

test('Classroom Tools - Random Picker page', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Teacher Assistant', { timeout: 10000 });
  
  await page.locator('button', { hasText: 'Classroom Tools' }).first().click();
  await page.locator('button', { hasText: 'Random Picker' }).click();
  await expect(page.locator('h1', { hasText: 'Random Student Picker' })).toBeVisible({ timeout: 5000 });
});

test('Classroom Tools - Exam Timer page', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Teacher Assistant', { timeout: 10000 });
  
  await page.locator('button', { hasText: 'Classroom Tools' }).first().click();
  await page.locator('button', { hasText: 'Exam Timer' }).click();
  await expect(page.locator('h1', { hasText: 'Exam Timer' })).toBeVisible({ timeout: 5000 });
});

test('Classroom Tools - Visual Seating page', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Teacher Assistant', { timeout: 10000 });
  
  await page.locator('button', { hasText: 'Classroom Tools' }).first().click();
  await page.locator('button', { hasText: 'Visual Seating' }).click();
  await expect(page.locator('h1', { hasText: 'Visual Seating Chart' })).toBeVisible({ timeout: 5000 });
});

test('Classroom Tools - Smart Groups page', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Teacher Assistant', { timeout: 10000 });
  
  await page.locator('button', { hasText: 'Classroom Tools' }).first().click();
  await page.locator('button', { hasText: 'Smart Groups' }).click();
  await expect(page.locator('h1', { hasText: 'Smart Group Generator' })).toBeVisible({ timeout: 5000 });
});