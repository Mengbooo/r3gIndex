import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4322',
    viewport: { width: 1342, height: 1344 },
    trace: 'retain-on-failure',
    launchOptions: {
      ...(existsSync(localChrome) ? { executablePath: localChrome } : {}),
      args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run preview -- --port 4322 --ignore-lock',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: !process.env.CI,
  },
});
