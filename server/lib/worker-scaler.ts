import { queueMonitor } from "./queue-monitor.js";
import { QUEUE_NAMES } from "./queue/index.js";
import { logger } from "../middleware/security.js";

export interface ScalingConfig {
  minConcurrency: number;
  maxConcurrency: number;
  scaleUpThreshold: number; // pending jobs threshold
  scaleDownThreshold: number; // time in ms with low activity
  cooldownPeriod: number; // time in ms between scaling actions
}

export interface WorkerScalingState {
  currentConcurrency: number;
  targetConcurrency: number;
  lastScalingAction?: Date;
  pendingJobs: number;
  isScaling: boolean;
}

export class WorkerScaler {
  private static instance: WorkerScaler;
  private scaling = false;
  private intervalId?: NodeJS.Timeout;
  private scalingStates: Map<string, WorkerScalingState> = new Map();
  
  private defaultConfig: ScalingConfig = {
    minConcurrency: 1,
    maxConcurrency: 10,
    scaleUpThreshold: 20, // Scale up when 20+ pending jobs
    scaleDownThreshold: 300000, // Scale down after 5 minutes of low activity
    cooldownPeriod: 120000, // 2 minutes between scaling actions
  };

  private queueConfigs: Record<string, Partial<ScalingConfig>> = {
    [QUEUE_NAMES.POST]: {
      maxConcurrency: 5, // Respect Reddit rate limits
      scaleUpThreshold: 10,
    },
    [QUEUE_NAMES.METRICS]: {
      maxConcurrency: 8, // Metrics can be more concurrent
      scaleUpThreshold: 30,
    },
    [QUEUE_NAMES.AI_PROMO]: {
      maxConcurrency: 2, // AI generation is expensive
      scaleUpThreshold: 5,
    },
    [QUEUE_NAMES.DUNNING]: {
      maxConcurrency: 2, // Payment processing should be conservative
      scaleUpThreshold: 8,
    },
    [QUEUE_NAMES.BATCH_POST]: {
      maxConcurrency: 1, // Always single concurrency for batch posts
      scaleUpThreshold: 999, // Never scale up
    },
  };

  public static getInstance(): WorkerScaler {
    if (!WorkerScaler.instance) {
      WorkerScaler.instance = new WorkerScaler();
    }
    return WorkerScaler.instance;
  }

  async startScaling(intervalMs: number = 60000) { // Check every minute
    if (this.scaling) return;

    logger.info('📈 Starting worker auto-scaling...');
    this.scaling = true;

    // Initialize scaling states
    for (const queueName of Object.values(QUEUE_NAMES)) {
      this.scalingStates.set(queueName, {
        currentConcurrency: this.getQueueConfig(queueName).minConcurrency,
        targetConcurrency: this.getQueueConfig(queueName).minConcurrency,
        pendingJobs: 0,
        isScaling: false,
      });
    }

    // Set up periodic scaling checks
    this.intervalId = setInterval(async () => {
      try {
        await this.performScalingCheck();
      } catch (error) {
        logger.error('Worker scaling error', { error });
      }
    }, intervalMs);

    logger.info(`✅ Worker auto-scaling started (interval: ${intervalMs}ms)`);
  }

  stopScaling() {
    if (!this.scaling) return;

    logger.info('🛑 Stopping worker auto-scaling...');
    this.scaling = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info('✅ Worker auto-scaling stopped');
  }

  private async performScalingCheck() {
    const queueMetrics = queueMonitor.getQueueMetrics();
    const now = new Date();

    for (const [queueName, metrics] of Object.entries(queueMetrics)) {
      const config = this.getQueueConfig(queueName);
      const state = this.scalingStates.get(queueName);
      
      if (!state || state.isScaling) continue;

      // Check if we're in cooldown period
      if (state.lastScalingAction) {
        const timeSinceLastScaling = now.getTime() - state.lastScalingAction.getTime();
        if (timeSinceLastScaling < config.cooldownPeriod) {
          continue; // Still in cooldown
        }
      }

      const shouldScaleUp = this.shouldScaleUp(metrics, config, state);
      const shouldScaleDown = this.shouldScaleDown(metrics, config, state);

      if (shouldScaleUp) {
        await this.scaleUp(queueName, config, state);
      } else if (shouldScaleDown) {
        await this.scaleDown(queueName, config, state);
      }

      // Update state
      state.pendingJobs = metrics.pending;
    }
  }

  private shouldScaleUp(metrics: unknown, config: ScalingConfig, state: WorkerScalingState): boolean {
    return (
      state.currentConcurrency < config.maxConcurrency &&
      metrics.pending >= config.scaleUpThreshold &&
      metrics.healthStatus !== 'critical' // Don't scale up if there are errors
    );
  }

  private shouldScaleDown(metrics: unknown, config: ScalingConfig, state: WorkerScalingState): boolean {
    return (
      state.currentConcurrency > config.minConcurrency &&
      metrics.pending < config.scaleUpThreshold / 2 && // Less than half the scale-up threshold
      metrics.active === 0 // No active jobs
    );
  }

  private async scaleUp(queueName: string, config: ScalingConfig, state: WorkerScalingState) {
    const newConcurrency = Math.min(
      state.currentConcurrency + 1,
      config.maxConcurrency
    );

    logger.info(`📈 Scaling UP ${queueName}: ${state.currentConcurrency} → ${newConcurrency}`);

    await this.updateWorkerConcurrency(queueName, newConcurrency);

    state.currentConcurrency = newConcurrency;
    state.targetConcurrency = newConcurrency;
    state.lastScalingAction = new Date();
    state.isScaling = false;
  }

  private async scaleDown(queueName: string, config: ScalingConfig, state: WorkerScalingState) {
    const newConcurrency = Math.max(
      state.currentConcurrency - 1,
      config.minConcurrency
    );

    logger.info(`📉 Scaling DOWN ${queueName}: ${state.currentConcurrency} → ${newConcurrency}`);

    await this.updateWorkerConcurrency(queueName, newConcurrency);

    state.currentConcurrency = newConcurrency;
    state.targetConcurrency = newConcurrency;
    state.lastScalingAction = new Date();
    state.isScaling = false;
  }

  private async updateWorkerConcurrency(queueName: string, newConcurrency: number) {
    try {
      // In a full implementation, this would dynamically adjust worker concurrency
      // For now, log the scaling action
      logger.info(`🔧 Worker concurrency for ${queueName} set to ${newConcurrency}`);
      
      // This would typically:
      // 1. Update the worker's concurrency setting
      // 2. Spawn/terminate worker processes
      // 3. Adjust resource allocation
      
    } catch (error) {
      logger.error(`Failed to update worker concurrency for ${queueName}`, { error });
    }
  }

  private getQueueConfig(queueName: string): ScalingConfig {
    const customConfig = this.queueConfigs[queueName] || {};
    return { ...this.defaultConfig, ...customConfig };
  }

  // Public API
  getScalingStates(): Record<string, WorkerScalingState> {
    const result: Record<string, WorkerScalingState> = {};
    for (const [queueName, state] of this.scalingStates.entries()) {
      result[queueName] = { ...state };
    }
    return result;
  }

  async manualScale(queueName: string, targetConcurrency: number): Promise<boolean> {
    const config = this.getQueueConfig(queueName);
    const state = this.scalingStates.get(queueName);

    if (!state) return false;

    if (targetConcurrency < config.minConcurrency || targetConcurrency > config.maxConcurrency) {
      throw new Error(`Concurrency must be between ${config.minConcurrency} and ${config.maxConcurrency}`);
    }

    logger.info(`🎯 Manual scaling ${queueName}: ${state.currentConcurrency} → ${targetConcurrency}`);

    await this.updateWorkerConcurrency(queueName, targetConcurrency);

    state.currentConcurrency = targetConcurrency;
    state.targetConcurrency = targetConcurrency;
    state.lastScalingAction = new Date();

    return true;
  }

  updateConfig(queueName: string, config: Partial<ScalingConfig>) {
    this.queueConfigs[queueName] = { ...this.queueConfigs[queueName], ...config };
    logger.info(`🔧 Updated scaling config for ${queueName}`, { config });
  }
}

// Export singleton instance
export const workerScaler = WorkerScaler.getInstance();