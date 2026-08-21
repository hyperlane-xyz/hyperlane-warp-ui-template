// spec: Theme Tests
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Theme Tests', () => {
  test('should apply default light theme CSS variables', async ({ page }) => {
    // Navigate to http://localhost:3000/embed
    await page.goto('http://localhost:3000/embed');

    // Wait for text "Send" to be visible
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Evaluate JS: getComputedStyle(document.body).getPropertyValue('--embed-accent').trim()
    const accent = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--embed-accent').trim(),
    );

    // Should equal '#9A0DFF' (case-insensitive)
    expect(accent.toLowerCase()).toBe('#9a0dff');
  });

  test('should apply custom accent color from URL param', async ({ page }) => {
    // Navigate to http://localhost:3000/embed?accent=3b82f6
    await page.goto('http://localhost:3000/embed?accent=3b82f6');

    // Wait for text "Send" to be visible
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Evaluate: getComputedStyle(document.body).getPropertyValue('--embed-accent').trim()
    const accent = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--embed-accent').trim(),
    );

    // Should equal '#3b82f6'
    expect(accent).toBe('#3b82f6');
  });

  test('should apply dark mode defaults', async ({ page }) => {
    // Navigate to http://localhost:3000/embed?mode=dark
    await page.goto('http://localhost:3000/embed?mode=dark');

    // Wait for text "Send" to be visible
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Evaluate: getComputedStyle(document.body).getPropertyValue('--embed-bg').trim()
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--embed-bg').trim(),
    );

    // Should equal '#1a1a2e'
    expect(bg).toBe('#1a1a2e');

    // Evaluate: getComputedStyle(document.body).getPropertyValue('--embed-text').trim()
    const text = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--embed-text').trim(),
    );

    // Should equal '#e0e0e0'
    expect(text).toBe('#e0e0e0');
  });

  test('should fall back to default for invalid hex param', async ({ page }) => {
    // Navigate to http://localhost:3000/embed?accent=not-a-color
    await page.goto('http://localhost:3000/embed?accent=not-a-color');

    // Wait for text "Send" to be visible
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Evaluate: getComputedStyle(document.body).getPropertyValue('--embed-accent').trim()
    const accent = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--embed-accent').trim(),
    );

    // Should equal '#9A0DFF' (the default, since 'not-a-color' fails hex validation)
    expect(accent.toLowerCase()).toBe('#9a0dff');
  });

  test('should apply custom error color', async ({ page }) => {
    // Navigate to http://localhost:3000/embed?error=ff6600
    await page.goto('http://localhost:3000/embed?error=ff6600');

    // Wait for text "Send" to be visible
    await page.getByText('Send').first().waitFor({ state: 'visible' });

    // Evaluate: getComputedStyle(document.body).getPropertyValue('--embed-error').trim()
    const error = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--embed-error').trim(),
    );

    // Should equal '#ff6600'
    expect(error).toBe('#ff6600');
  });
});
