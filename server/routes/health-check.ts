/**
 * Comprehensive health check for production monitoring
 * Use this for UptimeRobot, Pingdom, etc.
 */

import { Router, type Response, type Request } from 'express';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import Redis from 'ioredis';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: { ok: boolean; latency?: number; error?: string };
    redis: { ok: boolean; latency?: number; error?: string };
    sentry: { ok: boolean; configured: boolean };
    imgur: { ok: boolean; configured: boolean };
    reddit: { ok: boolean; configured: boolean };
    openrouter: { ok: boolean; configured: boolean };
    stripe: { ok: boolean; configured: boolean };
    memory: { ok: boolean; usage: string; limit: string };
  };
  tier_limits: {
    free: { posts: number; captions: number; scheduling: boolean };
    starter: { posts: number; captions: number; scheduling: boolean };
    pro: { posts: number; captions: number; scheduling: number };
    premium: { posts: number; captions: number; scheduling: number };
  };
}

/**
 * GET /api/health
 * Basic health check - returns 200 if service is up
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Quick DB check
    await db.execute(sql`SELECT 1`);
    res.status(200).json({ 
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/detailed
 * Comprehensive health check with all subsystem status
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: { ok: false },
      redis: { ok: false },
      sentry: { 
        ok: true, 
        configured: !!process.env.SENTRY_DSN 
      },
      imgur: { 
        ok: true,
        configured: !!process.env.IMGUR_CLIENT_ID 
      },
      reddit: { 
        ok: true,
        configured: !!process.env.REDDIT_CLIENT_ID 
      },
      openrouter: { 
        ok: true,
        configured: !!process.env.OPENROUTER_API_KEY 
      },
      stripe: { 
        ok: true,
        configured: !!process.env.STRIPE_SECRET_KEY 
      },
      memory: {
        ok: true,
        usage: '0MB',
        limit: '0MB'
      }
    },
    tier_limits: {
      free: { posts: 3, captions: 5, scheduling: false },
      starter: { posts: 10, captions: 50, scheduling: false },
      pro: { posts: 100, captions: 500, scheduling: 7 },
      premium: { posts: 9999, captions: 9999, scheduling: 30 }
    }
  };

  // Database check
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    health.checks.database = {
      ok: true,
      latency: Date.now() - dbStart
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.database = {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    logger.error('Health check: Database failed', { error });
  }

  // Redis check
  if (process.env.REDIS_URL) {
    try {
      const redisStart = Date.now();
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null,
        connectTimeout: 1000
      });
      await redis.ping();
      await redis.quit();
      health.checks.redis = {
        ok: true,
        latency: Date.now() - redisStart
      };
    } catch (error) {
      health.checks.redis = {
        ok: false,
        error: error instanceof Error ? error.message : 'Redis connection failed'
      };
    }
  } else {
    health.checks.redis = {
      ok: true,
      error: 'Not configured (using PG queue)'
    };
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const maxMemory = 512 * 1024 * 1024; // 512MB default
  health.checks.memory = {
    ok: memUsage.heapUsed < maxMemory * 0.9, // Alert at 90% usage
    usage: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    limit: `${Math.round(maxMemory / 1024 / 1024)}MB`
  };

  // Determine overall status
  const criticalChecks = [health.checks.database];
  const hasFailure = criticalChecks.some(check => !check.ok);
  
  if (hasFailure) {
    health.status = 'unhealthy';
  } else if (!health.checks.sentry.configured || !health.checks.stripe.configured) {
    health.status = 'degraded';
  }

  // Add response time
  const responseTime = Date.now() - startTime;
  
  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json({
    ...health,
    responseTime: `${responseTime}ms`
  });
});

/**
 * GET /api/health/ready
 * Kubernetes/Docker readiness probe
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all required services are configured
    const required = [
      process.env.DATABASE_URL,
      process.env.JWT_SECRET,
      process.env.SESSION_SECRET
    ];
    
    const allConfigured = required.every(v => !!v);
    
    if (!allConfigured) {
      return res.status(503).json({ 
        ready: false,
        reason: 'Missing required configuration'
      });
    }
    
    // Quick DB check
    await db.execute(sql`SELECT 1`);
    
    res.status(200).json({ 
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      ready: false,
      reason: error instanceof Error ? error.message : 'Service not ready'
    });
  }
});

/**
 * GET /api/health/live
 * Kubernetes/Docker liveness probe
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple check - is the process alive?
  res.status(200).json({ 
    alive: true,
    pid: process.pid,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

export { router as healthRouter };
