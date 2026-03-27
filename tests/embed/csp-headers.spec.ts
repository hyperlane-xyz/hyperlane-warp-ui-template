// spec: CSP and Security Headers
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('CSP and Security Headers', () => {
  test('embed route should not have X-Frame-Options header', async ({ page }) => {
    // Navigate to http://localhost:3000/embed and capture the response
    const response = await page.goto('http://localhost:3000/embed');

    // Get the response headers and verify X-Frame-Options is NOT present
    const headers = response!.headers();
    expect(headers['x-frame-options']).toBeUndefined();
  });

  test('embed route CSP should have frame-ancestors *', async ({ page }) => {
    // Navigate to http://localhost:3000/embed and capture the response
    const response = await page.goto('http://localhost:3000/embed');

    // Get the Content-Security-Policy header value
    const headers = response!.headers();
    const csp = headers['content-security-policy'];

    // Verify it contains 'frame-ancestors *'
    expect(csp).toContain('frame-ancestors *');

    // Verify it does NOT contain "frame-ancestors 'none'"
    expect(csp).not.toContain("frame-ancestors 'none'");
  });

  test('main route should have X-Frame-Options DENY', async ({ page }) => {
    // Navigate to http://localhost:3000/ and capture the response
    const response = await page.goto('http://localhost:3000/');

    // Get the X-Frame-Options header and verify it equals 'DENY'
    const headers = response!.headers();
    expect(headers['x-frame-options']).toBe('DENY');
  });

  test('main route CSP should have frame-ancestors none', async ({ page }) => {
    // Navigate to http://localhost:3000/ and capture the response
    const response = await page.goto('http://localhost:3000/');

    // Get Content-Security-Policy header and verify it contains "frame-ancestors 'none'"
    const headers = response!.headers();
    const csp = headers['content-security-policy'];
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
