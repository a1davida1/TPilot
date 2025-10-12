/**
 * Observability Middleware
 * Adds correlation IDs, request/response logging, and performance metrics
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../bootstrap/logger.js';
import { performance } from 'perf_hooks';
import os from 'os';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: number;
      userId?: string;
      userTier?: string;
    }
  }
}

// Correlation ID middleware
export function correlationId(req: Request, res: Response, next: NextFunction) {
  // Use existing correlation ID from headers or generate new one
  req.correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  // Add to response headers
  res.setHeader('X-Correlation-ID', req.correlationId);
  
  // Store in async local storage for logging context
  logger.defaultMeta = { ...logger.defaultMeta, correlationId: req.correlationId };
  
  next();
}

// Request logging middleware
export function requestLogging(req: Request, res: Response, next: NextFunction) {
  req.startTime = performance.now();
  
  // Log request
  logger.info('Request received', {
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.userId,
    userTier: req.userTier
  });
  
  // Log response on finish
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = performance.now() - req.startTime;
    
    logger.info('Response sent', {
      correlationId: req.correlationId,
      statusCode: res.statusCode,
      duration: Math.round(duration),
      method: req.method,
      path: req.path,
      userId: req.userId
    });
    
    // Add performance metrics
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        correlationId: req.correlationId,
        duration: Math.round(duration),
        path: req.path
      });
    }
    
    originalEnd.apply(res, args);
  } as any;
  
  next();
}

// Error logging middleware
export function errorLogging(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Request error', {
    correlationId: req.correlationId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: req.userId
  });
  
  next(err);
}

// Performance metrics middleware
export function performanceMetrics(req: Request, res: Response, next: NextFunction) {
  const metrics = {
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    activeConnections: (req.app as any)._connections || 0
  };
  
  // Add metrics to response headers for monitoring
  res.setHeader('X-Memory-Used', Math.round(metrics.memoryUsage.heapUsed / 1048576) + 'MB');
  res.setHeader('X-Response-Time', '0ms'); // Will be updated when response ends
  
  // Update response time on finish
  const startTime = process.hrtime();
  res.on('finish', () => {
    const elapsed = process.hrtime(startTime);
    const responseTime = (elapsed[0] * 1000 + elapsed[1] / 1000000).toFixed(2);
    res.setHeader('X-Response-Time', responseTime + 'ms');
  });
  
  next();
}

// Health metrics for monitoring
export async function collectHealthMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory: {
        rss: process.memoryUsage().rss / 1048576,
        heapTotal: process.memoryUsage().heapTotal / 1048576,
        heapUsed: process.memoryUsage().heapUsed / 1048576,
        external: process.memoryUsage().external / 1048576
      },
      cpu: process.cpuUsage(),
      pid: process.pid
    },
    system: {
      loadAverage: process.platform === 'linux' ? os.loadavg() : [0, 0, 0],
      freeMemory: os.freemem() / 1048576,
      totalMemory: os.totalmem() / 1048576
    }
  };
  
  return metrics;
}

// Apply all observability middleware
export function applyObservability(app: any) {
  // Order matters: correlation ID first, then logging
  app.use(correlationId);
  app.use(requestLogging);
  app.use(performanceMetrics);
  
  // Error logging should be registered after routes
  app.use(errorLogging);
  
  logger.info('Observability middleware configured');
  
  // Start periodic health metrics collection (every minute)
  setInterval(async () => {
    const metrics = await collectHealthMetrics();
    logger.debug('Health metrics collected', metrics);
  }, 60000);
}
