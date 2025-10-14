import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import winston from "winston";
import dotenv from "dotenv";
import crypto from "crypto";
import express from "express";
import * as Sentry from "@sentry/node";
import { z } from "zod";
import { logger as appLogger, validateSentryDSN } from "../bootstrap/logger.js";
import { AppError } from "../lib/errors.js";
import { API_PREFIX, prefixApiPath } from "../lib/api-prefix.js";

// Augment Express Request interface using ES6 module augmentation
declare module 'express-serve-static-core' {
  interface Request {
    userIP?: string;
    userAgent?: string;
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

const parseBoolean = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
};

const isApiPath = (path: string): boolean => path === API_PREFIX || path.startsWith(`${API_PREFIX}/`);

export function validateEnvironment() {
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

  const env = result.data;
  const usePgQueue = parseBoolean(process.env.USE_PG_QUEUE);

  if (env?.NODE_ENV === 'production' && !env?.REDIS_URL && !usePgQueue) {
    logger.error('⚠️ PRODUCTION WARNING: No persistent session store configured');
    logger.error('Set REDIS_URL or USE_PG_QUEUE=true for production deployments');
    // Don't throw in production to avoid crash loops, but log the critical issue
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
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per 15 minutes
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many authentication attempts. You can try again in 15 minutes or use a different email address.',
    type: 'rate_limit',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests from your IP address. Please wait 15 minutes before trying again.',
    type: 'rate_limit',
    retryAfter: '15 minutes'
  }
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: {
    error: 'Upload rate limit exceeded',
    message: 'Too many file uploads. Please wait 1 minute before uploading more files.',
    type: 'rate_limit',
    retryAfter: '1 minute'
  }
});

export const generationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 generations per minute
  message: {
    error: 'Content generation rate limit exceeded',
    message: 'Too many content generation requests. Please wait 1 minute before generating more content.',
    type: 'rate_limit',
    retryAfter: '1 minute'
  }
});

// ==========================================
// INPUT SANITIZATION MIDDLEWARE
// ==========================================
export const inputSanitizer = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Sanitize request body, query, and params
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      logger.warn(`Sanitized potentially malicious input: ${key} from ${req.ip}`);
    }
  })(req, res, () => {
    // Additional custom sanitization
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      sanitizeObject(req.query);
    }
    next();
  });
};

// Alias for convenience
export const sanitize = inputSanitizer;

// Extend Express Request interface to add custom properties
declare module 'express' {
  interface Request {
    userIP?: string;
    userAgent?: string;
  }
}

// Custom sanitization for specific threats
function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potential XSS payloads
      obj[key] = obj[key]
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/eval\s*\(/gi, '')
        .replace(/expression\s*\(/gi, '');

      // Limit string length to prevent DoS
      if ((obj[key] as string).length > 10000) {
        obj[key] = (obj[key] as string).substring(0, 10000);
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key] as Record<string, unknown>);
    }
  }
}

// ==========================================
// API KEY VALIDATION MIDDLEWARE
// ==========================================
export const validateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  // Skip validation for non-API routes
  if (!isApiPath(req.path)) {
    return next();
  }

  // Skip validation for public endpoints
  const publicEndpoints = [
    prefixApiPath('/health'),
    prefixApiPath('/auth/login'),
    prefixApiPath('/auth/register'),
    prefixApiPath('/webhooks'),
  ];

  if (publicEndpoints.some((endpoint) => req.path === endpoint || req.path.startsWith(`${endpoint}/`))) {
    return next();
  }

  // Validate API key format if provided
  if (apiKey && !isValidApiKeyFormat(apiKey as string)) {
    const originIP = req.userIP || req.ip;
    logger.warn(`Invalid API key format from ${originIP}`);
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  next();
};

function isValidApiKeyFormat(key: string): boolean {
  // Basic API key format validation
  return /^[A-Za-z0-9_-]{32,128}$/.test(key);
}

// ==========================================
// CONTENT-TYPE VALIDATION MIDDLEWARE
// ==========================================
export const validateContentType = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Only validate POST, PUT, PATCH requests
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const contentType = req.headers['content-type'];

  // Skip for multipart uploads
  if (contentType && contentType.startsWith('multipart/form-data')) {
    return next();
  }

  // Require JSON content type for API routes
  if (isApiPath(req.path) && contentType !== 'application/json') {
    return res.status(400).json({
      error: 'Content-Type must be application/json for API requests'
    });
  }

  next();
};

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================
export const securityMiddleware = [
  // Enhanced security headers with CSP
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Vite 5.x no longer requires 'unsafe-eval' for HMR (uses WebSocket)
          // Removed 'unsafe-eval' - Phase 0 security hardening
          // Specific trusted domains
          "https://js.stripe.com",
          "https://checkout.stripe.com",
          "https://apis.google.com",
          // Replit domains for development
          process.env.NODE_ENV === 'development' ? "https://replit.com" : "",
          process.env.NODE_ENV === 'development' ? "https://*.replit.dev" : "",
          process.env.NODE_ENV === 'development' ? "https://*.replit.app" : ""
        ].filter(Boolean),
        styleSrc: [
          "'self'",
          // Allow specific style sources
          "https://fonts.googleapis.com",
          "https://checkout.stripe.com",
          // Allow data: URLs for CSS-in-JS libraries
          "data:"
        ].filter(Boolean),
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://files.catbox.moe",
          "https://i.imgur.com",
          "https://i.redd.it",
          "https://cdn.discordapp.com",
          "*.stripe.com",
          "*.googleapis.com",
          // Fallback for other image hosts
          "https:"
        ],
        connectSrc: [
          "'self'",
          "https://api.stripe.com",
          "https://checkout.stripe.com",
          "https://api.openai.com",
          "https://generativelanguage.googleapis.com",
          "https://openrouter.ai",
          "https://catbox.moe",
          "https://files.catbox.moe",
          "https://litterbox.catbox.moe",
          "wss://*.replit.dev",
          "wss://*.replit.app",
          "ws://localhost:*"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'self'", "https://checkout.stripe.com", "https://js.stripe.com"],
        workerSrc: ["'self'", "blob:"],
        childSrc: ["'self'", "blob:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    crossOriginEmbedderPolicy: false
  }),

  // Input sanitization and validation
  inputSanitizer,

  // HTTP Parameter Pollution protection
  hpp({
    whitelist: ['tags', 'categories'] // Allow arrays for these fields
  }),

  // Content-Type validation
  validateContentType,

  // API key format validation
  validateApiKey,

  // Compression
  compression(),

  // General rate limiting for API routes
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isApiPath(req.path)) {
      return generalLimiter(req, res, next);
    }
    next();
  }
];

// ==========================================
// IP LOGGING MIDDLEWARE
// ==========================================
export const ipLoggingMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  const forwardedIP = typeof xForwardedFor === 'string' 
    ? xForwardedFor.split(',')[0]?.trim()
    : Array.isArray(xForwardedFor) 
      ? xForwardedFor[0]
      : undefined;

  const userIP = forwardedIP || 
                 req.headers['x-real-ip'] || 
                 req.connection?.remoteAddress || 
                 req.socket?.remoteAddress ||
                 req.ip || 'unknown';

  const userAgent = req.headers['user-agent'] || 'Unknown';

  // Don't log sensitive routes
  const sensitiveRoutes = [prefixApiPath('/auth'), prefixApiPath('/admin')];
  const shouldLog = !sensitiveRoutes.some((route) => req.path === route || req.path.startsWith(`${route}/`));

  if (shouldLog && process.env.NODE_ENV !== 'production') {
    logger.info(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${userIP}`);
  }

  // Attach to request
  req.userIP = typeof userIP === 'string' ? userIP : 'unknown';
  req.userAgent = typeof userAgent === 'string' ? userAgent : 'Unknown';

  next();
};

// ==========================================
// ERROR HANDLER MIDDLEWARE
// ==========================================
export const errorHandler = async (
  err: Error,
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  const appError =
    err instanceof AppError
      ? err
      : new AppError(err.message || "Internal Server Error", (err as HttpError).status ?? 500, false);

  logger.error("Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.userIP
  });

  if (!appError.isOperational) {
    Sentry.captureException(err, {
      user: { id: (req as { user?: { id?: string | number } }).user?.id },
      tags: { endpoint: req.path }
    });
  }

  if (req.pendingOperations) {
    await Promise.all(req.pendingOperations.map(op => op.cleanup().catch(() => undefined)));
  }

  if (process.env.NODE_ENV === "production") {
    return res.status(appError.statusCode).json({
      error: appError.isOperational ? appError.message : "An unexpected error occurred"
    });
  }

  return res.status(appError.statusCode).json({
    error: appError.message,
    stack: err.stack
  });
};

// ==========================================
// 404 NOT FOUND HANDLER
// ==========================================
export const notFoundHandler = (req: express.Request, res: express.Response) => {
  const userIP = req.userIP || req.ip || 'unknown';
  const path = req.path || req.url || 'unknown';
  const method = req.method || 'unknown';

  // Log the 404 for monitoring purposes
  logger.warn('404 Not Found', {
    path,
    method,
    ip: userIP,
    userAgent: req.userAgent || req.headers['user-agent'],
    referer: req.headers.referer || req.headers.referrer,
    timestamp: new Date().toISOString()
  });

  // Send appropriate response based on request type
  if (req.accepts('json') && isApiPath(req.path)) {
    // API request - return JSON
    return res.status(404).json({
      error: 'Not Found',
      message: 'The requested API endpoint does not exist',
      path,
      method,
      timestamp: new Date().toISOString(),
      suggestions: [
        'Check the URL for typos',
        'Verify the HTTP method (GET, POST, etc.)',
        'Consult the API documentation',
        'Contact support if the issue persists'
      ]
    });
  } else if (req.accepts('html')) {
    // Web request - return HTML (or redirect to client-side router)
    return res.status(404).json({
      error: 'Page Not Found',
      message: 'The requested page does not exist',
      path,
      timestamp: new Date().toISOString()
    });
  } else {
    // Default - return plain text
    return res.status(404).type('txt').send(`404 Not Found: ${path}`);
  }
};