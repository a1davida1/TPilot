/**
 * Utility functions for structured logging with sensitive data redaction
 */

import { logger } from '../middleware/security.js';
import type { User } from '../../shared/schema.js';

// Sensitive field patterns to redact
const SENSITIVE_PATTERNS = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'email',
  'phone',
  'ssn',
  'credit',
  'card',
  'payment',
  'billing'
];

// Email regex for detecting emails in strings
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * Redacts sensitive data from objects and strings
 */
export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Replace emails with redacted format
    return data.replace(EMAIL_REGEX, '[email-redacted]');
  }

  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(redactSensitiveData);
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowercaseKey = key.toLowerCase();
      const isSensitive = SENSITIVE_PATTERNS.some(pattern => 
        lowercaseKey.includes(pattern)
      );

      if (isSensitive) {
        redacted[key] = '[redacted]';
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    return redacted;
  }

  return data;
}

/**
 * Safe logging function that redacts sensitive data
 */
export function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
  
  if (data) {
    const redactedData = redactSensitiveData(data);
    logger[level](message, redactedData);
  } else {
    logger[level](message);
  }
}

/**
 * Specific user data redaction for safe logging
 */
export function redactUserData(user: User | null | undefined) {
  if (!user) return user;
  
  return {
    id: user.id,
    username: user.username,
    tier: user.tier,
    isAdmin: user.isAdmin,
    // Redact sensitive fields
    email: user.email ? '[email-redacted]' : undefined,
    hasEmail: Boolean(user.email),
    emailVerified: user.emailVerified
  };
}

/**
 * Formats log arguments for Winston logger spread operator
 * Handles both string messages and error objects
 * 
 * Usage: logger.error(...formatLogArgs('Error message', error))
 */
export function formatLogArgs(message: string, data?: unknown): [string, Record<string, unknown>?] {
  if (data === undefined) {
    return [message];
  }
  
  // If data is an Error object, extract message and stack
  if (data instanceof Error) {
    return [message, { error: data.message, stack: data.stack }];
  }
  
  // If data is already an object, redact and use it
  if (typeof data === 'object' && data !== null) {
    return [message, redactSensitiveData(data) as Record<string, unknown>];
  }
  
  // For primitives, wrap in object
  return [message, { value: data }];
}