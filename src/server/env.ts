import { z } from 'zod';
import * as dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

/**
 * Known example/placeholder secrets that must NOT be used in production.
 */
export const KNOWN_EXAMPLE_SECRETS = new Set([
  'zupit_super_secret_jwt_key_jamui_bihar_2026_secure',
  'zupit_secret_key_change_in_production_jamui_hub_2026',
  'zupit_dev_delivery_code_secret_jamui_2026_min32chars',
  'change_me_in_production_jwt_secret_32chars',
  'change_me_in_production_delivery_secret_32chars',
  'example_jwt_secret_must_be_changed_at_least_32_chars',
  'example_delivery_code_secret_at_least_32_chars',
  'replace_with_a_secure_random_secret_min_32_chars',
  'your_super_secret_jwt_key_change_in_production',
  'your_super_secret_delivery_code_key_change_in_production',
  '12345678901234567890123456789012',
  'abcdefghijklmnopqrstuvwxyz123456',
]);

export function isExampleSecret(secret: string): boolean {
  if (KNOWN_EXAMPLE_SECRETS.has(secret)) {
    return true;
  }
  const lower = secret.toLowerCase();
  return (
    lower.includes('change_me') ||
    lower.includes('your_secret') ||
    lower.includes('replace_with') ||
    lower.startsWith('example_')
  );
}

/**
 * Zod schema for environment variables
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3002),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required and cannot be empty'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required and cannot be empty'),
  DELIVERY_CODE_SECRET: z.string().min(1, 'DELIVERY_CODE_SECRET is required and cannot be empty'),
  SMS_PROVIDER: z.enum(['mock', 'msg91']).default('mock'),
  ALLOW_MOCK_SMS: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_OTP_TEMPLATE_ID: z.string().optional(),
  MSG91_SENDER_ID: z.string().default('ZUPITM'),
  ADMIN_EMAIL: z.string().email().optional().default('admin@zupit.in'),
  ADMIN_NAME: z.string().optional().default('Jamui Hub Owner'),
  ADMIN_PHONE: z.string().optional().default('6207856200'),
  ADMIN_PASSWORD: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return process.env.NODE_ENV === 'production';
      return val === 'true';
    }),
  PUBLIC_URL: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional().default('zupit-private'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and enforces production guards.
 * Returns validated env object or exits process if validation fails.
 */
export function validateEnv(rawEnv: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.passthrough().safeParse(rawEnv);

  if (!result.success) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ ENVIRONMENT CONFIGURATION ERROR:');
    console.error('   The application failed to start because required environment variables');
    console.error('   are missing or invalid:\n');
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      console.error(`   • ${key}: ${issue.message}`);
    }
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }

  const env = result.data;
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) {
    const securityErrors: string[] = [];

    // Production guard 1: JWT_SECRET length >= 32 and not an example value
    if (env.JWT_SECRET.length < 32) {
      securityErrors.push(
        `JWT_SECRET is too short (${env.JWT_SECRET.length} characters). Production requires >= 32 characters.`
      );
    }
    if (isExampleSecret(env.JWT_SECRET)) {
      securityErrors.push(
        'JWT_SECRET matches a known example or default template value. Set a strong random secret (e.g. openssl rand -hex 32).'
      );
    }

    // Production guard 2: DELIVERY_CODE_SECRET length >= 32 and not an example value
    if (env.DELIVERY_CODE_SECRET.length < 32) {
      securityErrors.push(
        `DELIVERY_CODE_SECRET is too short (${env.DELIVERY_CODE_SECRET.length} characters). Production requires >= 32 characters.`
      );
    }
    if (isExampleSecret(env.DELIVERY_CODE_SECRET)) {
      securityErrors.push(
        'DELIVERY_CODE_SECRET matches a known example or default template value. Set a strong random secret (e.g. openssl rand -hex 32).'
      );
    }

    if (securityErrors.length > 0) {
      console.error('\n' + '='.repeat(70));
      console.error('❌ PRODUCTION SECURITY GUARD: Refusing to start');
      securityErrors.forEach((err) => console.error(`   • ${err}`));
      console.error('='.repeat(70) + '\n');
      process.exit(1);
    }

    // SMS guard: refuse to start in production with SMS_PROVIDER=mock unless ALLOW_MOCK_SMS=true
    if (env.SMS_PROVIDER === 'mock') {
      if (!env.ALLOW_MOCK_SMS) {
        console.error('\n' + '='.repeat(70));
        console.error('❌ PRODUCTION SMS GUARD: Refusing to start');
        console.error("   SMS_PROVIDER is set to 'mock' in production, but ALLOW_MOCK_SMS=true is not set.");
        console.error("   In production, set SMS_PROVIDER=msg91 with MSG91_AUTH_KEY, or explicitly set");
        console.error("   ALLOW_MOCK_SMS=true if operating in a pilot fallback environment.");
        console.error('='.repeat(70) + '\n');
        process.exit(1);
      } else {
        console.warn('\n' + '!'.repeat(70));
        console.warn('⚠️  LOUD WARNING: PRODUCTION PILOT FALLBACK ACTIVE (ALLOW_MOCK_SMS=true)!');
        console.warn('⚠️  SMS_PROVIDER is set to mock.');
        console.warn('⚠️  All customer & rider OTPs will be printed directly to container logs (stdout).');
        console.warn('⚠️  Ensure container logs are kept strictly confidential.');
        console.warn('!'.repeat(70) + '\n');
      }
    }
  }

  return env;
}

// Automatically validate on module import unless running in unit test isolation
export const env = validateEnv();
