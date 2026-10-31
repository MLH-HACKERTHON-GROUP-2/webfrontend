import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 60000, expect: { timeout: 10000 },
  fullyParallel: false, workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  webServer: [
    { command: 'npm start', url: 'http://127.0.0.1:3000', reuseExistingServer: true, timeout: 30000, stdout: 'ignore', stderr: 'ignore' },
    { command: 'npm run mock:backend', url: 'http://127.0.0.1:4000/graphql', reuseExistingServer: true, timeout: 30000, stdout: 'ignore', stderr: 'ignore' },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
