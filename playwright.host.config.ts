import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/host-integration',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec next dev -p 3000',
      url: 'http://localhost:3000/embed',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_WALLET_CONNECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || 'test',
      },
    },
    {
      command: 'pnpm --dir examples/next-vanilla-host exec next dev -p 3100',
      url: 'http://localhost:3100',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_WIDGET_URL: process.env.NEXT_PUBLIC_WIDGET_URL || 'http://localhost:3000/embed',
      },
    },
  ],
});
