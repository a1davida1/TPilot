import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config.js";

// Redis connection
export const redis = new IORedis(env.REDIS_URL, {
  connectTimeout: 10000,
  retryDelayOnError: 100,
  maxRetriesPerRequest: 3,
});

// Queue configuration
const queueConfig = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Queue definitions
export const queues = {
  post: new Queue('post-queue', queueConfig),
  metrics: new Queue('metrics-queue', queueConfig),
  aiPromo: new Queue('ai-promo-queue', queueConfig),
  dunning: new Queue('dunning-queue', queueConfig),
} as const;

export type QueueNames = keyof typeof queues;

// Job data types
export interface PostJobData {
  userId: number;
  postJobId: number;
  subreddit: string;
  titleFinal: string;
  bodyFinal: string;
  mediaKey?: string;
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
    repeat?: { pattern: string };
  }
) {
  return queues[queueName].add(`${queueName}-job`, jobData, options);
}

// Queue health check
export async function getQueueHealth() {
  const health: Record<string, any> = {};
  
  for (const [name, queue] of Object.entries(queues)) {
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    
    health[name] = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
  
  return health;
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    ...Object.values(queues).map(queue => queue.close()),
    redis.quit(),
  ]);
}