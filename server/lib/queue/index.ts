/**
 * Phase 5: Modern Queue System
 * Uses abstracted queue interface with Redis/PostgreSQL fallback
 */

import { getQueueBackend, enqueue } from "../queue-factory.js";
import type { Platform, PostContent } from "../../social-media/social-media-manager.js";
import { logger } from '../../bootstrap/logger.js';

// Queue names for type safety
export const QUEUE_NAMES = {
  POST: 'post-queue',
  BATCH_POST: 'batch-post-queue',
  METRICS: 'metrics-queue', 
  AI_PROMO: 'ai-promo-queue',
  DUNNING: 'dunning-queue',
  COMMUNITY_SYNC: 'community-sync-queue',
} as const;

export type QueueNames = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Job data types
export interface PostJobData {
  userId: number;
  // Existing Reddit-specific fields
  postJobId?: number;
  scheduleId?: number; // For scheduled posts
  subreddit?: string;
  titleFinal?: string;
  bodyFinal?: string;
  mediaKey?: string;
  nsfw?: boolean;
  spoiler?: boolean;
  flairId?: string;
  flairText?: string;
  // New social media fields
  platforms?: Platform[];
  content?: PostContent;
}

export interface BatchPostJobData {
  userId: number;
  campaignId: string;
  subreddits: string[];
  titleTemplate: string;
  bodyTemplate: string;
  mediaKey?: string;
  delayBetweenPosts?: number;
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

export interface CommunitySyncJobData {
  subreddits?: string[];
  triggeredBy?: string;
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

// Queue management functions
export async function pauseQueue(queueName: string): Promise<void> {
  const backend = getQueueBackend();
  if (backend.pause) {
    await backend.pause(queueName);
  } else {
    logger.warn(`Queue backend does not support pausing queue: ${queueName}`);
  }
}

export async function resumeQueue(queueName: string): Promise<void> {
  const backend = getQueueBackend();
  if (backend.resume) {
    await backend.resume(queueName);
  } else {
    logger.warn(`Queue backend does not support resuming queue: ${queueName}`);
  }
}

// Queue health check
interface QueueHealthInfo {
  pending: number;
  failureRate: number;
  totalJobs: number;
  failedJobs: number;
  error?: string;
}

export async function getQueueHealth(): Promise<Record<string, QueueHealthInfo>> {
  const queue = getQueueBackend();
  const health: Record<string, QueueHealthInfo> = {};
  
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
      health[queueName] = {
        pending: 0,
        failureRate: 0,
        totalJobs: 0,
        failedJobs: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  return health;
}

// Graceful shutdown
export async function closeQueues() {
  const queue = getQueueBackend();
  await queue.close();
}