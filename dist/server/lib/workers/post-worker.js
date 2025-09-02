import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES } from "../queue/index.js";
import { db } from "../../db.js";
import { postJobs, eventLogs } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { RedditManager } from "../reddit.js";
import { MediaManager } from "../media.js";
import { storage } from "../../storage.js";
import { socialMediaManager } from "../../social-media/social-media-manager.js";
import { logger } from "../logger.js";
export class PostWorker {
    initialized = false;
    async initialize() {
        if (this.initialized)
            return;
        await registerProcessor(QUEUE_NAMES.POST, this.processJob.bind(this), { concurrency: 2 } // Process 2 posts at once max
        );
        this.initialized = true;
        logger.info('✅ Post worker initialized with queue abstraction');
    }
    async processJob(jobData, jobId) {
        const data = jobData;
        if (data.platforms && data.content) {
            return this.processSocialMediaJob(data, jobId);
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
            const canPost = await RedditManager.canPostToSubreddit(userId, subreddit);
            if (!canPost.canPost) {
                throw new Error(`Cannot post: ${canPost.reason}`);
            }
            // Prepare post options
            const postOptions = {
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
                }
                catch (error) {
                    logger.warn('Failed to attach media, posting as text:', { error: error.message });
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
            }
            else {
                throw new Error(result.error || 'Reddit posting failed');
            }
        }
        catch (error) {
            logger.error(`Post job ${postJobId} failed:`, { error });
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
    async processSocialMediaJob(data, jobId) {
        const { userId, platforms, content } = data;
        if (!platforms || !content)
            return;
        try {
            logger.info(`Processing social media job ${jobId} for user ${userId}`);
            const accounts = await storage.getUserSocialMediaAccounts(userId);
            const connected = accounts
                .filter(acc => acc.isActive && platforms.includes(acc.platform))
                .map(acc => acc.platform);
            for (const acc of accounts) {
                if (connected.includes(acc.platform) && acc.accessToken) {
                    const credentials = {
                        accessToken: acc.accessToken,
                        refreshToken: acc.refreshToken,
                        ...(acc.metadata || {}),
                    };
                    socialMediaManager.connectAccount(acc.platform, credentials);
                }
            }
            const results = await socialMediaManager.postToMultiplePlatforms(connected, content);
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
                        status: result.success ? 'published' : 'failed',
                        publishedAt: result.success ? new Date() : undefined,
                        errorMessage: result.error,
                    };
                    await storage.createSocialMediaPost(postData);
                }
            }
        }
        catch (error) {
            logger.error(`Social media job ${jobId} failed:`, { error });
            throw error;
        }
    }
    async updateJobStatus(postJobId, status, resultData) {
        try {
            await db
                .update(postJobs)
                .set({
                status,
                resultJson: resultData,
                updatedAt: new Date(),
            })
                .where(eq(postJobs.id, postJobId));
        }
        catch (error) {
            logger.error('Failed to update job status:', { error });
        }
    }
    async getMediaAsset(key, userId) {
        try {
            // This would typically query the media_assets table by key
            // For now, return a placeholder implementation
            return await MediaManager.getAsset(parseInt(key), userId);
        }
        catch (error) {
            logger.error('Failed to get media asset:', { error });
            return null;
        }
    }
    async logEvent(userId, type, meta) {
        try {
            await db.insert(eventLogs).values({
                userId,
                type,
                meta,
            });
        }
        catch (error) {
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
