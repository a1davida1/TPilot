import { Request, Response, NextFunction } from 'express';

interface PerformanceMetric {
  path: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  userAgent?: string;
  userId?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private slowRequestThreshold = 1000; // 1 second
  private criticalThreshold = 3000; // 3 seconds

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      // Store original end function
      const originalEnd = res.end;
      
      // Override end function to capture metrics
      res.end = (...args: any[]) => {
        // Restore original end function
        res.end = originalEnd;
        
        // Calculate duration
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        
        // Create metric
        const metric: PerformanceMetric = {
          path: req.path,
          method: req.method,
          duration,
          statusCode: res.statusCode,
          timestamp: new Date(),
          memoryUsage: process.memoryUsage(),
          userAgent: req.get('user-agent'),
          userId: (req as any).user?.id
        };
        
        // Store metric
        this.recordMetric(metric);
        
        // Log slow requests
        if (duration > this.slowRequestThreshold) {
          this.handleSlowRequest(metric);
        }
        
        // Alert on critical performance issues
        if (duration > this.criticalThreshold) {
          this.handleCriticalPerformance(metric);
        }
        
        // Call original end function
        return originalEnd.apply(res, args);
      };
      
      next();
    };
  }

  private recordMetric(metric: PerformanceMetric) {
    // Store metric
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development' && metric.duration > 500) {
      console.log(`[PERF] ${metric.method} ${metric.path}: ${metric.duration.toFixed(2)}ms`);
    }
  }

  private handleSlowRequest(metric: PerformanceMetric) {
    console.warn('[SLOW REQUEST]', {
      path: metric.path,
      method: metric.method,
      duration: `${metric.duration.toFixed(2)}ms`,
      statusCode: metric.statusCode,
      timestamp: metric.timestamp.toISOString()
    });
    
    // In production, send alert
    if (process.env.NODE_ENV === 'production') {
      // this.sendSlowRequestAlert(metric);
    }
  }

  private handleCriticalPerformance(metric: PerformanceMetric) {
    console.error('[CRITICAL PERFORMANCE]', {
      path: metric.path,
      method: metric.method,
      duration: `${metric.duration.toFixed(2)}ms`,
      statusCode: metric.statusCode,
      memoryUsage: {
        heapUsed: `${(metric.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(metric.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`
      }
    });
    
    // In production, send immediate alert
    if (process.env.NODE_ENV === 'production') {
      // this.sendCriticalAlert(metric);
    }
  }

  // Analytics methods
  getAverageResponseTime(path?: string): number {
    const relevantMetrics = path 
      ? this.metrics.filter(m => m.path === path)
      : this.metrics;
    
    if (relevantMetrics.length === 0) return 0;
    
    const sum = relevantMetrics.reduce((acc, m) => acc + m.duration, 0);
    return sum / relevantMetrics.length;
  }

  getP95ResponseTime(): number {
    if (this.metrics.length === 0) return 0;
    
    const sorted = [...this.metrics].sort((a, b) => a.duration - b.duration);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index].duration;
  }

  getP99ResponseTime(): number {
    if (this.metrics.length === 0) return 0;
    
    const sorted = [...this.metrics].sort((a, b) => a.duration - b.duration);
    const index = Math.floor(sorted.length * 0.99);
    return sorted[index].duration;
  }

  getSlowestEndpoints(limit: number = 10): Array<{path: string, avgDuration: number, count: number}> {
    const endpointMap = new Map<string, {totalDuration: number, count: number}>();
    
    this.metrics.forEach(metric => {
      const key = `${metric.method} ${metric.path}`;
      const existing = endpointMap.get(key) || {totalDuration: 0, count: 0};
      endpointMap.set(key, {
        totalDuration: existing.totalDuration + metric.duration,
        count: existing.count + 1
      });
    });
    
    const endpoints = Array.from(endpointMap.entries()).map(([path, data]) => ({
      path,
      avgDuration: data.totalDuration / data.count,
      count: data.count
    }));
    
    return endpoints
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }

  getErrorRate(): number {
    if (this.metrics.length === 0) return 0;
    
    const errors = this.metrics.filter(m => m.statusCode >= 400).length;
    return (errors / this.metrics.length) * 100;
  }

  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  // Reporting
  generateReport(): any {
    return {
      summary: {
        totalRequests: this.metrics.length,
        averageResponseTime: this.getAverageResponseTime(),
        p95ResponseTime: this.getP95ResponseTime(),
        p99ResponseTime: this.getP99ResponseTime(),
        errorRate: this.getErrorRate(),
        memoryUsage: this.getMemoryUsage()
      },
      slowestEndpoints: this.getSlowestEndpoints(),
      recentSlowRequests: this.metrics
        .filter(m => m.duration > this.slowRequestThreshold)
        .slice(-10)
        .map(m => ({
          path: m.path,
          method: m.method,
          duration: m.duration,
          timestamp: m.timestamp
        }))
    };
  }

  // Cleanup
  reset() {
    this.metrics = [];
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export middleware function
export const performanceMiddleware = performanceMonitor.middleware();

// Health check endpoint data
export function getHealthMetrics() {
  const memory = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    status: 'healthy',
    uptime: {
      seconds: uptime,
      formatted: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
    },
    memory: {
      used: `${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      total: `${(memory.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      percentage: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2)
    },
    performance: performanceMonitor.generateReport(),
    timestamp: new Date().toISOString()
  };
}