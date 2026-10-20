import { defineConfig, devices } from '@playwright/test'

const port = 8790
// The container ships a Chromium that may not match this Playwright version.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: executablePath ? { executablePath } : {},
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: `npx vite build && npx tsc -p tsconfig.server.json && node dist-server/server/main.js`,
    // One server and one client IP for the whole suite: lift the per-IP limits.
    env: { PORT: String(port), RATE_LIMIT_MULTIPLIER: '50' },
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
