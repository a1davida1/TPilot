import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES } from "../queue/index.js";
import { db } from "../../db.js";
import { postJobs, eventLogs } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { RedditManager } from "../reddit.js";
import { logger } from "../logger.js";
export class BatchPostingWorker {
    initialized = false;
    async initialize() {
        if (this.initialized)
            return;
        await registerProcessor(QUEUE_NAMES.BATCH_POST, this.processJob.bind(this), { concurrency: 1 } // Process 1 batch at a time to respect rate limits
        );
        this.initialized = true;
        logger.info('✅ Batch posting worker initialized with queue abstraction');
    }
    async processJob(jobData, jobId) {
        const { userId, campaignId, subreddits, titleTemplate, bodyTemplate, mediaKey, delayBetweenPosts = 300000 // 5 minutes default
         } = jobData;
        try {
            logger.info(`Processing batch posting campaign ${campaignId} for ${subreddits.length} subreddits`);
            // Get Reddit manager for user
            const reddit = await RedditManager.forUser(userId);
            if (!reddit) {
                throw new Error('No active Reddit account found for user');
            }
            const results = [];
            let successCount = 0;
            let failureCount = 0;
            for (let i = 0; i < subreddits.length; i++) {
                const subreddit = subreddits[i];
                try {
                    logger.info(`Posting to r/${subreddit} (${i + 1}/${subreddits.length})`);
                    // Check if we can post to this subreddit
                    const canPost = await RedditManager.canPostToSubreddit(userId, subreddit);
                    if (!canPost.canPost) {
                        results.push({
                            subreddit,
                            success: false,
                            error: canPost.reason,
                            skipped: true,
                        });
                        continue;
                    }
                    // Customize content for this subreddit
                    const customizedContent = await this.customizeContentForSubreddit(subreddit, titleTemplate, bodyTemplate);
                    // Create individual post job for tracking
                    const [postJob] = await db.insert(postJobs).values({
                        userId,
                        subreddit,
                        titleFinal: customizedContent.title,
                        bodyFinal: customizedContent.body,
                        mediaKey,
                        campaignId: campaignId.toString(),
                        status: 'pending',
                    }).returning();
                    // Submit post
                    const postOptions = {
                        subreddit,
                        title: customizedContent.title,
                        body: customizedContent.body,
                        nsfw: true,
                    };
                    // Add media if provided
                    if (mediaKey) {
                        try {
                            const mediaAsset = await this.getMediaAsset(mediaKey, userId);
                            if (mediaAsset) {
                                postOptions.url = mediaAsset.downloadUrl || mediaAsset.signedUrl;
                            }
                        }
                        catch (error) {
                            logger.warn('Failed to attach media, posting as text:', { error: error.message });
                        }
                    }
                    const result = await reddit.submitPost(postOptions);
                    if (result.success) {
                        // Update post job status
                        await db
                            .update(postJobs)
                            .set({
                            status: 'sent',
                            resultJson: {
                                redditPostId: result.postId,
                                url: result.url,
                                completedAt: new Date().toISOString(),
                            },
                            updatedAt: new Date(),
                        })
                            .where(eq(postJobs.id, postJob.id));
                        // Schedule metrics collection
                        await this.scheduleMetricsCollection(postJob.id, result.postId);
                        results.push({
                            subreddit,
                            success: true,
                            postId: result.postId,
                            url: result.url,
                        });
                        successCount++;
                    }
                    else {
                        await db
                            .update(postJobs)
                            .set({
                            status: 'failed',
                            resultJson: {
                                error: result.error,
                                failedAt: new Date().toISOString(),
                            },
                            updatedAt: new Date(),
                        })
                            .where(eq(postJobs.id, postJob.id));
                        results.push({
                            subreddit,
                            success: false,
                            error: result.error,
                        });
                        failureCount++;
                    }
                    // Add delay between posts (except for the last one)
                    if (i < subreddits.length - 1) {
                        logger.info(`Waiting ${delayBetweenPosts / 1000}s before next post...`);
                        await this.sleep(delayBetweenPosts);
                    }
                }
                catch (error) {
                    logger.error(`Failed to post to r/${subreddit}:`, { error: error.message });
                    results.push({
                        subreddit,
                        success: false,
                        error: error.message,
                    });
                    failureCount++;
                    // Continue with next subreddit even if this one fails
                }
            }
            // Log campaign completion event
            await this.logEvent(userId, 'batch_post.completed', {
                campaignId,
                totalSubreddits: subreddits.length,
                successCount,
                failureCount,
                results,
            });
            logger.info(`Batch posting campaign ${campaignId} completed: ${successCount} success, ${failureCount} failed`);
            return {
                success: true,
                results,
                summary: {
                    total: subreddits.length,
                    success: successCount,
                    failed: failureCount
                }
            };
        }
        catch (error) {
            logger.error(`Batch posting campaign ${campaignId} failed:`, { error });
            // Log failure event
            await this.logEvent(userId, 'batch_post.failed', {
                campaignId,
                subreddits,
                error: error.message,
            });
            throw error;
        }
    }
    async customizeContentForSubreddit(subreddit, titleTemplate, bodyTemplate) {
        // Basic template customization - in full implementation this would:
        // 1. Check subreddit rules and preferences
        // 2. Adapt language/tone for community
        // 3. Customize hashtags and mentions
        // 4. Adjust content length/format
        let title = titleTemplate;
        let body = bodyTemplate;
        // Add subreddit-specific customizations
        const customizations = this.getSubredditCustomizations(subreddit);
        // Apply customizations
        title = title.replace(/\{subreddit\}/g, subreddit);
        body = body.replace(/\{subreddit\}/g, subreddit);
        if (customizations.preferredHashtags) {
            body += `\n\n${customizations.preferredHashtags}`;
        }
        return {
            title: title.slice(0, 300), // Reddit title limit
            body: body.slice(0, 40000), // Reddit body limit
        };
    }
    getSubredditCustomizations(subreddit) {
        // In full implementation, this would query subreddit rules/preferences from database
        const customizations = {
            preferredHashtags: '',
            toneAdjustment: 'standard',
            contentLength: 'medium',
        };
        // Basic customization rules
        switch (subreddit.toLowerCase()) {
            case 'gonewild':
                customizations.preferredHashtags = '#gonewild #reddit';
                customizations.toneAdjustment = 'flirty';
                break;
            case 'realgirls':
                customizations.toneAdjustment = 'authentic';
                break;
            default:
                // Use standard settings
                break;
        }
        return customizations;
    }
    async getMediaAsset(key, userId) {
        try {
            // This would query the media_assets table by key
            const { MediaManager } = await import("../media.js");
            return await MediaManager.getAsset(parseInt(key), userId);
        }
        catch (error) {
            logger.error('Failed to get media asset:', { error });
            return null;
        }
    }
    async scheduleMetricsCollection(postJobId, redditPostId) {
        try {
            const { addJob } = await import("../queue/index.js");
            // Schedule metrics collection in 1 hour
            await addJob(QUEUE_NAMES.METRICS, {
                postJobId,
                redditPostId,
                scheduledFor: new Date(),
            }, {
                delay: 60 * 60 * 1000, // 1 hour delay
            });
        }
        catch (error) {
            logger.error('Failed to schedule metrics collection:', { error });
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
            logger.error('Failed to log batch posting event:', { error });
        }
    }
    async close() {
        this.initialized = false;
    }
}
// Export singleton instance
export const batchPostingWorker = new BatchPostingWorker();
// Initialize the batch posting worker
export async function initializeBatchPostingWorker() {
    await batchPostingWorker.initialize();
}
