import {defineConfig} from '@playwright/test';

const localSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const localAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const privateCredentialFile = process.env.REPORT_RECOVERY_CREDENTIAL_FILE ?? '';

if (localSupabaseUrl !== 'http://127.0.0.1:56421' ||
    !localAnonKey || !localServiceRoleKey || !privateCredentialFile) {
  throw new Error('Refusing report-recovery browser test without isolated local Supabase and credentials');
}
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/report-production-recovery.local.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: {timeout: 45_000},
  reporter: [['list']],
  outputDir: process.env.REPORT_RECOVERY_ARTIFACT_DIR,
  use: {
    baseURL: 'http://127.0.0.1:56530',
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  },
  webServer: {
    command: 'pnpm exec next dev --hostname 127.0.0.1 --port 56530',
    url: 'http://127.0.0.1:56530/en/login',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: localSupabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: localAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey,
      BREVO_API_KEY: '',
      EMAIL_FROM: '',
      NEXT_TELEMETRY_DISABLED: '1'
    }
  }
});
