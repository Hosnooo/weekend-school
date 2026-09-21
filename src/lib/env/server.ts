import {z} from 'zod';

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1)
});
const emailEnvSchema=z.object({RESEND_API_KEY:z.string().trim().min(1),EMAIL_FROM:z.string().trim().min(3)});

type ServerEnvironment = Record<string, string | undefined>;

const runtimeServerEnvironment = (): ServerEnvironment => ({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
});

export function getServerEnv(environment: ServerEnvironment = runtimeServerEnvironment()) {
  const parsed = serverEnvSchema.parse(environment);
  return {
    supabaseUrl: parsed.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY
  };
}

export function getEmailEnv(environment:ServerEnvironment={RESEND_API_KEY:process.env.RESEND_API_KEY,EMAIL_FROM:process.env.EMAIL_FROM}){const parsed=emailEnvSchema.parse(environment);return{resendApiKey:parsed.RESEND_API_KEY,emailFrom:parsed.EMAIL_FROM};}
