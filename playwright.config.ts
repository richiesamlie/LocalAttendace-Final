import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 30000,
  globalSetup: './src/test/e2e/globalSetup.ts',
  projects: [
    // Setup project: log in once and save auth state
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // All tests use the authenticated state from setup
    {
      name: 'chromium',
      use: {
        baseURL: 'http://127.0.0.1:3000',
        trace: 'on-first-retry',
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});