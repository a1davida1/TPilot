import type { Express } from 'express';
import crypto from 'crypto';
import { RedditManager, getRedditAuthUrl, exchangeRedditCode, type RedditPostResult } from './lib/reddit.js';
import { SafetyManager } from './lib/safety-systems.js';
import { db } from './db.js';
import { creatorAccounts, type ShadowbanCheckApiResponse } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { authenticateToken, type AuthRequest } from './middleware/auth.js';
import { stateStore, encrypt, decrypt, rateLimit } from './services/state-store.js';
import {
  listCommunities,
  searchCommunities,
  getCommunityInsights,
  createCommunity,
  updateCommunity,
  deleteCommunity
} from './reddit-communities.js';
import { getUserRedditCommunityEligibility } from './lib/reddit.js';
import { logger } from './bootstrap/logger.js';
import { recordPostOutcome, summarizeRemovalReasons } from './compliance/ruleViolationTracker.js';
import { redditIntelligenceService } from './services/reddit-intelligence.js';

interface RedditProfile {
  username: string;
  karma?: number;
  verified?: boolean;
}

type SessionWithUser = {
  user?: AuthRequest['user'];
};

const REDDIT_OAUTH_INTENTS = ['account-link', 'posting', 'intelligence'] as const;

type RedditOAuthIntent = typeof REDDIT_OAUTH_INTENTS[number];

interface RedditOAuthStateData {
  userId: number;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  intent: RedditOAuthIntent;
  queue?: string;
}

const isSupportedIntent = (value: string): value is RedditOAuthIntent => (
  (REDDIT_OAUTH_INTENTS as readonly string[]).includes(value)
);

const parseQueryValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
};

const isValidQueueName = (value: string): boolean => /^[a-zA-Z0-9_-]{1,64}$/.test(value);

const buildRedirectLocation = (intent: RedditOAuthIntent, username: string, queue?: string) => {
  const params = new URLSearchParams();
  params.set('reddit', 'connected');
  params.set('username', username);
  params.set('intent', intent);
  if (queue) {
    params.set('queue', queue);
  }

  switch (intent) {
    case 'posting':
      {
        const queryString = params.toString();
        return queryString ? `/reddit?${queryString}` : '/reddit';
      }
    case 'intelligence':
      params.set('tab', 'intelligence');
      return `/phase4?${params.toString()}`;
    case 'account-link':
    default:
      return `/dashboard?${params.toString()}`;
  }
};

const isOAuthStateData = (value: unknown): value is RedditOAuthStateData => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<RedditOAuthStateData>;
  if (typeof candidate.userId !== 'number') {
    return false;
  }
  if (typeof candidate.timestamp !== 'number') {
    return false;
  }
  if (typeof candidate.intent !== 'string' || !isSupportedIntent(candidate.intent)) {
    return false;
  }

  if (candidate.queue !== undefined && typeof candidate.queue !== 'string') {
    return false;
  }

  return true;
};

export function registerRedditRoutes(app: Express) {

  // Start Reddit OAuth flow - SECURE VERSION
  app.get('/api/reddit/connect', rateLimit, authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!process.env.REDDIT_CLIENT_ID) {
        return res.status(503).json({
          error: 'Reddit integration not configured. Please set REDDIT_CLIENT_ID and other Reddit environment variables.'
        });
      }

      const sessionUser = (req.session as SessionWithUser | undefined)?.user;
      if (!req.user && sessionUser) {
        req.user = sessionUser;
      }

      const userId = req.user?.id ?? sessionUser?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const intentParam = parseQueryValue(req.query.intent);
      if (!intentParam) {
        return res.status(400).json({ error: 'Missing Reddit OAuth intent' });
      }

      if (!isSupportedIntent(intentParam)) {
        return res.status(400).json({ error: 'Unsupported Reddit OAuth intent' });
      }

      const queueParam = parseQueryValue(req.query.queue);
      if (queueParam && !isValidQueueName(queueParam)) {
        return res.status(400).json({ error: 'Invalid Reddit OAuth queue identifier' });
      }
      const queue = queueParam ?? undefined;

      // Generate cryptographically secure state token with intent prefix
      const stateSlug = crypto.randomBytes(32).toString('hex');
      const state = `${intentParam}:${stateSlug}`;

      const requestIP = req.userIP ?? req.ip;

      // Store state securely with user binding
      await stateStore.set(`reddit_state:${state}`, {
        userId,
        ip: requestIP,
        userAgent: req.get('user-agent'),
        timestamp: Date.now(),
        intent: intentParam,
        queue
      }, 600); // 10 minute expiry

      logger.info('Reddit OAuth initiated', {
        userId,
        statePreview: state.substring(0, 8) + '...',
        requestIP,
        intent: intentParam,
        queue
      });

      const authUrl = getRedditAuthUrl(state);
      res.json({ authUrl });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Reddit connect error', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Failed to initiate Reddit connection' });
    }
  });

  app.get('/api/reddit/intelligence', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const dataset = await redditIntelligenceService.getIntelligence({ userId: req.user.id });
      res.json(dataset);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Reddit intelligence endpoint failed', { error: err.message });
      res.status(500).json({ error: 'Failed to load Reddit intelligence' });
    }
  });

  // Handle Reddit OAuth callback - SECURE VERSION
  app.get('/api/reddit/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        logger.warn('Reddit OAuth error', { error });
        return res.redirect('/dashboard?error=reddit_access_denied');
      }

      const codeValue = parseQueryValue(code);
      const stateValue = parseQueryValue(state);

      if (!codeValue || !stateValue) {
        logger.warn('Missing OAuth params', { hasCode: !!code, hasState: !!state });
        return res.redirect('/dashboard?error=reddit_missing_params');
      }

      const [stateIntent, stateSlug] = stateValue.split(':', 2);

      if (!stateIntent || !stateSlug || !isSupportedIntent(stateIntent)) {
        logger.error('Invalid OAuth state format', { statePreview: stateValue.substring(0, 8) + '...' });
        return res.redirect('/dashboard?error=invalid_state');
      }

      const stateKey = `reddit_state:${stateValue}`;

      // Validate state from secure store
      const stateRaw = await stateStore.get(stateKey);
      const stateData = isOAuthStateData(stateRaw) ? stateRaw : null;

      if (!stateData) {
        logger.error('Invalid or expired state', {
          statePreview: stateValue.substring(0, 8) + '...'
        });
        return res.redirect('/dashboard?error=invalid_state');
      }

      if (stateData.intent !== stateIntent) {
        logger.error('State intent mismatch detected', {
          storedIntent: stateData.intent,
          tokenIntent: stateIntent,
        });
        await stateStore.delete(stateKey);
        return res.redirect('/dashboard?error=invalid_state');
      }

      const callbackIP = req.userIP ?? req.ip;

      // Additional security check - log if IP differs (but don't block)
      if (stateData.ip !== callbackIP) {
        logger.warn('IP mismatch in OAuth callback', {
          originalIP: stateData.ip,
          callbackIP,
          userId: stateData.userId
        });
      }

      // Clean up state immediately to prevent reuse
      await stateStore.delete(stateKey);

      const userId = stateData.userId;
      logger.info('Processing Reddit OAuth for user', { userId });

      // Exchange code for tokens
      let tokenData;
      try {
        tokenData = await exchangeRedditCode(codeValue);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Reddit token exchange error', { error: (error as Error).message, stack: error.stack });
        return res.redirect('/dashboard?error=reddit_token_exchange_failed');
      }

      if (!tokenData || !tokenData.accessToken) {
        logger.error('Failed to exchange code for tokens');
        return res.redirect('/dashboard?error=reddit_token_exchange_failed');
      }

      if (!tokenData.refreshToken) {
        logger.warn('Reddit token response missing refresh token', { userId });
      }

      // Get Reddit user info
      const tempReddit = new RedditManager(tokenData.accessToken, tokenData.refreshToken, userId);
      const redditProfile = await tempReddit.getProfile();
      const profile = redditProfile as RedditProfile;

      if (!profile) {
        logger.error('Failed to fetch Reddit profile');
        return res.redirect('/dashboard?error=reddit_profile_failed');
      }

      logger.info('Reddit profile fetched', { username: profile.username });

      // Encrypt tokens before storing
      const encryptedAccessToken = encrypt(tokenData.accessToken);
      const encryptedRefreshToken = tokenData.refreshToken ? encrypt(tokenData.refreshToken) : null;

      // Store account in database
      await db
        .insert(creatorAccounts)
        .values({
          userId,
          platform: 'reddit',
          handle: profile.username,
          platformUsername: profile.username,
          oauthToken: encryptedAccessToken,
          oauthRefresh: encryptedRefreshToken || '',
          isActive: true,
          metadata: {
            karma: profile.karma || 0,
            verified: profile.verified || false,
            tokenExpiry: Date.now() + (3600 * 1000) // 1 hour default
          }
        })
        .onConflictDoUpdate({
          target: [creatorAccounts.userId, creatorAccounts.platform],
          set: {
            handle: profile.username,
            platformUsername: profile.username,
            oauthToken: encryptedAccessToken,
            oauthRefresh: encryptedRefreshToken || '',
            isActive: true,
            metadata: {
              karma: profile.karma || 0,
              verified: profile.verified || false,
              tokenExpiry: Date.now() + (3600 * 1000)
            },
            updatedAt: new Date(),
          }
        });

      logger.info('Reddit account connected successfully', { userId });

      // Success redirect to dashboard
      const redirectLocation = buildRedirectLocation(stateIntent, profile.username, stateData.queue);
      res.redirect(redirectLocation);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Reddit callback error', { error: err.message, stack: err.stack });
      res.redirect('/dashboard?error=reddit_connection_failed');
    }
  });

  // Reddit communities listing
  app.get('/api/reddit/communities', authenticateToken(true), async (req: AuthRequest, res) => {
    try {
      const { category, search } = req.query;
      let communities = search
        ? await searchCommunities(search as string)
        : await listCommunities();
      if (category && category !== 'all') {
        communities = communities.filter(c => c.category === category);
      }

      // Ensure checkedAt is always present (null if undefined) to prevent UI crashes
      const { redditCommunityArrayZodSchema } = await import('@shared/schema');

      const validatedCommunities = redditCommunityArrayZodSchema.parse(communities);
      res.json(validatedCommunities);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error fetching Reddit communities', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Failed to fetch Reddit communities', items: [] });
    }
  });

  // Detailed community insights
  app.get('/api/reddit/community-insights/:communityId', authenticateToken(true), async (req: AuthRequest, res) => {
    try {
      const { communityId } = req.params;
      const insights = await getCommunityInsights(communityId);
      res.json(insights);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error fetching community insights', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Failed to fetch community insights' });
    }
  });

  // Get user's Reddit connections
  app.get('/api/reddit/accounts', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const accounts = await db
        .select()
        .from(creatorAccounts)
        .where(
          and(
            eq(creatorAccounts.userId, userId),
            eq(creatorAccounts.platform, 'reddit')
          )
        );

      res.json(accounts.map(account => ({
        id: account.id,
        username: account.platformUsername || account.handle,
        isActive: account.isActive,
        connectedAt: account.createdAt,
        karma: (account.metadata as Record<string, unknown>)?.karma as number || 0,
        verified: (account.metadata as Record<string, unknown>)?.verified as boolean || false,
      })));

    } catch (error) {
      logger.error('Error fetching Reddit accounts', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to fetch Reddit accounts' });
    }
  });

  app.get('/api/reddit/shadowban-status', rateLimit, authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const fallbackEvidence: ShadowbanCheckApiResponse['evidence'] = {
      username: 'unknown',
      checkedAt: new Date().toISOString(),
      privateCount: 0,
      publicCount: 0,
      privateSubmissions: [],
      publicSubmissions: [],
      missingSubmissionIds: [],
    };

    try {
      const redditManager = await RedditManager.forUser(userId);

      if (!redditManager) {
        return res.json({
          status: 'unknown' as const,
          reason: 'No active Reddit account connected.',
          evidence: fallbackEvidence,
        });
      }

      const status = await redditManager.checkShadowbanStatus();
      return res.json(status);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Shadowban status check failed', { userId, error: err.message, stack: err.stack });
      return res.status(500).json({
        error: 'Failed to check Reddit shadowban status',
        details: err.message,
      });
    }
  });

  // Disconnect Reddit account
  app.delete('/api/reddit/accounts/:accountId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { accountId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      await db
        .update(creatorAccounts)
        .set({ 
          isActive: false,
          oauthToken: '', // Clear tokens on disconnect
          oauthRefresh: '',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(creatorAccounts.id, parseInt(accountId)),
            eq(creatorAccounts.userId, userId),
            eq(creatorAccounts.platform, 'reddit')
          )
        );

      res.json({ message: 'Reddit account disconnected successfully' });

    } catch (error) {
      logger.error('Error disconnecting Reddit account', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to disconnect Reddit account' });
    }
  });

  // Test Reddit connection
  app.post('/api/reddit/test', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get account from database
      const accounts = await db
        .select()
        .from(creatorAccounts)
        .where(
          and(
            eq(creatorAccounts.userId, userId),
            eq(creatorAccounts.platform, 'reddit'),
            eq(creatorAccounts.isActive, true)
          )
        )
        .limit(1);

      if (accounts.length === 0) {
        return res.status(200).json({
          connected: false,
          profile: null,
          message: 'No active Reddit account found'
        });
      }

      const account = accounts[0];

      // Decrypt tokens
      const accessToken = account.oauthToken ? decrypt(account.oauthToken) : null;
      const refreshToken = account.oauthRefresh ? decrypt(account.oauthRefresh) : null;

      if (!accessToken) {
        return res.status(401).json({ error: 'Invalid tokens. Please reconnect your Reddit account.' });
      }

      // Create Reddit manager with decrypted tokens
      const reddit = new RedditManager(accessToken, refreshToken || '', userId);
      const isConnected = await reddit.testConnection();

      if (isConnected) {
        const fetchedProfile = await reddit.getProfile();
        const profile = fetchedProfile as RedditProfile | null;

        // Update metadata with latest info
        if (profile) {
          await db
            .update(creatorAccounts)
            .set({
              metadata: {
                karma: profile.karma || 0,
                verified: profile.verified || false,
                lastTested: Date.now()
              },
              updatedAt: new Date()
            })
            .where(eq(creatorAccounts.id, account.id));
        }

        res.json({ 
          connected: true, 
          profile: {
            username: profile?.username,
            karma: profile?.karma,
            verified: profile?.verified
          }
        });
      } else {
        res.json({
          connected: false,
          profile: null
        });
      }

    } catch (error) {
      logger.error('Reddit test error', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to test Reddit connection' });
    }
  });

  // Enhanced submit endpoint with image support
  app.post('/api/reddit/submit', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const subreddit = typeof req.body?.subreddit === 'string' ? req.body.subreddit : undefined;

    try {
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { title, body, url, nsfw, spoiler, postType, imageData } = req.body;

      if (!subreddit || !title) {
        return res.status(400).json({ error: 'Subreddit and title are required' });
      }

      // Get Reddit manager
      const reddit = await RedditManager.forUser(userId);
      if (!reddit) {
        return res.status(404).json({ 
          error: 'No active Reddit account found. Please connect your Reddit account first.' 
        });
      }

      let result: RedditPostResult;

      // Handle different post types
      switch (postType || 'text') {
        case 'image': {
          // Single image post
          if (!imageData && !url) {
            return res.status(400).json({ error: 'Image data or URL required for image post' });
          }

          let imageBuffer: Buffer | undefined;
          if (imageData) {
            // Convert base64 to buffer if needed
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
          }

          result = await reddit.submitImagePost({
            subreddit,
            title,
            imageBuffer,
            imageUrl: url,
            nsfw: nsfw || false,
            spoiler: spoiler || false
          });
          break;
        }

        case 'gallery': {
          // Multiple images
          if (!req.body.images || !Array.isArray(req.body.images)) {
            return res.status(400).json({ error: 'Images array required for gallery post' });
          }

          const typedImages =
            req.body.images as Array<{ url: string; caption?: string }>;
          const images = typedImages.map(img => ({
            url: img.url,
            caption: img.caption || ''
          }));

          result = await reddit.submitGalleryPost({
            subreddit,
            title,
            images,
            nsfw: nsfw || false
          });
          break;
        }

        case 'link':
          // Link post
          if (!url) {
            return res.status(400).json({ error: 'URL required for link post' });
          }

          result = await reddit.submitPost({
            subreddit,
            title,
            url,
            nsfw: nsfw || false,
            spoiler: spoiler || false
          });
          break;

        case 'text':
        default:
          // Text post
          result = await reddit.submitPost({
            subreddit,
            title,
            body: body || '',
            nsfw: nsfw || false,
            spoiler: spoiler || false
          });
          break;
      }

      if (result.success) {
        try {
          await recordPostOutcome(userId, subreddit, { status: 'posted' });
        } catch (trackingError) {
          logger.warn('Failed to persist successful Reddit outcome', {
            userId,
            subreddit,
            error: trackingError instanceof Error ? trackingError.message : String(trackingError)
          });
        }
        logger.info('Reddit post successful', {
          userId,
          subreddit,
          postType,
          url: result.url
        });

        // Record post for rate limiting and duplicate detection
        try {
          await SafetyManager.recordPost(userId.toString(), subreddit);
          await SafetyManager.recordPostForDuplicateDetection(
            userId.toString(), 
            subreddit, 
            title, 
            body || url || ''
          );
          logger.info('Recorded safety signals for Reddit submission', {
            userId,
            subreddit,
          });
        } catch (safetyError) {
          logger.warn('Failed to record safety signals', {
            userId,
            subreddit,
            error: safetyError instanceof Error ? safetyError.message : String(safetyError),
            stack: safetyError instanceof Error ? safetyError.stack : undefined,
          });
          // Don't fail the request if safety recording fails
        }

        res.json({
          success: true,
          postId: result.postId,
          url: result.url,
          message: `Post submitted successfully to r/${subreddit}`,
          warnings: result.decision?.warnings || []
        });
      } else {
        const decisionReasons = Array.isArray(result.decision?.reasons) ? result.decision?.reasons.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : [];
        const removalReason = result.error
          ?? (typeof result.decision?.reason === 'string' ? result.decision.reason : undefined)
          ?? decisionReasons[0]
          ?? 'Reddit posting failed';

        try {
          await recordPostOutcome(userId, subreddit, {
            status: 'removed',
            reason: removalReason,
          });
        } catch (trackingError) {
          logger.warn('Failed to persist removal outcome', {
            userId,
            subreddit,
            error: trackingError instanceof Error ? trackingError.message : String(trackingError)
          });
        }
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to submit post',
          reason: result.decision?.reason,
          reasons: result.decision?.reasons || [],
          warnings: result.decision?.warnings || [],
          nextAllowedPost: result.decision?.nextAllowedPost,
          rateLimit: {
            postsInLast24h: result.decision?.postsInLast24h || 0,
            maxPostsPer24h: result.decision?.maxPostsPer24h || 3
          }
        });
      }

    } catch (error: unknown) {
      const failureMessage = error instanceof Error
        ? error.message
        : 'Failed to submit post to Reddit';

      if (userId && subreddit) {
        try {
          await recordPostOutcome(userId, subreddit, {
            status: 'removed',
            reason: failureMessage,
          });
        } catch (trackingError) {
          logger.warn('Failed to persist failure outcome', {
            userId,
            subreddit,
            error: trackingError instanceof Error ? trackingError.message : String(trackingError)
          });
        }
      }

      logger.error('Reddit submit error', {
        userId,
        subreddit,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        error: failureMessage
      });
    }
  });

  // Add new endpoint to check subreddit capabilities
  app.get('/api/reddit/subreddit/:name/capabilities', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const reddit = await RedditManager.forUser(userId);
      if (!reddit) {
        return res.status(404).json({ error: 'No Reddit account connected' });
      }

      const capabilities = await reddit.checkSubredditCapabilities(req.params.name);
      res.json(capabilities);

    } catch (error) {
      logger.error('Error checking subreddit capabilities', {
        userId: req.user?.id,
        subreddit: req.params.name,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: 'Failed to check subreddit' });
    }
  });

  // Get eligible communities for authenticated user
  app.get('/api/reddit/communities/eligible', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const eligibility = await getUserRedditCommunityEligibility(userId);

      if (!eligibility) {
        return res.status(404).json({ 
          error: 'No Reddit account connected',
          karma: null,
          accountAgeDays: null,
          verified: false,
          communities: [],
          profileLoaded: false
        });
      }

      res.json(eligibility);

    } catch (error) {
      logger.error('Error fetching eligible communities', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ 
        error: 'Failed to fetch eligible communities',
        karma: null,
        accountAgeDays: null,
        verified: false,
        communities: [],
        profileLoaded: false
      });
    }
  });

  // Check shadowban status for authenticated user
  app.get('/api/reddit/shadowban-status', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const reddit = await RedditManager.forUser(userId);
      if (!reddit) {
        return res.status(404).json({
          isShadowbanned: false,
          statusMessage: 'No Reddit account connected',
          checkedAt: new Date().toISOString(),
          publicCount: 0,
          totalSelfPosts: 0,
          hiddenPosts: [],
          error: 'No Reddit account connected'
        });
      }

      const shadowbanResult = await reddit.checkShadowbanStatus();

      logger.info('Shadowban status checked', {
        userId,
        isShadowbanned: shadowbanResult.isShadowbanned,
        publicCount: shadowbanResult.publicCount,
        totalSelfPosts: shadowbanResult.totalSelfPosts,
        hiddenCount: shadowbanResult.hiddenPosts.length
      });

      res.json(shadowbanResult);

    } catch (error) {
      logger.error('Error checking shadowban status', { 
        userId: req.user?.id, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        isShadowbanned: false,
        statusMessage: 'Failed to check shadowban status',
        checkedAt: new Date().toISOString(),
        publicCount: 0,
        totalSelfPosts: 0,
        hiddenPosts: [],
        error: 'Failed to check shadowban status'
      });
    }
  });

  // Get compliance removal summary for authenticated user
  app.get('/api/reddit/compliance/removal-summary', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const summary = await summarizeRemovalReasons(userId);

      logger.info('Compliance removal summary requested', {
        userId,
        totalRemovals: summary.total,
        reasonCount: Object.keys(summary.byReason).length
      });

      res.json(summary);

    } catch (error) {
      logger.error('Error fetching compliance removal summary', { 
        userId: req.user?.id, 
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        total: 0,
        byReason: {},
        error: 'Failed to fetch removal summary'
      });
    }
  });

  // Admin CRUD endpoints
  app.post('/api/reddit/communities', authenticateToken, async (req: AuthRequest, res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    try {
      const community = await createCommunity(req.body);
      await redditIntelligenceService.invalidateCache();
      res.json(community);
    } catch (_e) {
      res.status(400).json({ error: 'Invalid community data' });
    }
  });

  app.put('/api/reddit/communities/:id', authenticateToken, async (req: AuthRequest, res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    try {
      const community = await updateCommunity(req.params.id, req.body);
      await redditIntelligenceService.invalidateCache();
      res.json(community);
    } catch (_e) {
      res.status(400).json({ error: 'Invalid community data' });
    }
  });

  app.delete('/api/reddit/communities/:id', authenticateToken, async (req: AuthRequest, res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    try {
      await deleteCommunity(req.params.id);
      await redditIntelligenceService.invalidateCache();
      res.json({ success: true });
    } catch (_e) {
      res.status(500).json({ error: 'Failed to delete community' });
    }
  });
}