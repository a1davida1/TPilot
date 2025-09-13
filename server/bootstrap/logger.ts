import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Common log format for file transports
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Common format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, requestId, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    const stackStr = stack ? `\n${stack}` : "";
    return `${timestamp} [${level}]${requestId ? ` [${requestId}]` : ""} ${message}${metaStr}${stackStr}`;
  })
);

// Configure log rotation for different levels
const createRotatingTransport = (level: string, filename: string) => {
  return new DailyRotateFile({
    level,
    filename: path.join(logsDir, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m', // Rotate when file reaches 20MB
    maxFiles: '14d', // Keep logs for 14 days
    format: fileFormat,
    auditFile: path.join(logsDir, `.${filename}-audit.json`),
    createSymlink: true,
    symlinkName: `${filename}-current.log`
  });
};

// Create transports array
const transports: winston.transport[] = [
  // Console transport (always enabled)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      consoleFormat
    )
  })
];

// Add file transports in non-test environments
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    // Combined logs (info and above)
    createRotatingTransport('info', 'combined'),
    
    // Error logs only
    createRotatingTransport('error', 'error'),
    
    // Debug logs (in development)
    ...(process.env.NODE_ENV === 'development' ? [
      createRotatingTransport('debug', 'debug')
    ] : []),
    
    // Security-specific logs
    new DailyRotateFile({
      level: 'warn',
      filename: path.join(logsDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m', // Larger size for security logs
      maxFiles: '30d', // Keep security logs longer
      format: winston.format.combine(
        fileFormat,
        winston.format((info) => {
          // Only log security-related events
          if (info.security || info.level === 'warn' || info.level === 'error') {
            return info;
          }
          return false;
        })()
      ),
      auditFile: path.join(logsDir, '.security-audit.json'),
      createSymlink: true,
      symlinkName: 'security-current.log'
    }),
    
    // Performance/metrics logs
    new DailyRotateFile({
      level: 'info',
      filename: path.join(logsDir, 'metrics-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '30m',
      maxFiles: '7d', // Shorter retention for metrics
      format: winston.format.combine(
        fileFormat,
        winston.format((info) => {
          // Only log metrics-related events
          if (info.metrics || info.performance || info.requestId) {
            return info;
          }
          return false;
        })()
      ),
      auditFile: path.join(logsDir, '.metrics-audit.json'),
      createSymlink: true,
      symlinkName: 'metrics-current.log'
    })
  );
}

// Logger configuration for the application
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: fileFormat,
  transports,
  
  // Handle uncaught exceptions and rejections with file logging
  exceptionHandlers: [
    new winston.transports.Console(),
    ...(process.env.NODE_ENV !== 'test' ? [
      new DailyRotateFile({
        filename: path.join(logsDir, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d', // Keep exception logs longer
        format: fileFormat
      })
    ] : [])
  ],
  
  rejectionHandlers: [
    new winston.transports.Console(),
    ...(process.env.NODE_ENV !== 'test' ? [
      new DailyRotateFile({
        filename: path.join(logsDir, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: fileFormat
      })
    ] : [])
  ],
  
  exitOnError: false // Don't exit on handled exceptions
});

// Enhanced SENTRY_DSN format validation
export function validateSentryDSN(dsn: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!dsn || typeof dsn !== 'string') {
    errors.push('DSN must be a non-empty string');
    return { isValid: false, errors };
  }
  
  // Basic URL format check
  if (!dsn.startsWith('https://')) {
    errors.push('DSN must start with https://');
  }
  
  try {
    const url = new URL(dsn);
    
    // Check for required components
    if (!url.username) {
      errors.push('DSN missing public key (username part)');
    }
    
    if (!url.password) {
      errors.push('DSN missing secret key (password part)');
    }
    
    if (!url.hostname) {
      errors.push('DSN missing hostname');
    }
    
    if (!url.pathname || url.pathname === '/') {
      errors.push('DSN missing project ID in pathname');
    }
    
    // Validate hostname format (should be sentry.io or custom domain)
    if (url.hostname && !url.hostname.includes('.')) {
      errors.push('DSN hostname appears invalid (should contain domain)');
    }
    
    // Check for common mistake: including protocol in wrong place
    if (dsn.includes('http://')) {
      errors.push('DSN contains insecure http:// protocol');
    }
    
    // Validate project ID is numeric (Sentry project IDs are numbers)
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const projectId = pathParts[pathParts.length - 1];
      if (!/^\d+$/.test(projectId)) {
        errors.push('DSN project ID should be numeric');
      }
    }
    
  } catch (urlError) {
    errors.push(`DSN is not a valid URL: ${urlError.message}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Additional Sentry configuration validation
export function validateSentryConfig(): { isValid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV;
  
  if (!dsn) {
    warnings.push('SENTRY_DSN not configured - error tracking disabled');
    return { isValid: true, warnings, errors }; // Not an error, just not configured
  }
  
  // Validate DSN format
  const dsnValidation = validateSentryDSN(dsn);
  if (!dsnValidation.isValid) {
    errors.push(...dsnValidation.errors);
  }
  
  // Environment-specific warnings
  if (environment === 'development' && dsn) {
    warnings.push('Sentry enabled in development - consider disabling for local development');
  }
  
  if (environment === 'production' && !dsn) {
    errors.push('SENTRY_DSN should be configured in production for error tracking');
  }
  
  // Check for sample rate configuration
  const sampleRate = process.env.SENTRY_SAMPLE_RATE;
  if (sampleRate) {
    const rate = parseFloat(sampleRate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      errors.push('SENTRY_SAMPLE_RATE must be a number between 0 and 1');
    }
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

// Initialize Sentry with comprehensive validation
export async function initializeSentry() {
  let Sentry: unknown = undefined;
  
  // Validate Sentry configuration
  const configValidation = validateSentryConfig();
  
  // Log warnings
  configValidation.warnings.forEach(warning => {
    logger.warn(`Sentry configuration warning: ${warning}`);
  });
  
  // Log errors and exit early if invalid
  if (!configValidation.isValid) {
    configValidation.errors.forEach(error => {
      logger.error(`Sentry configuration error: ${error}`);
    });
    return undefined;
  }
  
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return undefined; // Not configured, but that's okay
  }
  
  try {
    // Dynamic import with proper error handling for optional dependency
    let SentryModule: (typeof import("@sentry/node")) | null = null;
    try {
      SentryModule = await import("@sentry/node");
    } catch {
      SentryModule = null;
    }
    if (SentryModule) {
      Sentry = SentryModule;
      
      // Enhanced Sentry configuration
      const sentryConfig: unknown = {
        dsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1'),
        profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        
        // Enhanced error filtering
        beforeSend(event: unknown, hint: unknown) {
          // Filter out non-critical errors in development
          if (process.env.NODE_ENV === 'development') {
            // Don't send client-side errors in development
            if ((event as any).request?.url?.includes('/_vite/')) {
              return null;
            }
          }
          
          // Filter out known non-critical errors
          const error = (hint as any)?.originalException;
          if (error?.message?.includes('ECONNRESET') || 
              error?.message?.includes('EPIPE')) {
            return null; // Don't send network errors
          }
          
          return event;
        },
        
        // Enhanced release tracking
        release: process.env.GIT_COMMIT_SHA,
        
        // Set user context
        initialScope: {
          tags: {
            component: 'backend',
            node_env: process.env.NODE_ENV
          }
        }
      };
      
      Sentry.init(sentryConfig);
      
      logger.info('Sentry initialized successfully', {
        environment: sentryConfig.environment,
        tracesSampleRate: sentryConfig.tracesSampleRate,
        release: sentryConfig.release
      });
      
    } else {
      logger.warn("Sentry module not available, continuing without error tracking");
    }
  } catch (err: unknown) {
    logger.error("Sentry initialization failed", { 
      error: err?.message || 'Unknown error',
      stack: err?.stack 
    });
  }
  
  return Sentry;
}

// Export a function to add request ID to logger context
export function createRequestLogger(requestId: string) {
  return {
    info: (message: string, meta: Record<string, unknown> = {}) =>
      logger.info(message, { requestId, ...meta }),
    warn: (message: string, meta: Record<string, unknown> = {}) =>
      logger.warn(message, { requestId, ...meta }),
    error: (message: string, meta: Record<string, unknown> = {}) =>
      logger.error(message, { requestId, ...meta }),
    debug: (message: string, meta: Record<string, unknown> = {}) =>
      logger.debug(message, { requestId, ...meta })
  };
}

// Security logging utility
export function logSecurityEvent(event: string, details?: unknown) {
  logger.warn(event, { security: true, ...(details as Record<string, unknown>) });
}

// Performance logging utility
export function logPerformanceMetric(metric: string, value: number, details?: unknown) {
  logger.info(`Performance: ${metric}`, { 
    metrics: true, 
    performance: true, 
    metric, 
    value, 
    ...details 
  });
}

// Manual log cleanup utility (for maintenance tasks)
export async function cleanupOldLogs(daysToKeep: number = 30) {
  const fs = await import('fs/promises');
  const glob = await import('glob').then(m => m.glob);
  
  try {
    const oldLogPattern = path.join(logsDir, `*-${new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}*.log*`);
    const oldFiles = await glob(oldLogPattern);
    
    for (const file of oldFiles) {
      await fs.unlink(file);
      logger.info('Cleaned up old log file', { file });
    }
    
    return { cleaned: oldFiles.length };
  } catch (error) {
    logger.error('Failed to cleanup old logs', { error: error.message });
    return { error: error.message };
  }
}

// Get log file information (for monitoring)
export async function getLogFileStats() {
  const fs = await import('fs/promises');
  
  try {
    const stats = {
      directory: logsDir,
      files: [] as Array<{ name: string; size: number; modified: Date }>
    };
    
    const files = await fs.readdir(logsDir);
    for (const file of files) {
      if (file.endsWith('.log') || file.endsWith('.log.gz')) {
        const filePath = path.join(logsDir, file);
        const stat = await fs.stat(filePath);
        stats.files.push({
          name: file,
          size: stat.size,
          modified: stat.mtime
        });
      }
    }
    
    return stats;
  } catch (error) {
    logger.error('Failed to get log file stats', { error: error.message });
    return { error: error.message };
  }
}