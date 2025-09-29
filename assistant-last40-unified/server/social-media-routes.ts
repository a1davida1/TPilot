import type { Express, Request } from "express";
import { socialMediaManager, type Platform, type PostContent } from "./social-media/social-media-manager.js";
import { 
  sanitizeAccountMetadata, 
  extractStringMetadata, 
  getCredentialSet, 
  credentialSetToStringRecord,
  type AccountCredentialRole 
} from "./social-media/account-metadata.js";
import { storage } from "./storage.js";
import { authenticateToken } from "./middleware/auth.js";
import type { SocialMediaAccount, User } from "@shared/schema";

interface AuthRequest<
  B = Record<string, unknown>,
  P = Record<string, string>,
  Q = Record<string, string>
> extends Request<P, unknown, B, Q> {
  user?: User;
}

// PHASE 2: Social Media API Routes

// Connect social media account
export function registerSocialMediaRoutes(app: Express) {
  
  // Connect a social media account
  app.post(
    "/api/social-media/connect",
    authenticateToken,
    async (
      req: AuthRequest<{
        platform: Platform;
        credentials: Record<string, string>;
        accountInfo: Record<string, unknown>;
      }>,
      res
    ) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { platform, credentials, accountInfo } = req.body as {
        platform: Platform;
        credentials: Record<string, string>;
        accountInfo: Record<string, unknown>;
      };
      
      if (!platform || !credentials) {
        return res.status(400).json({ message: "Platform and credentials are required" });
      }

      // Save account to database
      const accountData = {
        userId: req.user.id,
        platform,
        accountId: (accountInfo.accountId as string) || (credentials.accountId as string),
        username: (accountInfo.username as string) || 'unknown',
        displayName: (accountInfo.displayName as string) || null,
        profilePicture: (accountInfo.profilePicture as string) || null,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        tokenExpiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : undefined,
        metadata: accountInfo.metadata || {},
      };
      
      // Save account using storage
      const account = await storage.createSocialMediaAccount(accountData);
      
      // Connect to the platform API
      try {
        socialMediaManager.connectAccount(platform, account.id.toString(), credentials);
      } catch (error) {
        await storage.updateSocialMediaAccount(account.id, { isActive: false });
        throw error;
      }

      res.json({
        success: true,
        account: {
          id: account.id,
          platform: account.platform,
          username: account.username,
          displayName: account.displayName,
          isActive: account.isActive,
        },
      });
    } catch (error) {
      console.error("Error connecting social media account:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to connect social media account",
        error: error instanceof Error ? (error as Error).message : "Unknown error"
      });
    }
  });

  // Get connected accounts
  app.get("/api/social-media/accounts", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const accounts = await storage.getUserSocialMediaAccounts(req.user.id);
      
      res.json({
        success: true,
        accounts: accounts.map(account => ({
          id: account.id,
          platform: account.platform,
          username: account.username,
          displayName: account.displayName,
          profilePicture: account.profilePicture,
          isActive: account.isActive,
          lastSyncAt: account.lastSyncAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching social media accounts:", error);
      res.status(500).json({ message: "Failed to fetch social media accounts" });
    }
  });

  // Disconnect social media account
  app.delete("/api/social-media/accounts/:accountId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { accountId } = req.params;
      const account = await storage.getSocialMediaAccount(parseInt(accountId));

      if (!account || account.userId !== req.user.id) {
        return res.status(404).json({ message: "Account not found" });
      }

      // Disconnect from API manager
      socialMediaManager.disconnect(account.platform as Platform, account.id.toString());

      // Deactivate in database
      await storage.updateSocialMediaAccount(parseInt(accountId), { isActive: false });

      res.json({ success: true, message: "Account disconnected" });
    } catch (error) {
      console.error("Error disconnecting social media account:", error);
      res.status(500).json({ message: "Failed to disconnect account" });
    }
  });

  // Post to social media
  app.post(
    "/api/social-media/post",
    authenticateToken,
    async (
      req: AuthRequest<{
        platforms: Platform[];
        content: PostContent;
        contentGenerationId?: number;
        scheduledAt?: string;
      }>,
      res
    ) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { platforms, content, contentGenerationId, scheduledAt } = req.body;

      if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ message: "At least one platform must be specified" });
      }

      if (!content || !content.text) {
        return res.status(400).json({ message: "Content text is required" });
      }

      const userAccounts = await storage.getUserSocialMediaAccounts(req.user.id);
      const targetAccounts = userAccounts.filter(
        account =>
          account.isActive &&
          platforms.includes(account.platform as Platform) &&
          typeof account.accessToken === 'string' &&
          account.accessToken.length > 0
      );

      if (targetAccounts.length === 0) {
        return res.status(400).json({
          message: "No connected accounts found for the specified platforms"
        });
      }

      // Initialize social media connections
      for (const account of targetAccounts) {
        const credentials: Record<string, string> = {
          accessToken: account.accessToken || '',
          ...(account.refreshToken && { refreshToken: account.refreshToken }),
          // Add platform-specific credentials based on metadata
          ...(typeof account.metadata === 'object' && account.metadata ? account.metadata : {}),
        };
        socialMediaManager.connectAccount(account.platform as Platform, account.id.toString(), credentials);
      }

      let results;

      if (scheduledAt) {
        // Schedule the post
        const scheduleData = {
          userId: req.user.id,
          contentGenerationId,
          platforms: targetAccounts.map(account => account.platform as Platform),
          scheduledTime: new Date(scheduledAt),
          status: 'pending' as const,
          metadata: { content },
        };

        const schedule = await storage.createPostSchedule(scheduleData);
        
        results = targetAccounts.map(account => ({
          platform: account.platform as Platform,
          clientKey: account.id.toString(),
          success: true,
          scheduled: true,
          scheduleId: schedule.id,
        }));
      } else {
        // Post immediately
        const postContent: PostContent = {
          text: content.text,
          mediaUrls: content.mediaUrls,
          hashtags: content.hashtags,
          title: content.title,
          description: content.description,
        };

        const targets = targetAccounts.map(account => ({
          platform: account.platform as Platform,
          key: account.id.toString()
        }));

        results = await socialMediaManager.postToMultiplePlatforms(targets, postContent);

        // Save posts to database
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const account = targetAccounts.find(acc => acc.id.toString() === result.clientKey);

          if (account) {
            const postData = {
              userId: req.user.id,
              accountId: account.id,
              contentGenerationId,
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
      }

      res.json({
        success: true,
        results,
        scheduled: !!scheduledAt,
      });
    } catch (error) {
      console.error("Error posting to social media:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to post to social media",
        error: error instanceof Error ? (error as Error).message : "Unknown error"
      });
    }
  });

  // Get post history
  app.get("/api/social-media/posts", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { platform, status, limit = 50, offset = 0 } = req.query;
      
      const posts = await storage.getUserSocialMediaPosts(
        req.user.id,
        {
          platform: platform as string,
          status: status as string,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        }
      );

      res.json({
        success: true,
        posts: posts.map(post => ({
          id: post.id,
          platform: post.platform,
          content: post.content,
          status: post.status,
          publishedAt: post.publishedAt,
          engagement: post.engagement,
          mediaUrls: post.mediaUrls,
          hashtags: post.hashtags,
        })),
      });
    } catch (error) {
      console.error("Error fetching social media posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Get engagement metrics
  app.get("/api/social-media/metrics/:postId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { postId } = req.params;
      const post = await storage.getSocialMediaPost(parseInt(postId));

      if (!post || post.userId !== req.user.id) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (!post.platformPostId) {
        return res.status(400).json({ message: "Post not published to platform" });
      }

      // Get account for this post
      const account = await storage.getSocialMediaAccount(post.accountId);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      // Initialize connection using sync credentials when available
      const sanitizedAccountMetadata = sanitizeAccountMetadata(account.metadata);
      const metadataStrings = extractStringMetadata(sanitizedAccountMetadata);
      const syncSet = getCredentialSet(sanitizedAccountMetadata, 'sync');
      let connectionRole: AccountCredentialRole = 'sync';
      let credentialSetForRole = syncSet;

      if (!syncSet || Object.keys(credentialSetToStringRecord(syncSet)).length === 0) {
        connectionRole = 'posting';
        credentialSetForRole = getCredentialSet(sanitizedAccountMetadata, 'posting');
      }

      let connectionCredentials: Record<string, string> = {
        ...(account.accessToken && { accessToken: account.accessToken }),
        ...(account.refreshToken && { refreshToken: account.refreshToken }),
        ...metadataStrings,
        ...credentialSetToStringRecord(credentialSetForRole),
      };
      
      if (connectionCredentials.accessToken) {
        socialMediaManager.connectAccount(account.platform as Platform, account.id.toString(), connectionCredentials);
      }

      // Get metrics from platform
      const metrics = await socialMediaManager.getPostMetrics(
        account.platform as Platform,
        account.id.toString(),
        post.platformPostId
      );

      if (metrics) {
        // Update metrics in database
        await storage.updateSocialMediaPost(post.id, {
          engagement: {
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            views: metrics.views,
            retweets: metrics.retweets,
            quotes: metrics.quotes,
          },
          lastEngagementSync: new Date(),
        });
      }

      res.json({
        success: true,
        metrics: metrics || post.engagement,
      });
    } catch (error) {
      console.error("Error fetching post metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Get scheduled posts
  app.get("/api/social-media/scheduled", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const scheduledPosts = await storage.getUserScheduledPosts(req.user.id);

      res.json({
        success: true,
        scheduledPosts: scheduledPosts.map(post => ({
          id: post.id,
          platforms: post.platforms,
          scheduledTime: post.scheduledTime,
          status: post.status,
          content: post.metadata,
          nextExecution: post.nextExecution,
        })),
      });
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
      res.status(500).json({ message: "Failed to fetch scheduled posts" });
    }
  });

  // Cancel scheduled post
  app.delete("/api/social-media/scheduled/:scheduleId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { scheduleId } = req.params;
      const schedule = await storage.getPostSchedule(parseInt(scheduleId));

      if (!schedule || schedule.userId !== req.user.id) {
        return res.status(404).json({ message: "Scheduled post not found" });
      }

      await storage.updatePostSchedule(parseInt(scheduleId), { 
        status: 'cancelled' 
      });

      res.json({ success: true, message: "Scheduled post cancelled" });
    } catch (error) {
      console.error("Error cancelling scheduled post:", error);
      res.status(500).json({ message: "Failed to cancel scheduled post" });
    }
  });
}