import type { Express } from 'express';
import { RedditManager, getRedditAuthUrl, exchangeRedditCode } from './lib/reddit.js';
import { db } from './db.js';
import { creatorAccounts } from '@shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticateToken } from './middleware/auth.js';

export function registerRedditRoutes(app: Express) {
  
  // Start Reddit OAuth flow
  app.get('/api/reddit/connect', authenticateToken, async (req: any, res) => {
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
      const state = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Store state in session for verification
      (req.session as any).redditOAuthState = state;
      
      const authUrl = getRedditAuthUrl(state);
      res.json({ authUrl });
      
    } catch (error) {
      console.error('Reddit connect error:', error);
      res.status(500).json({ error: 'Failed to initiate Reddit connection' });
    }
  });

  // Handle Reddit OAuth callback
  app.get('/api/reddit/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect('/dashboard?error=reddit_access_denied');
      }

      if (!code || !state) {
        return res.redirect('/dashboard?error=reddit_missing_params');
      }

      // Verify state parameter
      if (state !== (req.session as any).redditOAuthState) {
        return res.redirect('/dashboard?error=reddit_invalid_state');
      }

      // Extract user ID from state
      const userId = parseInt(state.toString().split('_')[0]);
      if (!userId) {
        return res.redirect('/dashboard?error=reddit_invalid_user');
      }

      // Exchange code for tokens
      const tokenData = await exchangeRedditCode(code.toString());
      
      // Get Reddit user info
      const tempReddit = new RedditManager(tokenData.accessToken, tokenData.refreshToken, userId);
      const profile = await tempReddit.getProfile();
      
      if (!profile) {
        return res.redirect('/dashboard?error=reddit_profile_failed');
      }

      // Store account in database
      await db
        .insert(creatorAccounts)
        .values({
          userId,
          platform: 'reddit',
          handle: profile.username,
          oauthToken: tokenData.accessToken,
          oauthRefresh: tokenData.refreshToken,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [creatorAccounts.userId, creatorAccounts.platform],
          set: {
            handle: profile.username,
            oauthToken: tokenData.accessToken,
            oauthRefresh: tokenData.refreshToken,
            isActive: true,
            updatedAt: new Date(),
          }
        });

      // Clear OAuth state
      delete (req.session as any).redditOAuthState;

      res.redirect('/dashboard?reddit=connected&username=' + encodeURIComponent(profile.username));
      
    } catch (error) {
      console.error('Reddit callback error:', error);
      res.redirect('/dashboard?error=reddit_connection_failed');
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
        username: account.platformUsername,
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
      
      const reddit = await RedditManager.forUser(userId);
      if (!reddit) {
        return res.status(404).json({ error: 'No active Reddit account found' });
      }

      const isConnected = await reddit.testConnection();
      
      if (isConnected) {
        const profile = await reddit.getProfile();
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

  // Manual post submission (for testing)
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

      const reddit = await RedditManager.forUser(userId);
      if (!reddit) {
        return res.status(404).json({ error: 'No active Reddit account found. Please connect your Reddit account first.' });
      }

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