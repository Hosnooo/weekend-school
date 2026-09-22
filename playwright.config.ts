import {defineConfig} from '@playwright/test';

const useExternalServer = process.env.E2E_EXTERNAL_SERVER === 'true';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl)) {
  throw new Error('End-to-end tests require a local Supabase URL. Refusing to run against a hosted project.');
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 240_000,
  expect: {timeout: 30_000},
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: {width: 1280, height: 800}
  },
  webServer: useExternalServer ? undefined : {
    command: 'pnpm dev',
    url: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
