import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES, type PostJobData } from "../queue/index.js";
import { db } from "../../db.js";
import { postJobs, eventLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { RedditManager } from "../reddit.js";
import { MediaManager } from "../media.js";
import { storage } from "../../storage.js";
import { socialMediaManager, type Platform, type PostContent } from "../../social-media/social-media-manager.js";
import { logger } from "../logger.js";
import { recordPostOutcome } from "../../compliance/ruleViolationTracker.js";

export class PostWorker {
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    await registerProcessor<PostJobData>(
      QUEUE_NAMES.POST,
      this.processJob.bind(this),
      { concurrency: 2 } // Process 2 posts at once max
    );
    
    this.initialized = true;
    logger.info('✅ Post worker initialized with queue abstraction');
  }

  private async processJob(jobData: unknown, jobId: string): Promise<void> {
    // Validate job data structure
    if (!jobData || typeof jobData !== 'object') {
      throw new Error('Invalid job data: expected object');
    }
    const data = jobData as PostJobData;
    if (data.platforms && data.content) {
      await this.processSocialMediaJob(data, jobId);
      return;
    }
    const { userId, postJobId, subreddit, titleFinal, bodyFinal, mediaKey } = data;

    try {
      logger.info(`Processing post job ${postJobId} for user ${userId}`);

      // Get Reddit manager for user
      const reddit = await RedditManager.forUser(userId);
      if (!reddit) {
        throw new Error('No active Reddit account found for user');
      }

      // Check if we can post to this subreddit
      if (!subreddit) {
        throw new Error('Subreddit is required for Reddit posting');
      }
      const canPost = await RedditManager.canPostToSubreddit(userId, subreddit);
      if (!canPost.canPost) {
        recordPostOutcome(userId, subreddit, {
          status: 'removed',
          reason: canPost.reason ?? 'Posting not permitted'
        });
        throw new Error(`Cannot post: ${canPost.reason}`);
      }

      // Prepare post options
      interface RedditPostOptions {
        subreddit: string;
        title: string;
        body: string;
        nsfw: boolean;
        url?: string;
      }
      
      const postOptions: RedditPostOptions = {
        subreddit,
        title: titleFinal || '',
        body: bodyFinal || '',
        nsfw: true, // Assume NSFW for adult content
      };

      // Add media if provided
      if (mediaKey) {
        try {
          // In production, this would get the signed URL or public URL
          const mediaAsset = await this.getMediaAsset(mediaKey, userId);
          if (mediaAsset) {
            postOptions.url = mediaAsset.downloadUrl || mediaAsset.signedUrl;
          }
        } catch (error: unknown) {
          logger.warn('Failed to attach media, posting as text:', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Submit to Reddit
      const result = await reddit.submitPost(postOptions);

      // Update job status in database
      if (result.success) {
        recordPostOutcome(userId, subreddit, { status: 'posted' });
        if (!postJobId) {
          throw new Error('postJobId is required');
        }
        await this.updateJobStatus(postJobId, 'sent', {
          redditPostId: result.postId,
          url: result.url,
          completedAt: new Date().toISOString(),
        });

        // Log success event
        await this.logEvent(userId, 'job.completed', {
          postJobId,
          subreddit,
          result,
        });

        logger.info(`Post job ${postJobId} completed successfully`, { result });
      } else {
        recordPostOutcome(userId, subreddit, {
          status: 'removed',
          reason: result.error ?? 'Reddit posting failed'
        });
        throw new Error(result.error || 'Reddit posting failed');
      }

    } catch (error: unknown) {
      logger.error(`Post job ${postJobId} failed:`, { error });

      // Update job status to failed
      if (postJobId) {
        await this.updateJobStatus(postJobId, 'failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString(),
        });
      }

      // Log failure event
      await this.logEvent(userId, 'job.failed', {
        postJobId,
        subreddit,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error; // Re-throw to mark job as failed
    }
  }

  private async processSocialMediaJob(data: PostJobData, jobId: string): Promise<void> {
    const { userId, platforms, content } = data;
    if (!platforms || !content) return;

    try {
      logger.info(`Processing social media job ${jobId} for user ${userId}`);
      const accounts = await storage.getUserSocialMediaAccounts(userId);
      const connected = accounts
        .filter(acc => acc.isActive && platforms.includes(acc.platform as Platform))
        .map(acc => acc.platform as Platform);

      for (const acc of accounts) {
        if (connected.includes(acc.platform as Platform) && acc.accessToken) {
          const credentials: Record<string, unknown> = {
            accessToken: acc.accessToken || '',
            ...(acc.refreshToken ? { refreshToken: acc.refreshToken } : {}),
            ...(typeof acc.metadata === 'object' && acc.metadata !== null
              ? (acc.metadata as Record<string, unknown>)
              : {}),
          };
          socialMediaManager.connectAccount(acc.platform as Platform, credentials as Record<string, string>);
        }
      }

      const results = await socialMediaManager.postToMultiplePlatforms(
        connected,
        content as PostContent
      );

      for (const result of results) {
        const account = accounts.find(a => a.platform === result.platform);
        if (account) {
          const postData = {
            userId,
            accountId: account.id,
            platform: result.platform,
            platformPostId: result.postId,
            content: content.text,
            mediaUrls: content.mediaUrls || [],
            hashtags: content.hashtags || [],
            status: result.success ? 'published' as const : 'failed' as const,
            publishedAt: result.success ? new Date() : undefined,
            errorMessage: result.error,
          };
          await storage.createSocialMediaPost(postData);
        }
      }
    } catch (error) {
      logger.error(`Social media job ${jobId} failed:`, { error });
      throw error;
    }
  }

  private async updateJobStatus(postJobId: number, status: string, resultData: Record<string, unknown>) {
    try {
      await db
        .update(postJobs)
        .set({
          status,
          resultJson: resultData,
          updatedAt: new Date(),
        })
        .where(eq(postJobs.id, postJobId));
    } catch (error) {
      logger.error('Failed to update job status:', { error });
    }
  }

  private async getMediaAsset(key: string, userId: number) {
    try {
      // This would typically query the media_assets table by key
      return await MediaManager.getAsset(parseInt(key), userId);
    } catch (error) {
      logger.error('Failed to get media asset:', { error });
      return null;
    }
  }

  private async logEvent(userId: number, type: string, meta: Record<string, unknown>) {
    try {
      await db.insert(eventLogs).values({
        userId,
        type,
        meta,
      });
    } catch (error) {
      logger.error('Failed to log event:', { error });
    }
  }

  async close() {
    // Queue cleanup is handled by the queue factory
    this.initialized = false;
  }
}

// Export singleton instance
export const postWorker = new PostWorker();

// Initialize the post worker (async function for proper setup)
export async function initializePostWorker() {
  await postWorker.initialize();
}