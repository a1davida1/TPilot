import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES, type PostJobData } from "../queue/index.js";
import { db } from "../../db.js";
import { postJobs, eventLogs, scheduledPosts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { RedditManager } from "../reddit.js";
import { MediaManager } from "../media.js";
import { storage } from "../../storage.js";
import { socialMediaManager, type Platform, type PostContent } from "../../social-media/social-media-manager.js";
import { RedditNativeUploadService } from "../../services/reddit-native-upload.js";
// Removed account-metadata imports - module not found
import { logger } from "../logger.js";
import { recordPostOutcome, type PostOutcomeInput } from "../../compliance/ruleViolationTracker.js";

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
    const { userId, postJobId, scheduleId, subreddit, titleFinal, bodyFinal, mediaKey, nsfw, spoiler, flairId, flairText } = data;

    try {
      logger.info(`Processing post job ${postJobId} for user ${userId}`, { 
        scheduleId, 
        hasMedia: !!mediaKey,
        nsfw,
        spoiler
      });

      // Check if we can post to this subreddit
      if (!subreddit) {
        throw new Error('Subreddit is required for Reddit posting');
      }
      const canPost = await RedditManager.canPostToSubreddit(userId, subreddit);
      if (!canPost.canPost) {
        await this.trackOutcome(userId, subreddit, {
          status: 'removed',
          reason: canPost.reason ?? 'Posting not permitted'
        });
        if (scheduleId) {
          await this.updateScheduledPostStatus(scheduleId, 'failed', canPost.reason);
        }
        throw new Error(`Cannot post: ${canPost.reason}`);
      }

      let result;

      // Use appropriate posting method based on content type
      if (mediaKey) {
        // Image post - use Reddit native upload service
        logger.info(`Posting image to r/${subreddit} using native upload`, { mediaKey });
        result = await RedditNativeUploadService.uploadAndPost({
          userId,
          subreddit,
          title: titleFinal || '',
          imageUrl: mediaKey, // mediaKey is the image URL
          nsfw: nsfw ?? false,
          spoiler: spoiler ?? false,
          flairId: flairId || undefined,
          flairText: flairText || undefined,
          allowImgboxFallback: true,
        });
      } else {
        // Text/link post - use standard Reddit manager
        logger.info(`Posting text to r/${subreddit}`);
        const reddit = await RedditManager.forUser(userId);
        if (!reddit) {
          throw new Error('No active Reddit account found for user');
        }

        result = await reddit.submitPost({
          subreddit,
          title: titleFinal || '',
          body: bodyFinal || '',
          nsfw: nsfw ?? false,
          spoiler: spoiler ?? false,
          flairId: flairId || undefined,
          flairText: flairText || undefined,
        });
      }

      // Update status based on result
      if (result.success) {
        await this.trackOutcome(userId, subreddit, { status: 'posted' });
        
        // Update scheduled post if this came from scheduler
        if (scheduleId) {
          await this.updateScheduledPostStatus(scheduleId, 'completed', undefined, {
            redditPostId: result.postId,
            redditPostUrl: result.url,
            executedAt: new Date(),
          });
        }

        // Update job record if exists
        if (postJobId) {
          await this.updateJobStatus(postJobId, 'sent', {
            redditPostId: result.postId,
            url: result.url,
            completedAt: new Date().toISOString(),
          });
        }

        // Log success event
        await this.logEvent(userId, 'job.completed', {
          postJobId,
          scheduleId,
          subreddit,
          result,
        });

        logger.info(`Post job completed successfully`, { 
          postJobId, 
          scheduleId,
          redditPostId: result.postId 
        });
      } else {
        await this.trackOutcome(userId, subreddit, {
          status: 'removed',
          reason: result.error ?? 'Reddit posting failed'
        });
        if (scheduleId) {
          await this.updateScheduledPostStatus(scheduleId, 'failed', result.error);
        }
        throw new Error(result.error || 'Reddit posting failed');
      }

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Post job ${postJobId} failed:`, { error: errorMsg });

      // Update scheduled post if exists
      if (scheduleId) {
        await this.updateScheduledPostStatus(scheduleId, 'failed', errorMsg);
      }

      // Update job status to failed
      if (postJobId) {
        await this.updateJobStatus(postJobId, 'failed', {
          error: errorMsg,
          failedAt: new Date().toISOString(),
        });
      }

      // Log failure event
      await this.logEvent(userId, 'job.failed', {
        postJobId,
        scheduleId,
        subreddit,
        error: errorMsg,
      });

      throw error; // Re-throw to mark job as failed
    }
  }

  private async trackOutcome(
    userId: number,
    subreddit: string,
    outcome: PostOutcomeInput
  ): Promise<void> {
    try {
      await recordPostOutcome(userId, subreddit, outcome);
    } catch (error) {
      logger.warn('Failed to record Reddit post outcome', {
        userId,
        subreddit,
        status: outcome.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processSocialMediaJob(data: PostJobData, jobId: string): Promise<void> {
    const { userId, platforms, content } = data;
    if (!platforms || !content) return;

    try {
      logger.info(`Processing social media job ${jobId} for user ${userId}`);
      const accounts = await storage.getUserSocialMediaAccounts(userId);
      const targetAccounts = accounts.filter(acc =>
        acc.isActive && platforms.includes(acc.platform as Platform)
      );

      // Connect each target account
      for (const acc of targetAccounts) {
        const credentials: Record<string, string> = {};
        
        // Extract credentials from account
        if (acc.accessToken) {
          credentials.accessToken = acc.accessToken;
        }
        
        if (acc.refreshToken) {
          credentials.refreshToken = acc.refreshToken;
        }
        
        // Add metadata fields if they exist
        if (acc.metadata && typeof acc.metadata === 'object') {
          const metadata = acc.metadata as Record<string, unknown>;
          for (const [key, value] of Object.entries(metadata)) {
            if (typeof value === 'string') {
              credentials[key] = value;
            }
          }
        }
        
        // Skip if no access token
        if (!credentials.accessToken) {
          continue;
        }

        // Connect account with simplified API
        socialMediaManager.connectAccount(acc.platform as Platform, acc.id.toString(), credentials);
      }

      // Get connected platforms list
      const connectedTargets = targetAccounts
        .filter(acc => acc.accessToken)
        .map(acc => ({
          platform: acc.platform as Platform,
          key: acc.id.toString()
        }));
      
      if (connectedTargets.length === 0) {
        throw new Error('No connected posting accounts available for job');
      }

      const results = await socialMediaManager.postToMultiplePlatforms(
        connectedTargets,
        content as PostContent
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const account = targetAccounts.find(
          acc => acc.id.toString() === result.clientKey
        );

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
        } else {
          logger.warn('No matching account found for social media result', {
            clientKey: result.clientKey,
            platform: result.platform,
          });
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

  private async updateScheduledPostStatus(
    scheduleId: number, 
    status: 'completed' | 'failed' | 'processing', 
    errorMessage?: string,
    resultData?: { redditPostId?: string; redditPostUrl?: string; executedAt?: Date }
  ) {
    try {
      await db
        .update(scheduledPosts)
        .set({
          status,
          errorMessage: errorMessage || null,
          redditPostId: resultData?.redditPostId || undefined,
          redditPostUrl: resultData?.redditPostUrl || undefined,
          executedAt: resultData?.executedAt || undefined,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, scheduleId));
    } catch (error) {
      logger.error('Failed to update scheduled post status:', { error, scheduleId });
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