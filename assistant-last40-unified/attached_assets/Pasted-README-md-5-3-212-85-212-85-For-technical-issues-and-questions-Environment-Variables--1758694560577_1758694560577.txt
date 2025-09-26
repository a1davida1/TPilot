README.md
+5-3
@@ -212,85 +212,85 @@ For technical issues and questions:

## Environment Variables

ThottoPilot uses environment variables for secure configuration of external services and platform features. Copy `.env.example` to `.env` and configure the following variables:

### Core Application Settings

**APP_BASE_URL** - The base URL where your application is hosted
- **Development**: `http://localhost:5000`
- **Production**: `https://your-domain.com`
- **Usage**: Used for OAuth redirects, webhook URLs, and email verification links

**NODE_ENV** - Application environment mode
- **Values**: `development` | `production`
- **Impact**: Affects logging, error handling, and feature availability

**PORT** - Server port binding configuration
- **Default**: `5000`
- **Range**: `1000-65535` (in Replit environments, only PORT environment variable is allowed)
- **Usage**: HTTP server listening port with automatic EADDRINUSE error handling and retry logic

### Database Configuration

**DATABASE_URL** - PostgreSQL connection string
- **Format**: `postgresql://user:password@host:port/database`
- **Required**: Yes - Core data storage for users, content, and billing
- **Required**: Production deployments. In development the server logs a warning, generates temporary secrets, and disables background workers until credentials are provided.
- **Example**: `postgresql://user:pass@localhost:5432/thottopilot`

### AI Content Generation

**GOOGLE_GENAI_API_KEY** - Google Gemini API key (Primary AI provider)
- **Required**: Yes for AI content generation
- **Obtain**: Google AI Studio (https://makersuite.google.com/app/apikey)
- **Usage**: Primary AI provider for content generation and image analysis

**OPENAI_API_KEY** - OpenAI API key (Fallback AI provider)
- **Required**: Optional (fallback when Gemini unavailable)
- **Obtain**: OpenAI Platform (https://platform.openai.com/api-keys)
- **Usage**: Backup AI provider and specialized model access

### Payment Provider Integration

**PAXUM_API_KEY** - Paxum payment processor merchant ID
- **Required**: Optional (enables Paxum payment option)
- **Obtain**: Paxum merchant dashboard

**COINBASE_COMMERCE_KEY** - Coinbase Commerce API key
- **Required**: Optional (enables cryptocurrency payments)
- **Obtain**: Coinbase Commerce dashboard
- **Usage**: Crypto payment processing for subscriptions

### Authentication & Security

**JWT_SECRET** - Secret key for JSON Web Token signing
- **Required**: Yes - Used for secure API authentication
- **Required**: Production deployments (generated automatically for development, but sessions reset between restarts until you set a persistent value)
- **Format**: Random string (minimum 32 characters)
- **Generate**: `openssl rand -hex 32`

**SESSION_SECRET** - Secret key for session cookie signing
- **Required**: Yes - Protects user sessions
- **Required**: Production deployments (auto-generated for development; define a stable secret locally to keep users logged in)
- **Format**: Random string (minimum 32 characters)
- **Generate**: `openssl rand -hex 32`

### External API Services

**STRIPE_SECRET_KEY** - Stripe payment processor secret key
- **Required**: Optional (enables Stripe billing)
- **Obtain**: Stripe Dashboard → Developers → API Keys
- **Format**: Starts with `sk_`

**STRIPE_API_VERSION** - Stripe API release version used for requests
- **Required**: Yes (whenever STRIPE_SECRET_KEY is configured)
- **Format**: `YYYY-MM-DD`
- **Example**: `2023-10-16`

**REDDIT_CLIENT_ID** - Reddit OAuth application client ID
- **Required**: Optional (enables Reddit integration)
- **Obtain**: Reddit App Preferences (https://www.reddit.com/prefs/apps)

**REDDIT_CLIENT_SECRET** - Reddit OAuth application secret
- **Required**: Optional (with REDDIT_CLIENT_ID)
- **Usage**: Reddit post scheduling and subreddit integration

**REDDIT_REDIRECT_URI** - Reddit OAuth redirect URI
- **Required**: Optional (with Reddit OAuth)
@@ -303,50 +303,52 @@ ThottoPilot uses environment variables for secure configuration of external serv
- **Usage**: Image uploads and CDN distribution

**AWS_SECRET_ACCESS_KEY** - AWS S3 secret key
- **Required**: With AWS_ACCESS_KEY_ID
- **Security**: Never commit to version control

**AWS_REGION** - AWS S3 bucket region
- **Required**: With S3 configuration
- **Example**: `us-east-1`

**S3_BUCKET_MEDIA** - S3 bucket name for media storage
- **Required**: With S3 configuration
- **Usage**: Stores user uploads and generated content

**S3_PUBLIC_CDN_DOMAIN** - CloudFront or CDN domain for S3
- **Required**: Optional (improves media delivery)
- **Example**: `https://cdn.yourdomain.com`

### Queue & Background Processing

**REDIS_URL** - Redis connection string for queue processing
- **Required**: Optional (PostgreSQL fallback available)
- **Example**: `redis://localhost:6379`
- **Usage**: High-performance job queue and caching

> **Development fallback:** When neither `DATABASE_URL` nor `REDIS_URL` is configured the server boots in a degraded mode—temporary authentication secrets are generated, queue initialization is skipped, and a warning is written to the logs. Add `DATABASE_URL` (PostgreSQL) or `REDIS_URL` (Redis) and restart the process to re-enable background workers once your credentials are ready.

**USE_PG_QUEUE** - Force PostgreSQL queue backend
- **Default**: `false` (auto-enabled if no Redis)
- **Values**: `true` | `false`

### Email Services

**SENDGRID_API_KEY** - SendGrid email service API key
- **Required**: Optional (enables email notifications)
- **Obtain**: SendGrid Dashboard → Settings → API Keys

**RESEND_API_KEY** - Resend email service API key  
- **Required**: Optional (alternative to SendGrid)
- **Obtain**: Resend Dashboard (https://resend.com)

### Anti-Bot Protection

**TURNSTILE_SITE_KEY** - Cloudflare Turnstile site key (public)
- **Required**: Optional (enables CAPTCHA protection)
- **Obtain**: Cloudflare Dashboard → Turnstile

**TURNSTILE_SECRET_KEY** - Cloudflare Turnstile secret key
- **Required**: With TURNSTILE_SITE_KEY
- **Usage**: Server-side CAPTCHA verification

### Analytics & Monitoring
server/app.ts
+7-1
@@ -222,52 +222,58 @@ async function configureStaticAssets(

export async function createApp(options: CreateAppOptions = {}): Promise<CreateAppResult> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(generalLimiter);
  app.use(sanitize);

  configureCors(app);

  app.use((req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  app.post(`${API_PREFIX}/webhooks/stripe`, express.raw({ type: 'application/json' }), (_req, _res, next) => next());
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));

  applyRequestLogging(app);

  const startQueueOption = options.startQueue ?? true;
  const configureStaticOption = options.configureStaticAssets ?? true;
  const enableVite = options.enableVite ?? (app.get('env') === 'development');
  const queuePrerequisitesPresent = Boolean(process.env.REDIS_URL || process.env.DATABASE_URL);
  const shouldStartQueue = startQueueOption && queuePrerequisitesPresent;

  try {
    app.use(`${API_PREFIX}/auth`, authLimiter);

    if (startQueueOption) {
    if (shouldStartQueue) {
      await startQueue();
    } else if (startQueueOption) {
      logger.info(
        'Queue startup skipped: provide REDIS_URL or DATABASE_URL environment variables to enable background workers.'
      );
    } else {
      logger.info('Queue startup disabled for current execution context.');
    }

    setupAuth(app);
    setupSocialAuth(app);
    mountStripeWebhook(app, API_PREFIX);
    mountBillingRoutes(app);

    const server = await registerRoutes(app, API_PREFIX);

    if (configureStaticOption) {
      await configureStaticAssets(app, server, enableVite);
    }

    return { app, server };
  } catch (error) {
    logger.error('Failed to initialise application:', error);
    throw error;
  }
}
server/bootstrap/queue.ts
+33-3
import { initializeQueue } from "../lib/queue-factory";
import { initializeWorkers } from "../lib/workers/index";
import { logger } from "./logger";

// Queue system initialization
export async function startQueue() {
  try {
    logger.info('🔄 Initializing queue system...');
    

    // Initialize Phase 5 queue system
    await initializeQueue();
    logger.info('✅ Queue system initialized');
    

    // Initialize all workers
    await initializeWorkers();
    logger.info('✅ Background workers initialized');

    // Start queue monitoring
    const { queueMonitor } = await import("../lib/queue-monitor.js");
    await queueMonitor.startMonitoring(30000); // Monitor every 30 seconds
    logger.info('✅ Queue monitoring started (interval: 30000ms)');

    // Start worker auto-scaling
    const { workerScaler } = await import("../lib/worker-scaler.js");
    await workerScaler.startScaling(60000); // Scale every minute
    logger.info('✅ Worker auto-scaling started (interval: 60000ms)');
    

  } catch (error) {
    if (isConfigurationError(error)) {
      logger.warn(
        'Skipping queue startup due to missing configuration. Provide DATABASE_URL or REDIS_URL to enable background workers.',
        { error: (error as Error).message }
      );
      return;
    }

    logger.error('❌ Failed to initialize queue system', { error });
    throw error;
  }
}

function isConfigurationError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const configurationPatterns = [
    'database_url must be set',
    'database url must be set',
    'missing database_url',
    'missing database url',
    'redis_url must be set',
    'missing redis_url',
    'missing redis url',
    'configuration is missing',
    'no database_url provided',
    'no redis_url provided'
  ];

  return configurationPatterns.some(pattern => message.includes(pattern));
}

// Graceful queue shutdown
export async function stopQueue() {
  try {
    logger.info('🔄 Shutting down queue system...');
    
    // Stop monitoring
    const { queueMonitor } = await import("../lib/queue-monitor.js");
    await queueMonitor.stopMonitoring();
    
    // Stop worker scaling
    const { workerScaler } = await import("../lib/worker-scaler.js");
    await workerScaler.stopScaling();
    
    logger.info('✅ Queue system shutdown complete');
  } catch (error) {
    logger.error('❌ Error during queue shutdown', { error });
  }
}

// Queue health check
export async function checkQueueHealth() {
  try {
    // This would typically check queue connection, worker status, etc.
    // For now, return a basic health status
    return {
server/middleware/security.ts
+115-12
@@ -11,69 +11,172 @@ import * as Sentry from "@sentry/node";
import { z } from "zod";
import { logger as appLogger, validateSentryDSN } from "../bootstrap/logger.js";
import { AppError } from "../lib/errors.js";

// Global Express namespace declaration
declare global {
  namespace Express {
    interface Request {
      userIP?: string;
      userAgent?: string;
    }
  }
}

// HttpError interface for error typing
interface HttpError extends Error {
  status?: number;
}

// Only load dotenv if NOT in production
// In production deployments, secrets are already available as env vars
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const generatedDevelopmentSecrets = new Set<"JWT_SECRET" | "SESSION_SECRET">();

function applyDevelopmentFallbacks(logWarnings: boolean): void {
  const guidanceMessages: Record<"JWT_SECRET" | "SESSION_SECRET", string> = {
    JWT_SECRET: 'Add JWT_SECRET to your .env file to keep tokens stable between restarts.',
    SESSION_SECRET: 'Set SESSION_SECRET to persist login sessions locally.',
  };

  (Object.keys(guidanceMessages) as Array<"JWT_SECRET" | "SESSION_SECRET">).forEach(key => {
    const secret = process.env[key];
    if (!secret || secret.length < 32) {
      const fallback = crypto.randomBytes(32).toString("hex");
      process.env[key] = fallback;
      generatedDevelopmentSecrets.add(key);
      if (logWarnings) {
        appLogger.warn(`${key} is missing or too short. Generated a temporary development secret. ${guidanceMessages[key]}`);
      }
    } else if (logWarnings && generatedDevelopmentSecrets.has(key)) {
      appLogger.warn(`${key} was replaced with a generated development secret. ${guidanceMessages[key]}`);
    }
  });
}

const initialNodeEnv = process.env.NODE_ENV ?? "development";
process.env.NODE_ENV = initialNodeEnv;
if (initialNodeEnv !== "production") {
  applyDevelopmentFallbacks(false);
}

// ==========================================
// VALIDATE ENVIRONMENT VARIABLES
// ==========================================

export const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  NODE_ENV: z.enum(["production", "development", "test"]),
  PORT: z.string().regex(/^\d+$/).default("5000"),
});
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["production", "development", "test"]).default("development"),
    PORT: z.string().regex(/^\d+$/).default("5000"),
    DATABASE_URL: z.string().url().optional(),
    JWT_SECRET: z.string().min(32).optional(),
    SESSION_SECRET: z.string().min(32).optional(),
    REDIS_URL: z.string().url().optional(),
    SENDGRID_API_KEY: z.string().optional(),
    SENTRY_DSN: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production") {
      if (!value.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DATABASE_URL must be set in production.",
          path: ["DATABASE_URL"],
        });
      }

      if (!value.JWT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "JWT_SECRET must be set in production.",
          path: ["JWT_SECRET"],
        });
      }

      if (!value.SESSION_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SESSION_SECRET must be set in production.",
          path: ["SESSION_SECRET"],
        });
      }
    }
  });

export function validateEnvironment() {
  const result = envSchema.safeParse(process.env);
  const resolvedNodeEnv = process.env.NODE_ENV ?? "development";
  process.env.NODE_ENV = resolvedNodeEnv;

  const result = envSchema.safeParse({
    ...process.env,
    NODE_ENV: resolvedNodeEnv,
  });

  if (result.success) {
    process.env.PORT = result.data.PORT;
  } else if (!process.env.PORT || !/^\d+$/.test(process.env.PORT)) {
    process.env.PORT = "5000";
  }

  if (!result.success) {
    throw new Error(result.error.issues.map(i => i.message).join("\n"));
    const issues = result.error.issues.map(issue => {
      const path = issue.path.join(".") || "environment";
      return `${path}: ${issue.message}`;
    });

    const logIssue = resolvedNodeEnv === "production" ? appLogger.error.bind(appLogger) : appLogger.warn.bind(appLogger);
    issues.forEach(message => {
      logIssue(`Environment configuration issue detected: ${message}`);
    });

    if (resolvedNodeEnv === "production") {
      throw new Error("Environment configuration invalid. Resolve the issues above and restart the server.");
    }
  }

  if (resolvedNodeEnv !== "production") {
    applyDevelopmentFallbacks(true);

    if (!process.env.DATABASE_URL) {
      appLogger.warn(
        "DATABASE_URL is not set. Background workers and persistence features that require Postgres are disabled until you configure DATABASE_URL."
      );
    }
  }

  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    const { isValid, errors } = validateSentryDSN(sentryDsn);
    if (!isValid) {
      errors.forEach(errorMessage => {
        const log = resolvedNodeEnv === "production" ? appLogger.error.bind(appLogger) : appLogger.warn.bind(appLogger);
        log(`Invalid SENTRY_DSN detected: ${errorMessage}`);
      });
    }
  }
}

// ==========================================
// LOGGER SETUP
// ==========================================
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  ],
});

// ==========================================
// RATE LIMITERS
// ==========================================
tests/unit/server/app-bootstrap.smoke.test.ts
New
+72-0
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockStartQueue = vi.fn();

vi.mock('../../../server/bootstrap/queue.js', () => ({
  startQueue: mockStartQueue,
}));

vi.mock('../../../server/db.js', () => ({
  db: {},
  pool: {},
  closeDatabaseConnections: vi.fn(),
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../../server/bootstrap/logger.js', async () => {
  const actual = await vi.importActual<typeof import('../../../server/bootstrap/logger.js')>(
    '../../../server/bootstrap/logger.js'
  );

  return {
    ...actual,
    logger: mockLogger,
  };
});

describe('createExpressApp bootstrap fallback', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockStartQueue.mockReset();
    mockStartQueue.mockResolvedValue(undefined);
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  it('resolves when queue prerequisites are absent', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.JWT_SECRET;
    delete process.env.SESSION_SECRET;
    process.env.NODE_ENV = 'development';

    const { createExpressApp } = await import('../../../server/index.js');

    await expect(
      createExpressApp({ startQueue: undefined, configureStaticAssets: false, enableVite: false })
    ).resolves.toBeDefined();

    expect(mockStartQueue).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Queue startup skipped: provide REDIS_URL or DATABASE_URL environment variables to enable background workers.'
    );
  });
});
