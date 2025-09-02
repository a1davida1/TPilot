import { InstagramAPI } from './instagram-api.js';
import { TwitterAPI } from './twitter-api.js';
import { TikTokAPI } from './tiktok-api.js';
import { YouTubeAPI } from './youtube-api.js';
// Unified Social Media Manager
export class SocialMediaManager {
    apis = new Map();
    constructor() { }
    // Connect a social media account
    connectAccount(platform, credentials) {
        switch (platform) {
            case 'instagram':
                this.apis.set(platform, new InstagramAPI(credentials.accessToken, credentials.businessAccountId));
                break;
            case 'twitter':
                this.apis.set(platform, new TwitterAPI({
                    accessToken: credentials.accessToken,
                    accessTokenSecret: credentials.accessTokenSecret,
                    consumerKey: credentials.consumerKey,
                    consumerSecret: credentials.consumerSecret,
                }));
                break;
            case 'tiktok':
                this.apis.set(platform, new TikTokAPI(credentials.accessToken));
                break;
            case 'youtube':
                this.apis.set(platform, new YouTubeAPI(credentials.accessToken));
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }
    // Post content to a specific platform
    async postToPlatform(platform, content) {
        const api = this.apis.get(platform);
        if (!api) {
            return {
                success: false,
                platform,
                error: `${platform} not connected`,
            };
        }
        try {
            switch (platform) {
                case 'instagram':
                    return await api.createPost({
                        imageUrl: content.mediaUrls?.[0],
                        videoUrl: content.mediaUrls?.find(url => url.includes('.mp4')),
                        caption: content.text,
                        hashtags: content.hashtags,
                    });
                case 'twitter':
                    // Upload media first if provided
                    let mediaIds = [];
                    if (content.mediaUrls?.length) {
                        for (const mediaUrl of content.mediaUrls) {
                            const mediaType = mediaUrl.includes('.mp4') ? 'video' : 'image';
                            const uploadResult = await api.uploadMedia(mediaUrl, mediaType);
                            if (uploadResult.success && uploadResult.mediaId) {
                                mediaIds.push(uploadResult.mediaId);
                            }
                        }
                    }
                    return await api.createTweet({
                        text: content.hashtags
                            ? `${content.text}\n\n${content.hashtags.map(tag => `#${tag}`).join(' ')}`
                            : content.text,
                        mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
                    });
                case 'tiktok':
                    if (!content.mediaUrls?.[0]?.includes('.mp4')) {
                        return {
                            success: false,
                            platform,
                            error: 'TikTok requires video content',
                        };
                    }
                    return await api.createPost({
                        videoUrl: content.mediaUrls[0],
                        caption: content.text,
                        hashtags: content.hashtags,
                    });
                case 'youtube':
                    if (!content.mediaUrls?.[0]?.includes('.mp4')) {
                        return {
                            success: false,
                            platform,
                            error: 'YouTube requires video content',
                        };
                    }
                    return await api.createPost({
                        videoUrl: content.mediaUrls[0],
                        title: content.title || content.text.substring(0, 100),
                        description: content.description || content.text,
                        tags: content.hashtags,
                    });
                default:
                    return {
                        success: false,
                        platform,
                        error: `Posting not implemented for ${platform}`,
                    };
            }
        }
        catch (error) {
            return {
                success: false,
                platform,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    // Post to multiple platforms simultaneously
    async postToMultiplePlatforms(platforms, content) {
        const promises = platforms.map(platform => this.postToPlatform(platform, content));
        return await Promise.allSettled(promises).then(results => results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            else {
                return {
                    success: false,
                    platform: platforms[index],
                    error: result.reason?.message || 'Failed to post',
                };
            }
        }));
    }
    // Get engagement metrics for a post
    async getPostMetrics(platform, postId) {
        const api = this.apis.get(platform);
        if (!api) {
            console.error(`${platform} not connected`);
            return null;
        }
        try {
            const result = await api.getPostMetrics?.(postId);
            if (!result?.success) {
                return null;
            }
            // Normalize metrics across platforms
            const metrics = result.metrics;
            switch (platform) {
                case 'instagram':
                    return {
                        platform,
                        likes: metrics.find((m) => m.name === 'likes')?.values[0]?.value || 0,
                        comments: metrics.find((m) => m.name === 'comments')?.values[0]?.value || 0,
                        shares: metrics.find((m) => m.name === 'shares')?.values[0]?.value || 0,
                        views: metrics.find((m) => m.name === 'impressions')?.values[0]?.value || 0,
                    };
                case 'twitter':
                    return {
                        platform,
                        likes: metrics.like_count || 0,
                        comments: metrics.reply_count || 0,
                        shares: metrics.retweet_count || 0,
                        views: 0, // Twitter doesn't provide view count in basic metrics
                        retweets: metrics.retweet_count || 0,
                        quotes: metrics.quote_count || 0,
                    };
                case 'tiktok':
                    return {
                        platform,
                        likes: metrics.like_count || 0,
                        comments: metrics.comment_count || 0,
                        shares: metrics.share_count || 0,
                        views: metrics.view_count || 0,
                    };
                case 'youtube':
                    return {
                        platform,
                        likes: metrics.likeCount || 0,
                        comments: metrics.commentCount || 0,
                        shares: metrics.shareCount || 0,
                        views: metrics.viewCount || 0,
                    };
                default:
                    return null;
            }
        }
        catch (error) {
            console.error(`Error fetching metrics for ${platform}:`, error);
            return null;
        }
    }
    // Get account metrics
    async getAccountMetrics(platform) {
        const api = this.apis.get(platform);
        if (!api) {
            throw new Error(`${platform} not connected`);
        }
        switch (platform) {
            case 'instagram':
                return await api.getAccountInsights?.();
            case 'twitter':
                return await api.getUserMetrics?.('me'); // Or specific user ID
            case 'tiktok':
                return await api.getUserInfo?.();
            case 'youtube':
                return await api.getChannelMetrics?.();
            default:
                throw new Error(`Account metrics not implemented for ${platform}`);
        }
    }
    // Check if platform is connected
    isConnected(platform) {
        return this.apis.has(platform);
    }
    // Disconnect a platform
    disconnect(platform) {
        this.apis.delete(platform);
    }
    // Get all connected platforms
    getConnectedPlatforms() {
        return Array.from(this.apis.keys());
    }
}
// Create a singleton instance
export const socialMediaManager = new SocialMediaManager();
