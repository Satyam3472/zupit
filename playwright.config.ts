import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3003',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'E2E Journeys',
      use: {
        baseURL: 'http://localhost:3003',
      },
    },
  ],
  webServer: {
    command: 'PORT=3003 DATABASE_URL=postgres://postgres:postgres@localhost:5432/zupit_test tsx src/server/server.ts',
    url: 'http://localhost:3003/api/v1/public/config',
    reuseExistingServer: false,
    timeout: 30000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
