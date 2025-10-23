import { z } from "zod";
import { logger } from '../bootstrap/logger.js';

// Environment configuration with Zod validation
export const envSchema = z
  .object({
  // Database
  DATABASE_URL: z.string().min(1),
  
  // Reddit API (optional for development)
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  REDDIT_REDIRECT_URI: z.string().optional(),
  
  // AI APIs (Gemini primary, OpenAI fallback)
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_TEXT_MODEL: z.string().default("models/gemini-2.5-flash"),
  GEMINI_VISION_MODEL: z.string().default("models/gemini-2.5-flash"),
  GEMINI_API_VERSION: z.string().default("v1"),
  
  // AWS S3 (optional for development)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  S3_BUCKET_MEDIA: z.string().optional(),
  S3_PUBLIC_CDN_DOMAIN: z.string().url().optional(),
  
  // Redis (Optional for Phase 5)
  REDIS_URL: z.string().optional(),

  // Remote log archival
  LOG_ARCHIVE_PROVIDER: z.enum(['s3', 'gcs']).optional(),
  LOG_ARCHIVE_BUCKET: z.string().optional(),
  LOG_ARCHIVE_PREFIX: z.string().optional(),
  LOG_ARCHIVE_KMS_KEY: z.string().optional(),
  LOG_ARCHIVE_STORAGE_CLASS: z.string().optional(),
  LOG_ARCHIVE_MAX_RETRIES: z.coerce.number().optional(),
  LOG_ARCHIVE_BACKOFF_MS: z.coerce.number().optional(),
  LOG_ARCHIVE_BACKOFF_MAX_MS: z.coerce.number().optional(),
  LOG_ARCHIVE_S3_ENDPOINT: z.string().optional(),
  LOG_ARCHIVE_S3_FORCE_PATH_STYLE: z.coerce.boolean().optional(),
  LOG_ARCHIVE_VERIFY_ON_START: z.coerce.boolean().optional(),
  
  // App Configuration
  APP_BASE_URL: z.string().optional(),
  CRON_TZ: z.string().default("America/Chicago"),
  
  // Billing - CCBill (optional for development)
  CCBILL_CLIENT_ACCOUNT: z.string().optional(),
  CCBILL_SUBACCOUNT: z.string().optional(),
  CCBILL_FLEXFORM_ID: z.string().optional(),
  CCBILL_SALT: z.string().optional(),
  
  // Stripe (required for production billing)
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Media Configuration (Phase 5: Updated quotas)
  PLAN_STORAGE_BYTES_FREE: z.coerce.number().default(2147483648), // 2GB
  PLAN_STORAGE_BYTES_STARTER: z.coerce.number().default(10737418240), // 10GB
  PLAN_STORAGE_BYTES_PRO: z.coerce.number().default(53687091200), // 50GB
  MEDIA_SIGNED_TTL_SECONDS: z.coerce.number().default(900), // 15 minutes
  WATERMARK_ENABLED: z.coerce.boolean().default(true),
  WATERMARK_TEXT: z.string().default("ThottoPilot"),
  WATERMARK_OPACITY: z.coerce.number().min(0).max(1).default(0.18),
  MEDIA_MAX_BYTES_FREE: z.coerce.number().default(524288000), // 500MB
  MEDIA_MAX_BYTES_PRO: z.coerce.number().default(10737418240), // 10GB
  
  // Queue Configuration (Phase 5)
  USE_PG_QUEUE: z.coerce.boolean().optional(),
  
  // Rate Limiting (Phase 5)
  MAX_POSTS_PER_SUBREDDIT_24H: z.coerce.number().default(10), // Loosened for testing
  
  // Daily Generation Limits by Tier
  DAILY_GENERATIONS_FREE: z.coerce.number().default(5),
  DAILY_GENERATIONS_STARTER: z.coerce.number().default(50),
  DAILY_GENERATIONS_PRO: z.coerce.number().default(-1), // -1 = unlimited
  
  // Payment Providers (Phase 5)
  SEGPAY_MERCHANT_ID: z.string().optional(),
  SEGPAY_API_KEY: z.string().optional(),
  EPOCH_MERCHANT_ID: z.string().optional(),
  EPOCH_API_KEY: z.string().optional(),
  PAXUM_API_KEY: z.string().optional(),
  COINBASE_COMMERCE_KEY: z.string().optional(),
  
  // Email Service
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  
  // Anti-Bot (Turnstile)
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  
  // Analytics
  ANALYTICS_WRITE_KEY: z.string().optional(),
  
  // UTM Configuration  
  UTM_COOKIE_TTL_DAYS: z.coerce.number().default(30),
  
  // Admin Configuration
  ADMIN_EMAIL_WHITELIST: z.string().optional()
  })
  .superRefine((configValues, ctx) => {
    if (process.env.NODE_ENV === 'production') {
      // Turnstile keys are optional - if one is provided, both are required
      if (configValues.TURNSTILE_SITE_KEY || configValues.TURNSTILE_SECRET_KEY) {
        if (!configValues.TURNSTILE_SITE_KEY) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['TURNSTILE_SITE_KEY'],
            message: 'TURNSTILE_SITE_KEY is required when Turnstile is enabled',
          });
        }

        if (!configValues.TURNSTILE_SECRET_KEY) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['TURNSTILE_SECRET_KEY'],
            message: 'TURNSTILE_SECRET_KEY is required when Turnstile is enabled',
          });
        }
      }
    }
  });

export function getEnvConfig() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    logger.error('Environment validation failed:', error);
    // Return a safe default configuration for development
    return {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || '',
      APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5000',
      UTM_COOKIE_TTL_DAYS: 30,
    } as Environment;
  }
}

export type Environment = z.infer<typeof envSchema>;

// Validate and export environment
let env: Environment;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (process.env.NODE_ENV === 'development') {
    logger.warn("⚠️ Development mode: Some enterprise features may be disabled");
    logger.warn("  To enable all features, configure these environment variables:");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        logger.warn(`    ${err.path.join('.')}: ${err.message}`);
      });
    }
    // Create minimal config for development
    env = {
      DATABASE_URL: process.env.DATABASE_URL || '',
      REDDIT_CLIENT_ID: '',
      REDDIT_CLIENT_SECRET: '',
      REDDIT_REDIRECT_URI: '',
      GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      GEMINI_TEXT_MODEL: process.env.GEMINI_TEXT_MODEL || 'models/gemini-2.5-flash',
      GEMINI_VISION_MODEL: process.env.GEMINI_VISION_MODEL || 'models/gemini-2.5-flash',
      GEMINI_API_VERSION: process.env.GEMINI_API_VERSION || 'v1',
      AWS_ACCESS_KEY_ID: '',
      AWS_SECRET_ACCESS_KEY: '',
      AWS_REGION: 'us-east-1',
      S3_BUCKET_MEDIA: '',
      S3_PUBLIC_CDN_DOMAIN: process.env.S3_PUBLIC_CDN_DOMAIN || undefined,
      REDIS_URL: process.env.REDIS_URL || undefined,
      LOG_ARCHIVE_PROVIDER: process.env.LOG_ARCHIVE_PROVIDER as 's3' | 'gcs' | undefined,
      LOG_ARCHIVE_BUCKET: process.env.LOG_ARCHIVE_BUCKET || undefined,
      LOG_ARCHIVE_PREFIX: process.env.LOG_ARCHIVE_PREFIX || undefined,
      LOG_ARCHIVE_KMS_KEY: process.env.LOG_ARCHIVE_KMS_KEY || undefined,
      LOG_ARCHIVE_STORAGE_CLASS: process.env.LOG_ARCHIVE_STORAGE_CLASS || undefined,
      LOG_ARCHIVE_MAX_RETRIES: process.env.LOG_ARCHIVE_MAX_RETRIES ? Number.parseInt(process.env.LOG_ARCHIVE_MAX_RETRIES, 10) : undefined,
      LOG_ARCHIVE_BACKOFF_MS: process.env.LOG_ARCHIVE_BACKOFF_MS ? Number.parseInt(process.env.LOG_ARCHIVE_BACKOFF_MS, 10) : undefined,
      LOG_ARCHIVE_BACKOFF_MAX_MS: process.env.LOG_ARCHIVE_BACKOFF_MAX_MS ? Number.parseInt(process.env.LOG_ARCHIVE_BACKOFF_MAX_MS, 10) : undefined,
      LOG_ARCHIVE_S3_ENDPOINT: process.env.LOG_ARCHIVE_S3_ENDPOINT,
      LOG_ARCHIVE_S3_FORCE_PATH_STYLE: process.env.LOG_ARCHIVE_S3_FORCE_PATH_STYLE === 'true' ? true : undefined,
      LOG_ARCHIVE_VERIFY_ON_START: process.env.LOG_ARCHIVE_VERIFY_ON_START === 'true' ? true : undefined,
      APP_BASE_URL: 'http://localhost:5000',
      CRON_TZ: 'America/Chicago',
      CCBILL_CLIENT_ACCOUNT: '',
      CCBILL_SUBACCOUNT: '',
      CCBILL_FLEXFORM_ID: '',
      CCBILL_SALT: '',
      PLAN_STORAGE_BYTES_FREE: 2147483648, // 2GB
      PLAN_STORAGE_BYTES_STARTER: 10737418240, // 10GB  
      PLAN_STORAGE_BYTES_PRO: 53687091200, // 50GB
      MEDIA_SIGNED_TTL_SECONDS: 900,
      WATERMARK_ENABLED: true,
      WATERMARK_TEXT: 'ThottoPilot',
      WATERMARK_OPACITY: 0.18,
      USE_PG_QUEUE: process.env.USE_PG_QUEUE === 'true' || !process.env.REDIS_URL, // Auto-enable when no Redis or explicitly set
      MAX_POSTS_PER_SUBREDDIT_24H: 10, // Loosened for testing
      DAILY_GENERATIONS_FREE: 5,
      DAILY_GENERATIONS_STARTER: 50,
      DAILY_GENERATIONS_PRO: -1,
      UTM_COOKIE_TTL_DAYS: 30,
      MEDIA_MAX_BYTES_FREE: 524288000,
      MEDIA_MAX_BYTES_PRO: 10737418240,
      SEGPAY_MERCHANT_ID: '',
      SEGPAY_API_KEY: '',
      EPOCH_MERCHANT_ID: '',
      EPOCH_API_KEY: '',
      PAXUM_API_KEY: '',
      COINBASE_COMMERCE_KEY: '',
      RESEND_API_KEY: process.env.RESEND_API_KEY || '',
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
      TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || '',
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',
      ANALYTICS_WRITE_KEY: process.env.ANALYTICS_WRITE_KEY || '',
      ADMIN_EMAIL_WHITELIST: process.env.ADMIN_EMAIL_WHITELIST || '',
    } as Environment;
  } else {
    logger.error("❌ Environment validation failed:");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        logger.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

export { env };

// Configuration constants derived from environment
export const config = {
  // Media quotas by tier
  mediaQuotas: {
    free: env.MEDIA_MAX_BYTES_FREE,
    pro: env.MEDIA_MAX_BYTES_PRO,
    premium: env.MEDIA_MAX_BYTES_PRO,
  },
  
  // Watermark settings
  watermark: {
    enabled: env.WATERMARK_ENABLED,
    text: env.WATERMARK_TEXT,
    opacity: env.WATERMARK_OPACITY,
  },
  
  // Signed URL TTL
  signedUrlTTL: env.MEDIA_SIGNED_TTL_SECONDS,
  
  // Generation limits by tier
  generationLimits: {
    free: env.DAILY_GENERATIONS_FREE,
    pro: env.DAILY_GENERATIONS_PRO,
    starter: env.DAILY_GENERATIONS_STARTER,
  },
  
  // App settings
  timezone: env.CRON_TZ,
  baseUrl: env.APP_BASE_URL,
} as const;