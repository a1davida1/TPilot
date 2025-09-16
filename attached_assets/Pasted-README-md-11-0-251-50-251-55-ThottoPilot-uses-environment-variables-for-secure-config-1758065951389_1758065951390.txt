README.md
+11
-0

@@ -251,50 +251,55 @@ ThottoPilot uses environment variables for secure configuration of external serv

**COINBASE_COMMERCE_KEY** - Coinbase Commerce API key
- **Required**: Optional (enables cryptocurrency payments)
- **Obtain**: Coinbase Commerce dashboard
- **Usage**: Crypto payment processing for subscriptions

### Authentication & Security

**JWT_SECRET** - Secret key for JSON Web Token signing
- **Required**: Yes - Used for secure API authentication
- **Format**: Random string (minimum 32 characters)
- **Generate**: `openssl rand -hex 32`

**SESSION_SECRET** - Secret key for session cookie signing
- **Required**: Yes - Protects user sessions
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
- **Example**: `https://yourapp.com/auth/reddit/callback`

### Media & Storage

**AWS_ACCESS_KEY_ID** - AWS S3 access key
- **Required**: Optional (enables S3 media storage)
- **Usage**: Image uploads and CDN distribution

**AWS_SECRET_ACCESS_KEY** - AWS S3 secret key
- **Required**: With AWS_ACCESS_KEY_ID
- **Security**: Never commit to version control

**AWS_REGION** - AWS S3 bucket region
- **Required**: With S3 configuration
- **Example**: `us-east-1`
@@ -400,89 +405,95 @@ ThottoPilot uses environment variables for secure configuration of external serv
## Configuration Examples

### Minimum Development Setup
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/thottopilot_dev
JWT_SECRET=your-super-secret-jwt-key-here-32-chars-min
SESSION_SECRET=your-session-secret-key-here-32-chars-min
GOOGLE_GENAI_API_KEY=your-gemini-api-key
APP_BASE_URL=http://localhost:5000
```

### Full Production Setup
```bash
# Core (Required)
DATABASE_URL=postgresql://user:pass@prod-db:5432/thottopilot
JWT_SECRET=your-production-jwt-secret
SESSION_SECRET=your-production-session-secret
APP_BASE_URL=https://yourapp.com

# AI Services
GOOGLE_GENAI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# Payment Processing
STRIPE_SECRET_KEY=sk_live_your_stripe_secret
STRIPE_API_VERSION=2023-10-16
PAXUM_API_KEY=your-paxum-merchant-id
COINBASE_COMMERCE_KEY=your-coinbase-commerce-key

# Media Storage
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_MEDIA=your-media-bucket
S3_PUBLIC_CDN_DOMAIN=https://cdn.yourapp.com

# Performance & Queues
REDIS_URL=redis://your-redis-instance:6379

# Email & Notifications
SENDGRID_API_KEY=your-sendgrid-api-key

# Security & Anti-Bot
TURNSTILE_SITE_KEY=your-turnstile-site-key
TURNSTILE_SECRET_KEY=your-turnstile-secret-key

# Analytics
ANALYTICS_WRITE_KEY=your-analytics-key
```

### Environment Variable Security

⚠️ **Important Security Notes:**
- Never commit `.env` files to version control
- Use different keys for development and production
- Rotate secrets regularly, especially JWT and session secrets
- Store production secrets in secure secret management systems
- Validate all environment variables on application startup

**STRIPE_SECRET_KEY** - Stripe payment processor secret key
- **Required**: Optional (enables credit card payments)
- **Obtain**: Stripe Dashboard (https://dashboard.stripe.com/apikeys)
- **Usage**: Primary payment processing for subscriptions and one-time purchases
- **Security**: Critical - must be kept secret, starts with `sk_`

**STRIPE_API_VERSION** - Stripe API release version used by the server
- **Required**: Yes when Stripe billing is enabled
- **Usage**: Pin Stripe client to a supported API date (e.g. `2023-10-16`)
- **Validation**: Must follow the `YYYY-MM-DD` format

### CCBill Payment Processing

**CCBILL_CLIENT_ACCOUNT** - CCBill client account number
**CCBILL_SUBACCOUNT** - CCBill sub-account for payment routing
**CCBILL_FLEXFORM_ID** - CCBill form configuration ID
**CCBILL_SALT** - CCBill security salt for payment verification
- **Required**: Optional (enables CCBill payments for adult content)
- **Obtain**: CCBill merchant interface
- **Usage**: Adult-industry specialized payment processing

### Storage and Media

**AWS_ACCESS_KEY_ID** / **AWS_SECRET_ACCESS_KEY** - AWS credentials for S3 storage
**S3_BUCKET_MEDIA** - S3 bucket name for media file storage
**S3_PUBLIC_CDN_DOMAIN** - CloudFront distribution for media delivery
- **Required**: Optional (improves media performance and scalability)
- **Usage**: Stores user-uploaded images and generated content assets

### Queue and Performance

**REDIS_URL** - Redis connection string for enhanced queue performance
- **Format**: `redis://localhost:6379` or `redis://user:pass@host:port`
- **Required**: Optional (falls back to PostgreSQL queue)
- **Usage**: Improves background job processing for content generation

create-env.js
+1
-0

const fs = require('fs');

// List the secrets you need for testing
const secrets = [
  'DATABASE_URL',
  'APP_BASE_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'REDDIT_CLIENT_ID',
  'REDDIT_CLIENT_SECRET',
  'REDDIT_USERNAME',
  'REDDIT_PASSWORD',
  'REDDIT_USER_AGENT',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_API_VERSION',
  'COINBASE_API_KEY',
  'PAXUM_MERCHANT_EMAIL',
  'FROM_EMAIL'
];

// Build .env content
let envContent = '';
secrets.forEach(key => {
  if (process.env[key]) {
    envContent += `${key}=${process.env[key]}\n`;
  } else {
    console.warn(`Warning: ${key} is not set in Replit Secrets`);
  }
});

// Write to .env file
fs.writeFileSync('.env', envContent);
console.log('.env file created with', envContent.split('\n').filter(l => l).length, 'variables');
server/payments/stripe-config.ts
New
+48
-0

import type { Logger } from "winston";

const STRIPE_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export interface StripeEnvironment {
  STRIPE_SECRET_KEY?: string;
  STRIPE_API_VERSION?: string;
}

export interface StripeConfiguration {
  secretKey: string;
  apiVersion: string;
}

export interface StripeConfigOptions {
  env: StripeEnvironment;
  logger: Pick<Logger, "error">;
}

const missingVersionMessage =
  "STRIPE_API_VERSION is required when STRIPE_SECRET_KEY is set. Provide a date in YYYY-MM-DD format (e.g. 2023-10-16).";

export function deriveStripeConfig({ env, logger }: StripeConfigOptions): StripeConfiguration | null {
  const secretKey = env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  const apiVersion = env.STRIPE_API_VERSION;

  if (!apiVersion) {
    logger.error(missingVersionMessage);
    throw new Error(missingVersionMessage);
  }

  if (!STRIPE_VERSION_PATTERN.test(apiVersion)) {
    const message = `STRIPE_API_VERSION "${apiVersion}" must match the YYYY-MM-DD format (e.g. 2023-10-16).`;
    logger.error(message);
    throw new Error(message);
  }

  return { secretKey, apiVersion };
}

export const stripeErrorMessages = {
  missingVersion: missingVersionMessage,
};
server/routes.ts
+7
-3

@@ -6,50 +6,51 @@ import path from 'path';
import connectPgSimple from 'connect-pg-simple';
import * as connectRedis from 'connect-redis';
import { Pool } from 'pg';
import Redis from 'ioredis';
import Stripe from 'stripe';
import passport from 'passport';

// Security and middleware
import { validateEnvironment, securityMiddleware, ipLoggingMiddleware, errorHandler, logger, generationLimiter } from "./middleware/security.js";
import { AppError, CircuitBreaker } from "./lib/errors.js";
import { authenticateToken } from "./middleware/auth.js";

// Route modules
// import { authRoutes } from "./routes/auth.js"; // Removed - using server/auth.ts instead
import { uploadRoutes, applyImageShieldProtection, protectionPresets } from "./routes/upload.js";
import { mediaRoutes } from "./routes/media.js";
import { registerExpenseRoutes } from "./expense-routes.js";

// Core imports
import { storage } from "./storage.js";
import { setupAuth } from "./auth.js";
import { setupAdminRoutes } from "./admin-routes.js";
import { configureSocialAuth, socialAuthRoutes } from "./social-auth-config.js";
import { visitorAnalytics } from "./visitor-analytics.js";
import { makePaxum, makeCoinbase, makeStripe } from "./payments/payment-providers.js";
import { deriveStripeConfig } from "./payments/stripe-config.js";
// Analytics request type
interface AnalyticsRequest extends express.Request {
  sessionID: string;
}

// Import users table for type inference
import { users, type ContentGeneration } from "@shared/schema";

// AuthUser interface for passport serialization
interface AuthUser {
  id: number;
  username?: string;
  isAdmin?: boolean;
}

// Auth request interface that includes user  
interface AuthenticatedRequest extends express.Request {
  user?: typeof users.$inferSelect;
}

// Session interface with Reddit OAuth properties
interface RedditSessionData {
  redditOAuthState?: string;
  redditConnected?: boolean;
}
@@ -79,55 +80,58 @@ import { createLead, confirmLead } from "./api/leads.js";
import { getLeads } from "./api/admin-leads.js";
import { captionRouter } from "./routes/caption.js";
import { contentGenerationLimiter } from "./middleware/tiered-rate-limit.js";
import { registerSocialMediaRoutes } from "./social-media-routes.js";

// Schema imports
import { insertContentGenerationSchema, insertUserImageSchema } from "@shared/schema";

// Core dependencies
import multer from 'multer';
import fs from 'fs/promises';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import csrf from 'csurf';

// Get secure environment variables (no fallbacks)
const rawSessionSecret = process.env.SESSION_SECRET;
if (!rawSessionSecret) {
  throw new Error('SESSION_SECRET missing');
}
const SESSION_SECRET: string = rawSessionSecret;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripeConfig = deriveStripeConfig({
  env: process.env,
  logger,
});

// Initialize Stripe if configured
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
const stripe = stripeConfig ? new Stripe(stripeConfig.secretKey, {
  apiVersion: stripeConfig.apiVersion,
}) : null;

// Configure multer for optional image uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Auth request interface
interface AuthRequest extends express.Request {
  user?: typeof users.$inferSelect;
}

interface GenerationRequestBody {
  mode?: string;
  prompt?: string;
  platform?: string;
  style?: string;
tests/unit/payments/stripe-config.test.ts
New
+88
-0

import { describe, expect, test } from "vitest";
import { deriveStripeConfig, stripeErrorMessages } from "../../../server/payments/stripe-config.ts";

describe("deriveStripeConfig", () => {
  test("returns null when secret key is absent", () => {
    const errors: string[] = [];
    const logger = {
      error(message: string) {
        errors.push(message);
      },
    };

    const config = deriveStripeConfig({
      env: {},
      logger,
    });

    expect(config).toBeNull();
    expect(errors).toHaveLength(0);
  });

  test("returns configuration when key and version are valid", () => {
    const errors: string[] = [];
    const logger = {
      error(message: string) {
        errors.push(message);
      },
    };

    const config = deriveStripeConfig({
      env: {
        STRIPE_SECRET_KEY: "sk_test_valid",
        STRIPE_API_VERSION: "2023-10-16",
      },
      logger,
    });

    expect(config).toEqual({
      secretKey: "sk_test_valid",
      apiVersion: "2023-10-16",
    });
    expect(errors).toHaveLength(0);
  });

  test("throws when version is missing", () => {
    const errors: string[] = [];
    const logger = {
      error(message: string) {
        errors.push(message);
      },
    };

    expect(() =>
      deriveStripeConfig({
        env: {
          STRIPE_SECRET_KEY: "sk_test_missing",
        },
        logger,
      }),
    ).toThrowError(stripeErrorMessages.missingVersion);

    expect(errors).toEqual([stripeErrorMessages.missingVersion]);
  });

  test("throws when version does not match Stripe release format", () => {
    const invalidVersion = "2024/10/16";
    const errors: string[] = [];
    const logger = {
      error(message: string) {
        errors.push(message);
      },
    };

    const expectedMessage = `STRIPE_API_VERSION "${invalidVersion}" must match the YYYY-MM-DD format (e.g. 2023-10-16).`;

    expect(() =>
      deriveStripeConfig({
        env: {
          STRIPE_SECRET_KEY: "sk_test_invalid",
          STRIPE_API_VERSION: invalidVersion,
        },
        logger,
      }),
    ).toThrowError(expectedMessage);

    expect(errors).toEqual([expectedMessage]);
  });
});