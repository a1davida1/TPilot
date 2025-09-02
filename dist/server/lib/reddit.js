import snoowrap from 'snoowrap';
import { db } from '../db.js';
import { creatorAccounts } from '@shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '../services/state-store.js';
export class RedditManager {
    reddit;
    userId;
    constructor(accessToken, refreshToken, userId) {
        this.userId = userId;
        this.reddit = new snoowrap({
            userAgent: 'ThottoPilot/1.0 (Content scheduling bot)',
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            accessToken,
            refreshToken,
        });
    }
    /**
     * Get Reddit manager for a specific user
     */
    static async forUser(userId) {
        try {
            const [account] = await db
                .select()
                .from(creatorAccounts)
                .where(and(eq(creatorAccounts.userId, userId), eq(creatorAccounts.platform, 'reddit'), eq(creatorAccounts.isActive, true)));
            if (!account || !account.oauthToken) {
                return null;
            }
            // Decrypt tokens
            const accessToken = decrypt(account.oauthToken);
            const refreshToken = account.oauthRefresh ? decrypt(account.oauthRefresh) : '';
            if (!accessToken) {
                console.error('Failed to decrypt access token for user:', userId);
                return null;
            }
            return new RedditManager(accessToken, refreshToken, userId);
        }
        catch (error) {
            console.error('Failed to create Reddit manager for user:', error);
            return null;
        }
    }
    /**
     * Submit a post to Reddit
     */
    async submitPost(options) {
        try {
            console.log(`Submitting post to r/${options.subreddit}: "${options.title}"`);
            // Check if we can post to this subreddit
            const permission = await RedditManager.canPostToSubreddit(this.userId, options.subreddit);
            if (!permission.canPost) {
                return {
                    success: false,
                    error: permission.reason || 'Cannot post to this subreddit'
                };
            }
            let submission;
            if (options.url) {
                // Link post
                submission = await this.reddit
                    .getSubreddit(options.subreddit)
                    .submitLink({
                    subredditName: options.subreddit,
                    title: options.title,
                    url: options.url,
                    nsfw: options.nsfw || false,
                    spoiler: options.spoiler || false,
                });
            }
            else {
                // Text post
                submission = await this.reddit
                    .getSubreddit(options.subreddit)
                    .submitSelfpost({
                    subredditName: options.subreddit,
                    title: options.title,
                    text: options.body || '',
                    nsfw: options.nsfw || false,
                    spoiler: options.spoiler || false,
                });
            }
            // Update rate limiting
            await this.updateRateLimit(options.subreddit);
            console.log('Reddit submission succeeded:', {
                userId: this.userId,
                subreddit: options.subreddit,
                postId: submission.id,
            });
            return {
                success: true,
                postId: submission.id,
                url: `https://www.reddit.com${submission.permalink}`,
            };
        }
        catch (error) {
            console.error('Reddit submission failed:', {
                message: error?.message,
                stack: error?.stack,
            });
            let errorMessage = 'Failed to submit post';
            // Parse common Reddit API errors
            if (error.message?.includes('RATELIMIT')) {
                errorMessage = 'Rate limited by Reddit. Please try again later.';
            }
            else if (error.message?.includes('SUBREDDIT_NOTALLOWED')) {
                errorMessage = 'Not allowed to post in this subreddit';
            }
            else if (error.message?.includes('NO_TEXT')) {
                errorMessage = 'Post content cannot be empty';
            }
            else if (error.message?.includes('TOO_LONG')) {
                errorMessage = 'Post title or content is too long';
            }
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Check if user can post to a specific subreddit (rate limiting)
     */
    static async canPostToSubreddit(userId, subreddit) {
        try {
            // Check if user has exceeded posting limits for this subreddit
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            // For demo purposes, allow posting (in production, implement proper rate limiting)
            // In a real implementation, you'd check:
            // - Subreddit-specific post limits
            // - User's posting history
            // - Account age and karma requirements
            // - Subreddit ban status
            return {
                canPost: true
            };
        }
        catch (error) {
            console.error('Error checking posting permission:', error);
            return {
                canPost: false,
                reason: 'Unable to verify posting permissions'
            };
        }
    }
    /**
     * Update rate limiting after successful post
     */
    async updateRateLimit(subreddit) {
        try {
            // In production, update rate limiting tables
            console.log(`Updated rate limit for user ${this.userId} in r/${subreddit}`);
            // This would insert/update records in post_rate_limits table
            // await db.insert(postRateLimits).values({...})
        }
        catch (error) {
            console.error('Failed to update rate limit:', error);
        }
    }
    /**
     * Get user's Reddit profile info
     */
    async getProfile() {
        try {
            const user = await this.reddit.getMe();
            return {
                username: user.name,
                karma: user.link_karma + user.comment_karma,
                created: user.created_utc,
                verified: user.verified,
                goldStatus: user.is_gold,
                hasMail: user.has_mail,
            };
        }
        catch (error) {
            console.error('Failed to get Reddit profile:', error);
            return null;
        }
    }
    /**
     * Test Reddit connection
     */
    async testConnection() {
        try {
            await this.reddit.getMe();
            return true;
        }
        catch (error) {
            console.error('Reddit connection test failed:', error);
            return false;
        }
    }
    /**
     * Refresh access token if needed
     */
    async refreshTokenIfNeeded() {
        try {
            // snoowrap handles token refresh automatically
            await this.reddit.getMe();
        }
        catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    }
}
/**
 * Initialize Reddit OAuth flow
 */
export function getRedditAuthUrl(state) {
    if (!process.env.REDDIT_CLIENT_ID) {
        throw new Error('Reddit OAuth credentials not configured');
    }
    // Always use a consistent redirect URI
    let redirectUri = process.env.REDDIT_REDIRECT_URI;
    if (!redirectUri) {
        // Use the primary domain from REPLIT_DOMAINS for consistency
        const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'thottopilot.com';
        const protocol = domain.includes('localhost') ? 'http' : 'https';
        redirectUri = `${protocol}://${domain}/api/reddit/callback`;
    }
    console.log('Reddit OAuth redirect URI (auth):', redirectUri);
    const baseUrl = 'https://www.reddit.com/api/v1/authorize';
    const params = new URLSearchParams({
        client_id: process.env.REDDIT_CLIENT_ID,
        response_type: 'code',
        state,
        redirect_uri: redirectUri,
        duration: 'permanent', // Request permanent access
        scope: 'identity submit edit read vote save history mysubreddits',
    });
    return `${baseUrl}?${params.toString()}`;
}
/**
 * Exchange authorization code for access token
 */
export async function exchangeRedditCode(code) {
    if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
        throw new Error('Reddit OAuth credentials not configured');
    }
    // Always use a consistent redirect URI (must match exactly)
    let redirectUri = process.env.REDDIT_REDIRECT_URI;
    if (!redirectUri) {
        // Use the primary domain from REPLIT_DOMAINS for consistency
        const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'thottopilot.com';
        const protocol = domain.includes('localhost') ? 'http' : 'https';
        redirectUri = `${protocol}://${domain}/api/reddit/callback`;
    }
    console.log('Reddit OAuth redirect URI (exchange):', redirectUri);
    try {
        const response = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'ThottoPilot/1.0',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            }),
        });
        if (!response.ok) {
            const body = await response.text();
            console.error('Reddit token exchange failed:', {
                status: response.status,
                statusText: response.statusText,
                body,
            });
            throw new Error(`Reddit token exchange failed: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.refresh_token) {
            console.warn('No refresh token returned from Reddit');
        }
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
        };
    }
    catch (error) {
        console.error('Reddit code exchange error:', error);
        throw error;
    }
}
