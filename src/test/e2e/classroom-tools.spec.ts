import { test, expect } from '@playwright/test';

test('Random Picker - page loads', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'Classroom Tools' }).first().click();
  await page.locator('button', { hasText: 'Random Picker' }).click();
  await expect(page.locator('h1, h2', { hasText: /Random.*Picker/i })).toBeVisible({ timeout: 15000 });
});

test('Exam Timer - page loads', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'Classroom Tools' }).first().click();
  await page.locator('button', { hasText: 'Exam Timer' }).click();
  await expect(page.locator('h1, h2', { hasText: /Exam.*Timer|Timer/i })).toBeVisible({ timeout: 15000 });
});

test('Visual Seating - page loads', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'Classroom Tools' }).first().click();
  await page.locator('button', { hasText: 'Visual Seating' }).click();
  await expect(page.locator('h1, h2', { hasText: /Seating.*Chart|Seating/i })).toBeVisible({ timeout: 15000 });
});

test('Smart Groups - page loads', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'Classroom Tools' }).first().click();
  await page.locator('button', { hasText: 'Smart Groups' }).click();
  await expect(page.locator('h1, h2', { hasText: /Smart.*Group|Group.*Generator/i })).toBeVisible({ timeout: 15000 });
});
