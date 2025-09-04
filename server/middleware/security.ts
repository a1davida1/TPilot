import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import winston from "winston";
import dotenv from "dotenv";
import crypto from "crypto";

// Only load dotenv if NOT in production
// In production deployments, secrets are already available as env vars
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// ==========================================
// VALIDATE ENVIRONMENT VARIABLES
// ==========================================
export function validateEnvironment() {
  const required = ['JWT_SECRET', 'SESSION_SECRET', 'DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please set them in Replit Secrets (lock icon)');
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Environment variables validated');
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
    logger.warn(`Invalid API key format from ${req.userIP}`);
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