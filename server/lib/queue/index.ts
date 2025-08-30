/**
 * Phase 5: Modern Queue System
 * Uses abstracted queue interface with Redis/PostgreSQL fallback
 */

import { getQueueBackend, enqueue, registerProcessor } from "../queue-factory.js";
import type { Platform, PostContent } from "../../social-media/social-media-manager.js";

// Queue names for type safety
export const QUEUE_NAMES = {
  POST: 'post-queue',
  METRICS: 'metrics-queue', 
  AI_PROMO: 'ai-promo-queue',
  DUNNING: 'dunning-queue',
} as const;

export type QueueNames = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Job data types
export interface PostJobData {
  userId: number;
  // Existing Reddit-specific fields
  postJobId?: number;
  subreddit?: string;
  titleFinal?: string;
  bodyFinal?: string;
  mediaKey?: string;
  // New social media fields
  platforms?: Platform[];
  content?: PostContent;
}

export interface MetricsJobData {
  postJobId: number;
  redditPostId: string;
  scheduledFor: Date;
}

export interface AiPromoJobData {
  userId: number;
  generationId: number;
  promptText?: string;
  imageKey?: string;
  platforms: string[];
  styleHints?: string[];
  variants?: number;
}

export interface DunningJobData {
  subscriptionId: number;
  attempt: number;
  maxAttempts?: number;
}

// Helper function to add jobs with proper types
export async function addJob<T>(
  queueName: QueueNames,
  jobData: T,
  options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
  }
) {
  return enqueue(queueName, jobData, options);
}

// Queue health check
export async function getQueueHealth() {
  const queue = getQueueBackend();
  const health: Record<string, any> = {};
  
  for (const queueName of Object.values(QUEUE_NAMES)) {
    try {
      const pending = await queue.getPendingCount(queueName);
      const failureStats = await queue.getFailureRate(queueName, 60); // Last hour
      
      health[queueName] = {
        pending,
        failureRate: failureStats.failureRate,
        totalJobs: failureStats.totalJobs,
        failedJobs: failureStats.failedJobs,
      };
    } catch (error) {
      health[queueName] = { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  return health;
}

// Graceful shutdown
export async function closeQueues() {
  const queue = getQueueBackend();
  await queue.close();
}