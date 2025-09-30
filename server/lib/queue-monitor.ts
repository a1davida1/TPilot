import { getQueueBackend } from "./queue-factory.js";
import { QUEUE_NAMES } from "./queue/index.js";

export interface QueueMetrics {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  failureRate: number;
  throughput: number; // jobs/hour
  avgProcessingTime: number; // milliseconds
  lastProcessed?: Date;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export interface WorkerMetrics {
  name: string;
  status: 'running' | 'stopped' | 'error';
  concurrency: number;
  processed: number;
  failed: number;
  uptime: number; // milliseconds
  memoryUsage: number; // bytes
  lastActivity?: Date;
}

export class QueueMonitor {
  private static instance: QueueMonitor;
  private metrics: Map<string, QueueMetrics> = new Map();
  private workerMetrics: Map<string, WorkerMetrics> = new Map();
  private monitoring = false;
  private intervalId?: NodeJS.Timeout;

  public static getInstance(): QueueMonitor {
    if (!QueueMonitor.instance) {
      QueueMonitor.instance = new QueueMonitor();
    }
    return QueueMonitor.instance;
  }

  async startMonitoring(intervalMs: number = 30000) { // 30 seconds default
    if (this.monitoring) return;

    console.error('🔍 Starting queue monitoring...');
    this.monitoring = true;

    // Initial collection
    await this.collectMetrics();

    // Set up periodic collection
    this.intervalId = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Queue monitoring error:', error);
      }
    }, intervalMs);

    console.error(`✅ Queue monitoring started (interval: ${intervalMs}ms)`);
  }

  stopMonitoring() {
    if (!this.monitoring) return;

    console.error('🛑 Stopping queue monitoring...');
    this.monitoring = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.error('✅ Queue monitoring stopped');
  }

  private async collectMetrics() {
    const queue = getQueueBackend();
    const now = new Date();

    for (const [queueKey, queueName] of Object.entries(QUEUE_NAMES)) {
      try {
        // Collect basic queue stats
        const [pending, active, failed, delayed] = await Promise.all([
          queue.getPendingCount(queueName),
          queue.getActiveCount ? queue.getActiveCount(queueName) : 0,
          queue.getFailedCount ? queue.getFailedCount(queueName) : 0,
          queue.getDelayedCount ? queue.getDelayedCount(queueName) : 0,
        ]);

        // Calculate failure rate (last hour)
        const failureStats = await queue.getFailureRate(queueName, 60);
        
        // Get processing stats
        const processingStats = await this.getProcessingStats(queueName);

        const metrics: QueueMetrics = {
          pending,
          active,
          completed: processingStats.completed,
          failed,
          delayed,
          failureRate: failureStats.failureRate,
          throughput: processingStats.throughput,
          avgProcessingTime: processingStats.avgProcessingTime,
          lastProcessed: processingStats.lastProcessed,
          healthStatus: this.determineHealthStatus(failureStats.failureRate, pending, active),
        };

        this.metrics.set(queueName, metrics);

      } catch (error) {
        console.error(`Failed to collect metrics for queue ${queueName}:`, error);
        
        // Set error state
        this.metrics.set(queueName, {
          pending: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          failureRate: 1.0, // 100% failure rate indicates error
          throughput: 0,
          avgProcessingTime: 0,
          healthStatus: 'critical',
        });
      }
    }

    // Update worker metrics
    await this.collectWorkerMetrics();
  }

  private async collectWorkerMetrics() {
    const workers = [
      { name: 'post-worker', concurrency: 2 },
      { name: 'metrics-worker', concurrency: 3 },
      { name: 'ai-promo-worker', concurrency: 1 },
      { name: 'dunning-worker', concurrency: 1 },
      { name: 'community-sync-worker', concurrency: 1 },
    ];

    for (const worker of workers) {
      try {
        // In a full implementation, this would collect actual worker stats
        const existing = this.workerMetrics.get(worker.name);
        const uptime = existing ? existing.uptime + 30000 : 30000; // Add 30s

        const workerMetrics: WorkerMetrics = {
          name: worker.name,
          status: 'running',
          concurrency: worker.concurrency,
          processed: (existing?.processed || 0) + Math.floor(Math.random() * 5), // Mock data
          failed: existing?.failed || 0,
          uptime,
          memoryUsage: process.memoryUsage().heapUsed / worker.concurrency, // Rough estimate
          lastActivity: new Date(),
        };

        this.workerMetrics.set(worker.name, workerMetrics);

      } catch (error) {
        console.error(`Failed to collect worker metrics for ${worker.name}:`, error);
      }
    }
  }

  private async getProcessingStats(queueName: string) {
    try {
      const queue = getQueueBackend();
      
      // Get completed job count from the last 24 hours
      const completedJobs = queue.getCompletedCount ? 
        await queue.getCompletedCount(queueName) : 
        0;
      
      // Calculate throughput (jobs per hour over last 24 hours)
      const throughput = Math.floor(Number(completedJobs) / 24);
      
      // Get recent job timing data if available
      const recentJobs = queue.getRecentJobs ? (await queue.getRecentJobs(queueName, 10)) as Array<{ processedOn?: number; timestamp?: number }> : [];
      
      // Calculate average processing time from recent jobs
      const avgProcessingTime = Array.isArray(recentJobs) && recentJobs.length > 0 ?
        recentJobs.reduce((sum: number, job) => {
          const duration =
            job.processedOn && job.timestamp
              ? job.processedOn - job.timestamp
              : 1000;
          return sum + duration;
        }, 0) / recentJobs.length :
        1000; // Default 1 second
      
      // Get last processed job timestamp
      const lastProcessedJob = recentJobs[0];
      const lastProcessed = lastProcessedJob?.processedOn
        ? new Date(lastProcessedJob.processedOn)
        : new Date();
      
      return {
        completed: completedJobs,
        throughput,
        avgProcessingTime: Math.floor(avgProcessingTime),
        lastProcessed,
      };
    } catch (error) {
      console.error('Error getting processing stats:', error);
      // Return basic stats if queue backend doesn't support detailed metrics
      return {
        completed: 0,
        throughput: 0,
        avgProcessingTime: 0,
        lastProcessed: new Date(),
      };
    }
  }

  private determineHealthStatus(failureRate: number, pending: number, active: number): 'healthy' | 'warning' | 'critical' {
    if (failureRate > 0.5) return 'critical'; // >50% failure rate
    if (failureRate > 0.2 || pending > 100) return 'warning'; // >20% failure or high pending
    if (active === 0 && pending > 0) return 'warning'; // Stalled queue
    return 'healthy';
  }

  // Public API for dashboard
  getQueueMetrics(): Record<string, QueueMetrics> {
    const result: Record<string, QueueMetrics> = {};
    for (const [queueName, metrics] of this.metrics.entries()) {
      result[queueName] = { ...metrics };
    }
    return result;
  }

  getWorkerMetrics(): Record<string, WorkerMetrics> {
    const result: Record<string, WorkerMetrics> = {};
    for (const [workerName, metrics] of this.workerMetrics.entries()) {
      result[workerName] = { ...metrics };
    }
    return result;
  }

  getSystemHealth(): {
    overall: 'healthy' | 'warning' | 'critical';
    queues: number;
    workers: number;
    totalPending: number;
    totalFailed: number;
    avgFailureRate: number;
  } {
    const queueMetrics = Array.from(this.metrics.values());
    const workerMetrics = Array.from(this.workerMetrics.values());

    const totalPending = queueMetrics.reduce((sum, m) => sum + m.pending, 0);
    const totalFailed = queueMetrics.reduce((sum, m) => sum + m.failed, 0);
    const avgFailureRate = queueMetrics.length > 0 
      ? queueMetrics.reduce((sum, m) => sum + m.failureRate, 0) / queueMetrics.length 
      : 0;

    const criticalQueues = queueMetrics.filter(m => m.healthStatus === 'critical').length;
    const warningQueues = queueMetrics.filter(m => m.healthStatus === 'warning').length;
    const stoppedWorkers = workerMetrics.filter(w => w.status !== 'running').length;

    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalQueues > 0 || stoppedWorkers > 0) {
      overall = 'critical';
    } else if (warningQueues > 0 || avgFailureRate > 0.1) {
      overall = 'warning';
    }

    return {
      overall,
      queues: queueMetrics.length,
      workers: workerMetrics.length,
      totalPending,
      totalFailed,
      avgFailureRate: Math.round(avgFailureRate * 100) / 100,
    };
  }

  // Admin actions
  async pauseQueue(queueName: string): Promise<boolean> {
    try {
      const { pauseQueue } = await import("./queue/index.js");
      await pauseQueue(queueName);
      console.error(`⏸️ Queue ${queueName} paused`);
      return true;
    } catch (error) {
      console.error(`Failed to pause queue ${queueName}:`, error);
      return false;
    }
  }

  async resumeQueue(queueName: string): Promise<boolean> {
    try {
      const { resumeQueue } = await import("./queue/index.js");
      await resumeQueue(queueName);
      console.error(`▶️ Queue ${queueName} resumed`);
      return true;
    } catch (error) {
      console.error(`Failed to resume queue ${queueName}:`, error);
      return false;
    }
  }

  async retryFailedJobs(queueName: string): Promise<number> {
    try {
      const queue = getQueueBackend();
      if (queue.retryFailedJobs) {
        const retried = await queue.retryFailedJobs(queueName);
        console.error(`🔄 Retried ${retried} failed jobs in queue ${queueName}`);
        return retried;
      }
      return 0;
    } catch (error) {
      console.error(`Failed to retry jobs in queue ${queueName}:`, error);
      return 0;
    }
  }

  async clearQueue(queueName: string): Promise<boolean> {
    try {
      const queue = getQueueBackend();
      if (queue.clearQueue) {
        await queue.clearQueue(queueName);
        console.error(`🧹 Cleared queue ${queueName}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to clear queue ${queueName}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const queueMonitor = QueueMonitor.getInstance();