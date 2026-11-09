import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests, against the app served the way it runs every day (nginx in Docker, port 3000)
 * with the real back-end behind it. See README, "Testes ponta a ponta".
 *
 *   E2E_BASE_URL   where the app is (default http://localhost:3000)
 *   CHROME_PATH    a Chrome/Chromium to use instead of the one `npx playwright install` downloads
 */
export default defineConfig({
  testDir: './e2e',
  // One database, shared: the specs create their own data (unique names) and run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // The app's clock is Brasília; the browser's must be too, whatever machine runs the test.
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.CHROME_PATH || undefined },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
})
