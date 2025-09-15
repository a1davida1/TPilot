import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { logger } from '../bootstrap/logger.js';

// Validation sources enum for clear specification
export enum ValidationSource {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params',
  HEADERS = 'headers'
}

// Validation middleware factory with comprehensive error handling
export function validate(schema: ZodSchema, source: ValidationSource = ValidationSource.BODY) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = result.error.flatten();
        
        logger.warn('Input validation failed', {
          source,
          path: req.path,
          method: req.method,
          errors: errors.fieldErrors,
          formErrors: errors.formErrors,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: {
            fieldErrors: errors.fieldErrors,
            formErrors: errors.formErrors
          }
        });
      }
      
      // Replace original data with validated and potentially transformed data
      req[source] = result.data;
      next();
      
    } catch (error) {
      logger.error('Validation middleware error', {
        error: (error as Error).message,
        path: req.path,
        method: req.method,
        source,
        ip: req.ip
      });
      
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Validation processing failed'
      });
    }
  };
}

// Multi-source validation for complex endpoints
export function validateMultiple(validations: Array<{ schema: ZodSchema; source: ValidationSource }>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Record<string, { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] }> = {};
    
    for (const { schema, source } of validations) {
      const data = req[source];
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const sourceErrors = result.error.flatten();
        errors[source] = {
          fieldErrors: sourceErrors.fieldErrors,
          formErrors: sourceErrors.formErrors
        };
      } else {
        // Replace with validated data
        req[source] = result.data;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      logger.warn('Multi-source validation failed', {
        validationErrors: errors,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: errors
      });
    }
    
    next();
  };
}

// ==========================================
// COMMON VALIDATION SCHEMAS
// ==========================================

// User ID validation (supports both numeric and UUID formats)
export const userIdSchema = z.union([
  z.string().uuid('Invalid user ID format'),
  z.string().regex(/^\d+$/, 'Invalid user ID format').transform(Number),
  z.number().int().positive('Invalid user ID')
]);

// Email validation with additional constraints
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .toLowerCase()
  .trim();

// Username validation
export const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be less than 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens')
  .trim();

// Password validation with strength requirements
export const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');

// Pagination validation
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(val => val > 0, 'Page must be positive').optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100').optional().default('10'),
  sort: z.enum(['asc', 'desc']).optional().default('desc'),
  sortBy: z.string().max(50).optional()
});

// File upload validation
export const fileUploadSchema = z.object({
  mimetype: z.string().refine(
    (type) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type),
    'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed'
  ),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  originalname: z.string().min(1, 'Filename required').max(255, 'Filename too long')
});

// Request headers validation for API endpoints
export const apiHeadersSchema = z.object({
  'content-type': z.string().optional(),
  'user-agent': z.string().optional(),
  'authorization': z.string().optional(),
  'x-api-key': z.string().optional()
}).passthrough(); // Allow additional headers

// IP address validation
export const ipAddressSchema = z.string().refine(
  (ip) => {
    // Basic IPv4 and IPv6 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === '::1' || ip === 'localhost';
  },
  'Invalid IP address format'
);

// ==========================================
// SPECIFIC ENDPOINT VALIDATORS
// ==========================================

// Auth-related validation schemas
export const loginValidationSchema = z
  .object({
    username: z.string().optional(),
    email: z.string().email().optional(),
    loginIdentifier: z.string().optional(),
    // Login should only validate that password is provided, not its format
    // This allows users with legacy passwords to login successfully
    password: z.string().min(1, 'Password is required'),
  })
  .refine(
    (data) => data.username || data.email || data.loginIdentifier,
    { message: 'Username or email is required', path: ['username'] },
  );

export const signupValidationSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema
});

export const passwordChangeValidationSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'New password and confirmation must match',
  path: ['confirmPassword']
});

export const passwordResetValidationSchema = z.object({
  token: z.string().min(1, 'Token required'),
  newPassword: passwordSchema
});

// Content generation validation
export const contentGenerationSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(1000, 'Prompt too long'),
  style: z.enum(['casual', 'professional', 'playful', 'seductive']).optional(),
  platform: z.enum(['reddit', 'twitter', 'instagram']).optional(),
  includeHashtags: z.boolean().optional().default(false)
});

// Upload protection validation (from shared schema)
export const uploadProtectionSchema = z.object({
  protectionLevel: z.enum(['light', 'standard', 'heavy']).default('standard'),
  watermark: z.boolean().optional().default(false)
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Sanitize input data by removing potentially dangerous characters
export function sanitizeInput(input: unknown): unknown {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

// Create validation middleware with sanitization
export function validateAndSanitize(schema: ZodSchema, source: ValidationSource = ValidationSource.BODY) {
  return (req: Request, res: Response, next: NextFunction) => {
    // First sanitize the input
    req[source] = sanitizeInput(req[source]);
    
    // Then apply validation
    return validate(schema, source)(req, res, next);
  };
}