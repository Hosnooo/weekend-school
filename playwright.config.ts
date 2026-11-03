import {defineConfig} from '@playwright/test';

const useExternalServer = process.env.E2E_EXTERNAL_SERVER === 'true';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl)) {
  throw new Error('End-to-end tests require a local Supabase URL. Refusing to run against a hosted project.');
}

export default defineConfig({
  testDir: './tests/e2e',
  // Recovery verification has its own isolated credentials, URL, and invocation.
  // It must not be collected by the ordinary local/CI browser suite.
  testIgnore: ['**/report-production-recovery.local.spec.ts'],
  timeout: 180_000,
  expect: {timeout: 60_000},
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Report the complete set of browser regressions in CI, so a release
  // can be validated in one pass. Opt in to fail-fast only for local triage.
  maxFailures: process.env.E2E_FAIL_FAST === 'true' ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    actionTimeout: 60_000,
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
