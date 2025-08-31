import type { Express } from 'express';
import crypto from 'crypto';
import { RedditManager, getRedditAuthUrl, exchangeRedditCode } from './lib/reddit.js';
import { db } from './db.js';
import { creatorAccounts } from '@shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticateToken } from './middleware/auth.js';
import { stateStore, encrypt, decrypt, rateLimit } from './services/state-store.js';
import { redditCommunitiesDatabase, getCommunityInsights } from './reddit-communities.js';

export function registerRedditRoutes(app: Express) {
  
  // Start Reddit OAuth flow - SECURE VERSION
  app.get('/api/reddit/connect', rateLimit, authenticateToken, async (req: any, res) => {
    try {
      if (!process.env.REDDIT_CLIENT_ID) {
        return res.status(503).json({ 
          error: 'Reddit integration not configured. Please set REDDIT_CLIENT_ID and other Reddit environment variables.' 
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Generate cryptographically secure state
      const state = crypto.randomBytes(32).toString('hex');
      
      // Store state securely with user binding
      await stateStore.set(`reddit_state:${state}`, {
        userId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: Date.now()
      }, 600); // 10 minute expiry
      
      console.log('Reddit OAuth initiated:', {
        userId,
        state: state.substring(0, 8) + '...',
        ip: req.ip
      });
      
      const authUrl = getRedditAuthUrl(state);
      res.json({ authUrl });
      
    } catch (error) {
      console.error('Reddit connect error:', error);
      res.status(500).json({ error: 'Failed to initiate Reddit connection' });
    }
  });

  // Handle Reddit OAuth callback - SECURE VERSION
  app.get('/api/reddit/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.log('Reddit OAuth error:', error);
        return res.redirect('/dashboard?error=reddit_access_denied');
      }

      if (!code || !state) {
        console.log('Missing OAuth params:', { code: !!code, state: !!state });
        return res.redirect('/dashboard?error=reddit_missing_params');
      }

      // Validate state from secure store
      const stateData = await stateStore.get(`reddit_state:${state}`);
      
      if (!stateData) {
        console.error('Invalid or expired state:', state?.toString().substring(0, 8) + '...');
        return res.redirect('/dashboard?error=invalid_state');
      }
      
      // Additional security check - log if IP differs (but don't block)
      if (stateData.ip !== req.ip) {
        console.warn('IP mismatch in OAuth callback:', {
          original: stateData.ip,
          callback: req.ip,
          userId: stateData.userId
        });
      }
      
      // Clean up state immediately to prevent reuse
      await stateStore.delete(`reddit_state:${state}`);
      
      const userId = stateData.userId;
      console.log('Processing Reddit OAuth for user:', userId);

      // Exchange code for tokens
      const tokenData = await exchangeRedditCode(code.toString());
      
      if (!tokenData || !tokenData.accessToken) {
        console.error('Failed to exchange code for tokens');
        return res.redirect('/dashboard?error=reddit_token_exchange_failed');
      }
      
      // Get Reddit user info
      const tempReddit = new RedditManager(tokenData.accessToken, tokenData.refreshToken, userId);
      const profile = await tempReddit.getProfile();
      
      if (!profile) {
        console.error('Failed to fetch Reddit profile');
        return res.redirect('/dashboard?error=reddit_profile_failed');
      }

      console.log('Reddit profile fetched:', profile.username);

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

      console.log('Reddit account connected successfully for user:', userId);

      // Success redirect to dashboard
      res.redirect('/dashboard?reddit=connected&username=' + encodeURIComponent(profile.username));
      
    } catch (error) {
      console.error('Reddit callback error:', error);
      res.redirect('/dashboard?error=reddit_connection_failed');
    }
  });

  // Reddit communities listing
  app.get('/api/reddit/communities', async (req, res) => {
    try {
      const { category, search } = req.query;
      let communities = redditCommunitiesDatabase;

      if (category && category !== 'all') {
        communities = communities.filter(c => c.category === category);
      }

      if (search) {
        const term = (search as string).toLowerCase();
        communities = communities.filter(c =>
          c.name.toLowerCase().includes(term) ||
          c.displayName.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term) ||
          c.tags.some(tag => tag.toLowerCase().includes(term))
        );
      }

      res.json(communities);
    } catch (error) {
      console.error('Error fetching Reddit communities:', error);
      res.status(500).json({ error: 'Failed to fetch Reddit communities' });
    }
  });

  // Detailed community insights
  app.get('/api/reddit/community-insights/:communityId', async (req, res) => {
    try {
      const { communityId } = req.params;
      const insights = getCommunityInsights(communityId);
      res.json(insights);
    } catch (error) {
      console.error('Error fetching community insights:', error);
      res.status(500).json({ error: 'Failed to fetch community insights' });
    }
  });

  // Get user's Reddit connections
  app.get('/api/reddit/accounts', authenticateToken, async (req: any, res) => {
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
        karma: (account.metadata as any)?.karma || 0,
        verified: (account.metadata as any)?.verified || false,
      })));

    } catch (error) {
      console.error('Error fetching Reddit accounts:', error);
      res.status(500).json({ error: 'Failed to fetch Reddit accounts' });
    }
  });

  // Disconnect Reddit account
  app.delete('/api/reddit/accounts/:accountId', authenticateToken, async (req: any, res) => {
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
      console.error('Error disconnecting Reddit account:', error);
      res.status(500).json({ error: 'Failed to disconnect Reddit account' });
    }
  });

  // Test Reddit connection
  app.post('/api/reddit/test', authenticateToken, async (req: any, res) => {
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
        return res.status(404).json({ error: 'No active Reddit account found' });
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
        const profile = await reddit.getProfile();
        
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
        res.json({ connected: false });
      }

    } catch (error) {
      console.error('Reddit test error:', error);
      res.status(500).json({ error: 'Failed to test Reddit connection' });
    }
  });

  // Manual post submission
  app.post('/api/reddit/submit', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { subreddit, title, body, url, nsfw } = req.body;

      if (!subreddit || !title) {
        return res.status(400).json({ error: 'Subreddit and title are required' });
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
        return res.status(404).json({ error: 'No active Reddit account found. Please connect your Reddit account first.' });
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
      
      const result = await reddit.submitPost({
        subreddit,
        title,
        body,
        url,
        nsfw: nsfw || false
      });

      if (result.success) {
        res.json({
          success: true,
          postId: result.postId,
          url: result.url,
          message: 'Post submitted successfully to Reddit'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Reddit submit error:', error);
      res.status(500).json({ error: 'Failed to submit post to Reddit' });
    }
  });
}