/**
 * Phase 5: Queue Provider Abstraction
 * Universal queue interface supporting both Redis (BullMQ) and PostgreSQL backends
 */

export interface QueueJobOptions {
  delay?: number; // milliseconds
  attempts?: number;
  priority?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
}

export interface QueueJobHandler<T = any> {
  (payload: T, jobId: string): Promise<void>;
}

export interface QueueFailureStats {
  failureRate: number; // 0-1
  totalJobs: number;
  failedJobs: number;
  windowMinutes: number;
}

export interface IQueue {
  /**
   * Add a job to the queue
   */
  enqueue<T = any>(
    queueName: string,
    payload: T,
    options?: QueueJobOptions
  ): Promise<string>; // Returns job ID

  /**
   * Register a processor for a queue
   */
  process<T = any>(
    queueName: string,
    handler: QueueJobHandler<T>,
    options?: { concurrency?: number }
  ): Promise<void>;

  /**
   * Pause a queue (stops processing new jobs)
   */
  pause(queueName: string): Promise<void>;

  /**
   * Resume a paused queue
   */
  resume(queueName: string): Promise<void>;

  /**
   * Get failure rate for a queue within a time window
   */
  getFailureRate(queueName: string, windowMinutes: number): Promise<QueueFailureStats>;

  /**
   * Get pending job count for monitoring
   */
  getPendingCount(queueName: string): Promise<number>;

  /**
   * Get active job count for monitoring (optional)
   */
  getActiveCount?(queueName: string): Promise<number>;

  /**
   * Get failed job count for monitoring (optional)
   */
  getFailedCount?(queueName: string): Promise<number>;

  /**
   * Get delayed job count for monitoring (optional)
   */
  getDelayedCount?(queueName: string): Promise<number>;

  /**
   * Get completed job count for monitoring (optional)
   */
  getCompletedCount?(queueName: string): Promise<number>;

  /**
   * Get recent jobs for monitoring (optional)
   */
  getRecentJobs?(queueName: string, limit?: number): Promise<any[]>;

  /**
   * Retry failed jobs (optional)
   */
  retryFailedJobs?(queueName: string): Promise<number>;

  /**
   * Clear queue (optional)
   */
  clearQueue?(queueName: string): Promise<void>;

  /**
   * Initialize the queue backend
   */
  initialize(): Promise<void>;

  /**
   * Cleanup and close connections
   */
  close(): Promise<void>;
}