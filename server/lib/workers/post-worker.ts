import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES, type PostJobData } from "../queue/index.js";
import { db } from "../../db.js";
import { postJobs, eventLogs } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { RedditManager } from "../reddit.js";
import { MediaManager } from "../media.js";

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
    console.log('✅ Post worker initialized with queue abstraction');
  }

  private async processJob(jobData: unknown, jobId: string) {
    const { userId, postJobId, subreddit, titleFinal, bodyFinal, mediaKey } = jobData as PostJobData;

    try {
      console.log(`Processing post job ${postJobId} for user ${userId}`);

      // Get Reddit manager for user
      const reddit = await RedditManager.forUser(userId);
      if (!reddit) {
        throw new Error('No active Reddit account found for user');
      }

      // Check if we can post to this subreddit
      const canPost = await RedditManager.canPostToSubreddit(userId, subreddit);
      if (!canPost.canPost) {
        throw new Error(`Cannot post: ${canPost.reason}`);
      }

      // Prepare post options
      const postOptions: any = {
        subreddit,
        title: titleFinal,
        body: bodyFinal,
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
        } catch (error) {
          console.warn('Failed to attach media, posting as text:', error);
        }
      }

      // Submit to Reddit
      const result = await reddit.submitPost(postOptions);

      // Update job status in database
      if (result.success) {
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

        return { success: true, result };
      } else {
        throw new Error(result.error || 'Reddit posting failed');
      }

    } catch (error: any) {
      console.error(`Post job ${postJobId} failed:`, error);

      // Update job status to failed
      await this.updateJobStatus(postJobId, 'failed', {
        error: error.message,
        failedAt: new Date().toISOString(),
      });

      // Log failure event
      await this.logEvent(userId, 'job.failed', {
        postJobId,
        subreddit,
        error: error.message,
      });

      throw error; // Re-throw to mark job as failed
    }
  }

  private async updateJobStatus(postJobId: number, status: string, resultData: any) {
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
      console.error('Failed to update job status:', error);
    }
  }

  private async getMediaAsset(key: string, userId: number) {
    try {
      // This would typically query the media_assets table by key
      // For now, return a placeholder implementation
      return await MediaManager.getAsset(parseInt(key), userId);
    } catch (error) {
      console.error('Failed to get media asset:', error);
      return null;
    }
  }

  private async logEvent(userId: number, type: string, meta: any) {
    try {
      await db.insert(eventLogs).values({
        userId,
        type,
        meta,
      });
    } catch (error) {
      console.error('Failed to log event:', error);
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