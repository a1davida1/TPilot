/**
 * Comprehensive health check endpoints for monitoring
 * Provides detailed status of all system components
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import { cronManager } from '../lib/scheduler/cron-manager.js';
import Redis from 'ioredis';
import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const healthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis?: ServiceHealth;
    imgur?: ServiceHealth;
    reddit?: ServiceHealth;
    ai?: ServiceHealth;
    scheduler: ServiceHealth;
  };
  metrics: {
    memory: MemoryMetrics;
    cpu: CPUMetrics;
    disk?: DiskMetrics;
  };
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  details?: Record<string, unknown>;
  error?: string;
}

interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
}

interface CPUMetrics {
  loadAverage: number[];
  cores: number;
}

interface DiskMetrics {
  used: number;
  total: number;
  percentage: number;
}

/**
 * Basic health check - for load balancers
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Liveness probe - checks if service is alive
 */
healthRouter.get('/health/live', (_req: Request, res: Response) => {
  res.json({ 
    status: 'alive',
    pid: process.pid,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness probe - checks if service is ready to serve traffic
 */
healthRouter.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    // Quick DB check
    await db.execute(sql`SELECT 1`);
    
    res.json({ 
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({ 
      status: 'not_ready',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Comprehensive health check - detailed status of all components
 */
healthRouter.get('/health/detailed', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: await checkDatabase(),
      scheduler: checkScheduler()
    },
    metrics: {
      memory: getMemoryMetrics(),
      cpu: getCPUMetrics()
    }
  };

  // Check optional services
  if (process.env.REDIS_URL) {
    health.services.redis = await checkRedis();
  }
  
  if (process.env.IMGUR_CLIENT_ID) {
    health.services.imgur = await checkImgur();
  }
  
  if (process.env.REDDIT_CLIENT_ID) {
    health.services.reddit = await checkReddit();
  }
  
  if (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY) {
    health.services.ai = await checkAI();
  }

  // Get disk metrics if available
  const diskMetrics = await getDiskMetrics();
  if (diskMetrics) {
    health.metrics.disk = diskMetrics;
  }

  // Determine overall health status
  const serviceStatuses = Object.values(health.services).filter(Boolean).map(s => s.status);
  if (serviceStatuses.some(s => s === 'down')) {
    health.status = 'unhealthy';
  } else if (serviceStatuses.some(s => s === 'degraded')) {
    health.status = 'degraded';
  }

  const responseTime = Date.now() - startTime;
  logger.debug('Health check completed', { 
    status: health.status, 
    responseTime 
  });

  const statusCode = health.status === 'unhealthy' ? 503 : 
                     health.status === 'degraded' ? 200 : 200;
  
  res.status(statusCode).json(health);
});

/**
 * Database health check
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const latency = Date.now() - start;
    
    return {
      status: latency > 1000 ? 'degraded' : 'up',
      latency,
      details: {
        userCount: result.rows[0]?.count || 0
      }
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Database health check failed', { error: message });
    return {
      status: 'down',
      error: message
    };
  }
}

/**
 * Redis health check
 */
async function checkRedis(): Promise<ServiceHealth> {
  if (!process.env.REDIS_URL) {
    return { status: 'up', details: { configured: false } };
  }

  const start = Date.now();
  try {
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
      connectTimeout: 1000
    });
    await redis.ping();
    const latency = Date.now() - start;
    await redis.disconnect();
    
    return {
      status: latency > 100 ? 'degraded' : 'up',
      latency
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Redis health check failed', { error: message });
    return {
      status: 'down',
      error: message
    };
  }
}

/**
 * Scheduler health check
 */
function checkScheduler(): ServiceHealth {
  try {
    const status = cronManager.getStatus();
    return {
      status: status.isRunning ? 'up' : 'down',
      details: status
    };
  } catch (error: unknown) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Imgur API health check
 */
async function checkImgur(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.imgur.com/3/credits', {
      headers: {
        'Authorization': `Client-ID ${process.env.IMGUR_CLIENT_ID}`
      }
    });
    
    const latency = Date.now() - start;
    
    if (!response.ok) {
      return {
        status: 'down',
        error: `Imgur API returned ${response.status}`
      };
    }
    
    const data = await response.json();
    
    return {
      status: latency > 2000 ? 'degraded' : 'up',
      latency,
      details: {
        remaining: data.data?.ClientRemaining,
        limit: data.data?.ClientLimit
      }
    };
  } catch (error: any) {
    return {
      status: 'down',
      error: error.message
    };
  }
}

/**
 * Reddit API health check
 */
async function checkReddit(): Promise<ServiceHealth> {
  // For now, just check if credentials exist
  // In production, you'd want to make a test API call
  return {
    status: process.env.REDDIT_CLIENT_ID ? 'up' : 'down',
    details: {
      configured: !!process.env.REDDIT_CLIENT_ID
    }
  };
}

/**
 * AI service health check
 */
async function checkAI(): Promise<ServiceHealth> {
  // Basic check for API key presence
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  
  return {
    status: (hasOpenRouter || hasOpenAI) ? 'up' : 'down',
    details: {
      openRouter: hasOpenRouter,
      openAI: hasOpenAI
    }
  };
}

/**
 * Get memory metrics
 */
function getMemoryMetrics(): MemoryMetrics {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  
  return {
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round((used / total) * 100)
  };
}

/**
 * Get CPU metrics
 */
function getCPUMetrics(): CPUMetrics {
  return {
    loadAverage: os.loadavg(),
    cores: os.cpus().length
  };
}

/**
 * Get disk metrics (Linux/Mac only)
 */
async function getDiskMetrics(): Promise<DiskMetrics | null> {
  if (process.platform === 'win32') {
    return null;
  }
  
  try {
    const { stdout } = await execAsync('df -k /');
    const lines = stdout.trim().split('\n');
    const parts = lines[1].split(/\s+/);
    
    const total = parseInt(parts[1]) * 1024; // Convert to bytes
    const used = parseInt(parts[2]) * 1024;
    const percentage = parseInt(parts[4]);
    
    return {
      used: Math.round(used / 1024 / 1024 / 1024), // GB
      total: Math.round(total / 1024 / 1024 / 1024), // GB
      percentage
    };
  } catch (error) {
    logger.debug('Failed to get disk metrics', { error });
    return null;
  }
}

/**
 * Metrics endpoint for monitoring systems (Prometheus format)
 */
healthRouter.get('/metrics', async (_req: Request, res: Response) => {
  const metrics: string[] = [];
  
  // Basic metrics
  metrics.push(`# HELP app_uptime_seconds Application uptime in seconds`);
  metrics.push(`# TYPE app_uptime_seconds gauge`);
  metrics.push(`app_uptime_seconds ${process.uptime()}`);
  
  // Memory metrics
  const memory = getMemoryMetrics();
  metrics.push(`# HELP app_memory_used_mb Memory used in MB`);
  metrics.push(`# TYPE app_memory_used_mb gauge`);
  metrics.push(`app_memory_used_mb ${memory.used}`);
  
  // CPU metrics
  const cpu = getCPUMetrics();
  metrics.push(`# HELP app_cpu_load_average CPU load average`);
  metrics.push(`# TYPE app_cpu_load_average gauge`);
  metrics.push(`app_cpu_load_average{period="1m"} ${cpu.loadAverage[0]}`);
  metrics.push(`app_cpu_load_average{period="5m"} ${cpu.loadAverage[1]}`);
  metrics.push(`app_cpu_load_average{period="15m"} ${cpu.loadAverage[2]}`);
  
  // Service health metrics
  const dbHealth = await checkDatabase();
  metrics.push(`# HELP app_service_health Service health status`);
  metrics.push(`# TYPE app_service_health gauge`);
  metrics.push(`app_service_health{service="database"} ${dbHealth.status === 'up' ? 1 : 0}`);
  
  if (dbHealth.latency) {
    metrics.push(`# HELP app_service_latency_ms Service latency in milliseconds`);
    metrics.push(`# TYPE app_service_latency_ms gauge`);
    metrics.push(`app_service_latency_ms{service="database"} ${dbHealth.latency}`);
  }
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
});

export { healthRouter };