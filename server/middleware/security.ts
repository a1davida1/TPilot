import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import winston from "winston";
import dotenv from "dotenv";
import crypto from "crypto";
import { logger as appLogger } from "../bootstrap/logger.js";

// Only load dotenv if NOT in production
// In production deployments, secrets are already available as env vars
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// ==========================================
// VALIDATE ENVIRONMENT VARIABLES
// ==========================================

interface EnvValidationRule {
  key: string;
  required: boolean;
  validator?: (value: string) => boolean;
  description?: string;
}

const envValidationRules: EnvValidationRule[] = [
  // Critical security variables
  { key: 'JWT_SECRET', required: true, validator: (val) => val.length >= 32, description: 'JWT secret must be at least 32 characters' },
  { key: 'SESSION_SECRET', required: true, validator: (val) => val.length >= 32, description: 'Session secret must be at least 32 characters' },
  { key: 'DATABASE_URL', required: true, validator: (val) => val.startsWith('postgres://') || val.startsWith('postgresql://'), description: 'Database URL must be a valid PostgreSQL connection string' },
  
  // API Keys (optional but validated if present)
  { key: 'GOOGLE_GENAI_API_KEY', required: false, validator: (val) => val.startsWith('AIza') || val.length > 30, description: 'Google GenAI API key format validation' },
  { key: 'OPENAI_API_KEY', required: false, validator: (val) => val.startsWith('sk-'), description: 'OpenAI API key must start with sk-' },
  { 
    key: 'SENTRY_DSN', 
    required: false, 
    validator: (val) => {
      if (!val) return true; // Optional
      const { validateSentryDSN } = require('../bootstrap/logger');
      const { isValid } = validateSentryDSN(val);
      return isValid;
    }, 
    description: 'Sentry DSN must be a valid Sentry DSN URL format' 
  },
  { key: 'SENDGRID_API_KEY', required: false, validator: (val) => val.startsWith('SG.'), description: 'SendGrid API key must start with SG.' },
  
  // Stripe configuration (optional)
  { key: 'STRIPE_SECRET_KEY', required: false, validator: (val) => val.startsWith('sk_'), description: 'Stripe secret key must start with sk_' },
  { key: 'STRIPE_PUBLISHABLE_KEY', required: false, validator: (val) => val.startsWith('pk_'), description: 'Stripe publishable key must start with pk_' },
  { key: 'STRIPE_WEBHOOK_SECRET', required: false, validator: (val) => val.startsWith('whsec_'), description: 'Stripe webhook secret must start with whsec_' },
  
  // Reddit OAuth (optional)
  { key: 'REDDIT_CLIENT_ID', required: false, validator: (val) => val.length >= 14, description: 'Reddit client ID validation' },
  { key: 'REDDIT_CLIENT_SECRET', required: false, validator: (val) => val.length >= 20, description: 'Reddit client secret validation' },
  
  // Environment configuration
  { key: 'NODE_ENV', required: true, validator: (val) => ['development', 'production', 'test'].includes(val), description: 'NODE_ENV must be development, production, or test' },
  { key: 'PORT', required: false, validator: (val) => !isNaN(parseInt(val)) && parseInt(val) > 0, description: 'PORT must be a positive number' },
  
  // Optional email configuration
  { key: 'FROM_EMAIL', required: false, validator: (val) => val.includes('@'), description: 'FROM_EMAIL must be a valid email format' },
];

export function validateEnvironment() {
  const placeholders = ['changeme', 'placeholder', 'your_jwt_secret_here', 'default_secret', 'your_api_key_here'];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const rule of envValidationRules) {
    const value = process.env[rule.key];
    
    if (rule.required && !value) {
      errors.push(`${rule.key} is required but not set`);
      continue;
    }
    
    if (!value) {
      // Optional variable not set, skip validation
      continue;
    }
    
    // Check for placeholder values
    if (placeholders.some(p => value.toLowerCase().includes(p))) {
      errors.push(`${rule.key} contains placeholder value`);
      continue;
    }
    
    // Run custom validator if provided
    if (rule.validator && !rule.validator(value)) {
      errors.push(`${rule.key} validation failed: ${rule.description || 'Invalid format'}`);
      continue;
    }
    
    // Log successful validation for important keys
    if (rule.required) {
      appLogger.debug(`Environment variable ${rule.key} validated successfully`);
    }
  }
  
  // Additional security checks
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.OPENAI_API_KEY) {
      warnings.push('No AI API keys configured - content generation may not work');
    }
    
    if (!process.env.SENDGRID_API_KEY) {
      warnings.push('No email service configured - password resets and notifications will fail');
    }
  }
  
  // Report validation results
  if (errors.length > 0) {
    appLogger.error('Environment variable validation failed', { errors });
    throw new Error(`Invalid environment variables: ${errors.join(', ')}`);
  }
  
  if (warnings.length > 0) {
    appLogger.warn('Environment variable warnings', { warnings });
  }
  
  appLogger.info('Environment variables validated successfully', {
    validated: envValidationRules.filter(r => process.env[r.key]).length,
    total: envValidationRules.length,
    environment: process.env.NODE_ENV
  });
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
export const inputSanitizer = (req: any, res: any, next: any) => {
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

// Custom sanitization for specific threats
function sanitizeObject(obj: any): void {
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
      if (obj[key].length > 10000) {
        obj[key] = obj[key].substring(0, 10000);
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// ==========================================
// API KEY VALIDATION MIDDLEWARE
// ==========================================
export const validateApiKey = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'];
  
  // Skip validation for non-API routes
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  
  // Skip validation for public endpoints
  const publicEndpoints = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/register',
    '/api/webhooks'
  ];
  
  if (publicEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
    return next();
  }
  
  // Validate API key format if provided
  if (apiKey && !isValidApiKeyFormat(apiKey)) {
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
export const validateContentType = (req: any, res: any, next: any) => {
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
  if (req.path.startsWith('/api/') && contentType !== 'application/json') {
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
          "'unsafe-inline'", // Required for React
          process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : "",
          "https://js.stripe.com",
          "https://checkout.stripe.com",
          "https://apis.google.com"
        ].filter(Boolean),
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://checkout.stripe.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "*.stripe.com",
          "*.googleapis.com"
        ],
        connectSrc: [
          "'self'",
          "https://api.stripe.com",
          "https://checkout.stripe.com",
          "https://api.openai.com",
          "https://generativelanguage.googleapis.com",
          "wss://*.replit.dev",
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
  (req: any, res: any, next: any) => {
    if (req.path.startsWith('/api/')) {
      return generalLimiter(req, res, next);
    }
    next();
  }
];

// ==========================================
// IP LOGGING MIDDLEWARE
// ==========================================
export const ipLoggingMiddleware = (req: any, res: any, next: any) => {
  const userIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                 req.headers['x-real-ip'] || 
                 req.connection?.remoteAddress || 
                 req.socket?.remoteAddress ||
                 req.ip || 'unknown';

  const userAgent = req.headers['user-agent'] || 'Unknown';

  // Don't log sensitive routes
  const sensitiveRoutes = ['/api/auth/', '/api/admin/'];
  const shouldLog = !sensitiveRoutes.some(route => req.path.startsWith(route));

  if (shouldLog && process.env.NODE_ENV !== 'production') {
    logger.info(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${userIP}`);
  }

  // Attach to request
  req.userIP = userIP;
  req.userAgent = userAgent;

  next();
};

// ==========================================
// ERROR HANDLER MIDDLEWARE
// ==========================================
export const errorHandler = (err: any, req: any, res: any, next: any) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.userIP
  });

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(err.status || 500).json({
      error: 'An error occurred processing your request'
    });
  }

  // Development - send full error
  return res.status(err.status || 500).json({
    error: err.message,
    stack: err.stack
  });
};

// ==========================================
// 404 NOT FOUND HANDLER
// ==========================================
export const notFoundHandler = (req: any, res: any) => {
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
  if (req.accepts('json') && req.path.startsWith('/api/')) {
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