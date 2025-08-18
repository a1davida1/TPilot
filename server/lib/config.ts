import { z } from "zod";

// Environment configuration with Zod validation
export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),
  
  // Reddit API
  REDDIT_CLIENT_ID: z.string().min(1),
  REDDIT_CLIENT_SECRET: z.string().min(1),
  REDDIT_REDIRECT_URI: z.string().url(),
  
  // Google Generative AI
  GOOGLE_GENAI_API_KEY: z.string().min(1),
  
  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  S3_BUCKET_MEDIA: z.string().min(1),
  S3_PUBLIC_CDN_DOMAIN: z.string().url().optional(),
  
  // Redis
  REDIS_URL: z.string().min(1),
  
  // App Configuration
  APP_BASE_URL: z.string().url(),
  CRON_TZ: z.string().default("America/Chicago"),
  
  // Billing - CCBill
  CCBILL_CLIENT_ACCOUNT: z.string().min(1),
  CCBILL_SUBACCOUNT: z.string().min(1),
  CCBILL_FLEXFORM_ID: z.string().min(1),
  CCBILL_SALT: z.string().min(1),
  
  // Media Configuration
  MEDIA_MAX_BYTES_FREE: z.coerce.number().default(524288000), // 500MB
  MEDIA_MAX_BYTES_PRO: z.coerce.number().default(10737418240), // 10GB
  MEDIA_SIGNED_TTL_SECONDS: z.coerce.number().default(600),
  WATERMARK_ENABLED: z.coerce.boolean().default(true),
  WATERMARK_TEXT: z.string().default("ThottoPilot"),
  WATERMARK_OPACITY: z.coerce.number().min(0).max(1).default(0.18),
});

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
      NODE_ENV: 'development',
      PORT: parseInt(process.env.PORT || '5000'),
      DATABASE_URL: process.env.DATABASE_URL || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      REDDIT_CLIENT_ID: '',
      REDDIT_CLIENT_SECRET: '',
      REDDIT_REDIRECT_URI: '',
      GOOGLE_GENAI_API_KEY: '',
      AWS_ACCESS_KEY_ID: '',
      AWS_SECRET_ACCESS_KEY: '',
      AWS_REGION: 'us-east-1',
      S3_BUCKET_MEDIA: '',
      REDIS_URL: '',
      APP_BASE_URL: 'http://localhost:5000',
      CCBILL_CLIENT_ACCOUNT: '',
      CCBILL_SUBACCOUNT: '',
      CCBILL_FLEXFORM_ID: '',
      CCBILL_SALT: '',
      CRON_TZ: 'America/Chicago',
      MEDIA_MAX_BYTES_FREE: 524288000,
      MEDIA_MAX_BYTES_PRO: 10737418240,
      MEDIA_SIGNED_TTL_SECONDS: 600,
      WATERMARK_ENABLED: true,
      WATERMARK_TEXT: 'ThottoPilot',
      WATERMARK_OPACITY: 0.18,
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