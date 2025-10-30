/**
 * Integration Tests for Reddit Sync API Endpoints
 * Tests tier-based access control and sync job queueing
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../server/app.js';
import { db } from '../../server/db.js';
import { users, creatorAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('Reddit Sync API Endpoints', () => {
  let app: Express;
  let freeUserToken: string;
  let proUserToken: string;
  let premiumUserToken: string;
  let freeUserId: number;
  let proUserId: number;
  let premiumUserId: number;

  beforeAll(async () => {
    // Create test app
    const { app: testApp } = await createApp({
      startQueue: false, // Don't start queue for tests
      configureStaticAssets: false,
      enableVite: false,
    });
    app = testApp;

    // Create test users with different tiers
    const [freeUser] = await db.insert(users).values({
      email: 'free@test.com',
      username: 'freeuser',
      tier: 'free',
    }).returning();
    freeUserId = freeUser.id;

    const [proUser] = await db.insert(users).values({
      email: 'pro@test.com',
      username: 'prouser',
      tier: 'pro',
    }).returning();
    proUserId = proUser.id;

    const [premiumUser] = await db.insert(users).values({
      email: 'premium@test.com',
      username: 'premiumuser',
      tier: 'premium',
    }).returning();
    premiumUserId = premiumUser.id;

    // Create Reddit accounts for each user
    await db.insert(creatorAccounts).values([
      {
        userId: freeUserId,
        platform: 'reddit',
        handle: 'freeuser',
        platformUsername: 'freeuser',
        oauthToken: 'encrypted_token_free',
        oauthRefresh: 'encrypted_refresh_free',
        isActive: true,
      },
      {
        userId: proUserId,
        platform: 'reddit',
        handle: 'prouser',
        platformUsername: 'prouser',
        oauthToken: 'encrypted_token_pro',
        oauthRefresh: 'encrypted_refresh_pro',
        isActive: true,
      },
      {
        userId: premiumUserId,
        platform: 'reddit',
        handle: 'premiumuser',
        platformUsername: 'premiumuser',
        oauthToken: 'encrypted_token_premium',
        oauthRefresh: 'encrypted_refresh_premium',
        isActive: true,
      },
    ]);

    // Generate auth tokens (mock JWT for testing)
    freeUserToken = `Bearer mock_token_${freeUserId}`;
    proUserToken = `Bearer mock_token_${proUserId}`;
    premiumUserToken = `Bearer mock_token_${premiumUserId}`;
  });

  describe('POST /api/reddit/sync/quick', () => {
    it('should allow all authenticated users to quick sync', async () => {
      const response = await request(app)
        .post('/api/reddit/sync/quick')
        .set('Authorization', freeUserToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('jobId');
      expect(response.body.syncType).toBe('quick');
      expect(response.body.estimatedTime).toBe('30 seconds');
    });

    it('should return error if no Reddit account connected', async () => {
      // Create user without Reddit account
      const [noRedditUser] = await db.insert(users).values({
        email: 'noreddit@test.com',
        username: 'noreddit',
        tier: 'free',
      }).returning();

      const noRedditToken = `Bearer mock_token_${noRedditUser.id}`;

      const response = await request(app)
        .post('/api/reddit/sync/quick')
        .set('Authorization', noRedditToken);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No active Reddit account');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/reddit/sync/quick');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/reddit/sync/deep', () => {
    it('should allow Pro users to deep sync', async () => {
      const response = await request(app)
        .post('/api/reddit/sync/deep')
        .set('Authorization', proUserToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jobId');
      expect(response.body.syncType).toBe('deep');
      expect(response.body.estimatedTime).toBe('2-3 minutes');
    });

    it('should allow Premium users to deep sync', async () => {
      const response = await request(app)
        .post('/api/reddit/sync/deep')
        .set('Authorization', premiumUserToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jobId');
    });

    it('should block Free users from deep sync', async () => {
      const response = await request(app)
        .post('/api/reddit/sync/deep')
        .set('Authorization', freeUserToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Deep sync requires Pro');
      expect(response.body.requiredTier).toBe('pro');
    });

    it('should block Starter users from deep sync', async () => {
      // Create starter user
      const [starterUser] = await db.insert(users).values({
        email: 'starter@test.com',
        username: 'starteruser',
        tier: 'starter',
      }).returning();

      await db.insert(creatorAccounts).values({
        userId: starterUser.id,
        platform: 'reddit',
        handle: 'starteruser',
        platformUsername: 'starteruser',
        oauthToken: 'encrypted_token_starter',
        oauthRefresh: 'encrypted_refresh_starter',
        isActive: true,
      });

      const starterToken = `Bearer mock_token_${starterUser.id}`;

      const response = await request(app)
        .post('/api/reddit/sync/deep')
        .set('Authorization', starterToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Deep sync requires Pro');
    });
  });

  describe('POST /api/reddit/sync/full', () => {
    it('should allow Premium users to full sync', async () => {
      const response = await request(app)
        .post('/api/reddit/sync/full')
        .set('Authorization', premiumUserToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jobId');
      expect(response.body.syncType).toBe('full');
      expect(response.body.estimatedTime).toBe('5-10 minutes');
    });

    it('should block Pro users from full sync', async () => {
      const response = await request(app)
        .post('/api/reddit/sync/full')
        .set('Authorization', proUserToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Full sync requires Premium');
      expect(response.body.requiredTier).toBe('premium');
    });

    it('should block Free users from full sync', async () => {
      const response = await request(app)
        .post('/api/reddit/sync/full')
        .set('Authorization', freeUserToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Full sync requires Premium');
    });
  });

  describe('GET /api/reddit/sync/status', () => {
    it('should return sync status for authenticated users', async () => {
      const response = await request(app)
        .get('/api/reddit/sync/status')
        .set('Authorization', freeUserToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('postCount');
      expect(response.body).toHaveProperty('subredditCount');
      expect(response.body).toHaveProperty('lastSyncAt');
    });

    it('should return zeros for users who never synced', async () => {
      const response = await request(app)
        .get('/api/reddit/sync/status')
        .set('Authorization', freeUserToken);

      expect(response.status).toBe(200);
      expect(response.body.postCount).toBe(0);
      expect(response.body.subredditCount).toBe(0);
      expect(response.body.lastSyncAt).toBeNull();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/reddit/sync/status');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/reddit/sync/job/:jobId', () => {
    it('should return job status for valid job', async () => {
      // First queue a sync job
      const syncResponse = await request(app)
        .post('/api/reddit/sync/quick')
        .set('Authorization', freeUserToken);

      const jobId = syncResponse.body.jobId;

      // Then get job status
      const response = await request(app)
        .get(`/api/reddit/sync/job/${jobId}`)
        .set('Authorization', freeUserToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/reddit/sync/job/non-existent-job-id')
        .set('Authorization', freeUserToken);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Job not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/reddit/sync/job/some-job-id');

      expect(response.status).toBe(401);
    });
  });

  describe('Tier Access Matrix', () => {
    it('should enforce correct tier access for all sync types', async () => {
      const tiers = [
        { name: 'free', token: freeUserToken },
        { name: 'pro', token: proUserToken },
        { name: 'premium', token: premiumUserToken },
      ];

      const endpoints = [
        { path: '/api/reddit/sync/quick', minTier: 'free' },
        { path: '/api/reddit/sync/deep', minTier: 'pro' },
        { path: '/api/reddit/sync/full', minTier: 'premium' },
      ];

      for (const tier of tiers) {
        for (const endpoint of endpoints) {
          const response = await request(app)
            .post(endpoint.path)
            .set('Authorization', tier.token);

          const hasAccess = getTierLevel(tier.name) >= getTierLevel(endpoint.minTier);

          if (hasAccess) {
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('jobId');
          } else {
            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('requiredTier');
          }
        }
      }
    });
  });
});

// Helper function
function getTierLevel(tier: string): number {
  const levels: Record<string, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    premium: 3,
  };
  return levels[tier] || 0;
}
