import { z } from "zod";

// Environment configuration with Zod validation
export const envSchema = z.object({
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
  
  // AWS S3 (optional for development)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  S3_BUCKET_MEDIA: z.string().optional(),
  S3_PUBLIC_CDN_DOMAIN: z.string().url().optional(),
  
  // Redis (Optional for Phase 5)
  REDIS_URL: z.string().optional(),
  
  // App Configuration
  APP_BASE_URL: z.string().optional(),
  CRON_TZ: z.string().default("America/Chicago"),
  
  // Billing - CCBill (optional for development)
  CCBILL_CLIENT_ACCOUNT: z.string().optional(),
  CCBILL_SUBACCOUNT: z.string().optional(),
  CCBILL_FLEXFORM_ID: z.string().optional(),
  CCBILL_SALT: z.string().optional(),
  
  // Media Configuration (Phase 5: Updated quotas)
  PLAN_STORAGE_BYTES_FREE: z.coerce.number().default(2147483648), // 2GB
  PLAN_STORAGE_BYTES_PRO: z.coerce.number().default(26843545600), // 25GB
  PLAN_STORAGE_BYTES_PRO_PLUS: z.coerce.number().optional().default(53687091200), // 50GB
  MEDIA_SIGNED_TTL_SECONDS: z.coerce.number().default(900), // 15 minutes
  WATERMARK_ENABLED: z.coerce.boolean().default(true),
  WATERMARK_TEXT: z.string().default("ThottoPilot"),
  WATERMARK_OPACITY: z.coerce.number().min(0).max(1).default(0.18),
  MEDIA_MAX_BYTES_FREE: z.coerce.number().default(524288000), // 500MB
  MEDIA_MAX_BYTES_PRO: z.coerce.number().default(10737418240), // 10GB
  
  // Queue Configuration (Phase 5)
  USE_PG_QUEUE: z.coerce.boolean().default(false), // Auto-enable when no REDIS_URL
  
  // Rate Limiting (Phase 5)
  MAX_POSTS_PER_SUBREDDIT_24H: z.coerce.number().default(1),
  
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
});

export function getEnvConfig() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:', error);
    // Return a safe default configuration for development
    return {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || '',
      APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5000',
      UTM_COOKIE_TTL_DAYS: 30,
    } as any;
  }
}

export type Environment = z.infer<typeof envSchema>;

// Validate and export environment
let env: Environment;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (process.env.NODE_ENV === 'development') {
    console.warn("⚠️ Development mode: Some enterprise features may be disabled");
    console.warn("  To enable all features, configure these environment variables:");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.warn(`    ${err.path.join('.')}: ${err.message}`);
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
      AWS_ACCESS_KEY_ID: '',
      AWS_SECRET_ACCESS_KEY: '',
      AWS_REGION: 'us-east-1',
      S3_BUCKET_MEDIA: '',
      REDIS_URL: process.env.REDIS_URL || undefined,
      APP_BASE_URL: 'http://localhost:5000',
      CRON_TZ: 'America/Chicago',
      CCBILL_CLIENT_ACCOUNT: '',
      CCBILL_SUBACCOUNT: '',
      CCBILL_FLEXFORM_ID: '',
      CCBILL_SALT: '',
      PLAN_STORAGE_BYTES_FREE: 2147483648,
      PLAN_STORAGE_BYTES_PRO: 26843545600,
      PLAN_STORAGE_BYTES_PRO_PLUS: 53687091200,
      MEDIA_SIGNED_TTL_SECONDS: 900,
      WATERMARK_ENABLED: true,
      WATERMARK_TEXT: 'ThottoPilot',
      WATERMARK_OPACITY: 0.18,
      USE_PG_QUEUE: !process.env.REDIS_URL, // Auto-enable when no Redis
      MAX_POSTS_PER_SUBREDDIT_24H: 1,
      UTM_COOKIE_TTL_DAYS: 30,
      MEDIA_MAX_BYTES_FREE: 524288000,
      MEDIA_MAX_BYTES_PRO: 10737418240,
      SEGPAY_MERCHANT_ID: '',
      SEGPAY_API_KEY: '',
      EPOCH_MERCHANT_ID: '',
      EPOCH_API_KEY: '',
      PAXUM_API_KEY: '',
      COINBASE_COMMERCE_KEY: '',
    } as any;
  } else {
    console.error("❌ Environment validation failed:");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
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
  
  // App settings
  timezone: env.CRON_TZ,
  baseUrl: env.APP_BASE_URL,
} as const;