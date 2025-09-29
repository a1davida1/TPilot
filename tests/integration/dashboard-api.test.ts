import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../../server/index.ts';
import { storage } from '../../server/storage.ts';

describe('Dashboard API', () => {
  let app: Express;
  let testUserId: number;
  let testUserToken: string;
  let adminUserId: number;
  let adminToken: string;

  beforeAll(async () => {
    const result = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false
    });
    app = result.app;
    
    // Create test users
    const testUser = await storage.createUser({
      username: 'dashboardtest',
      email: 'dashboard@test.com',
      password: 'hashedpassword',
      subscriptionTier: 'free'
    });
    testUserId = testUser.id;
    
    const adminUser = await storage.createUser({
      username: 'dashboardadmin',
      email: 'admin@test.com',
      password: 'hashedpassword',
      subscriptionTier: 'pro',
      role: 'admin'
    });
    adminUserId = adminUser.id;
    
    // Generate JWT tokens
    testUserToken = jwt.sign({ 
      userId: testUserId, 
      username: 'dashboardtest',
      email: 'dashboard@test.com'
    }, process.env.JWT_SECRET || 'test-secret');
    
    adminToken = jwt.sign({ 
      userId: adminUserId, 
      username: 'dashboardadmin',
      email: 'admin@test.com',
      role: 'admin'
    }, process.env.JWT_SECRET || 'test-secret');
  });
  
  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await storage.deleteUser(testUserId).catch(() => {});
    }
    if (adminUserId) {
      await storage.deleteUser(adminUserId).catch(() => {});
    }
  });


  describe('GET /api/dashboard/stats', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .expect(401);
      
      expect(response.body).toHaveProperty('message', 'Authentication required');
    });

    it('should return dashboard stats for authenticated user', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('postsToday');
      expect(response.body).toHaveProperty('engagementRate');
      expect(response.body).toHaveProperty('takedownsFound');
      expect(response.body).toHaveProperty('estimatedTaxSavings');
      
      // Verify types
      expect(typeof response.body.postsToday).toBe('number');
      expect(typeof response.body.engagementRate).toBe('number');
      expect(typeof response.body.takedownsFound).toBe('number');
      expect(typeof response.body.estimatedTaxSavings).toBe('number');
    });

    it('should return admin stats for admin user', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('postsToday');
      expect(response.body).toHaveProperty('engagementRate');
      expect(response.body).toHaveProperty('takedownsFound');
      expect(response.body).toHaveProperty('estimatedTaxSavings');
      
      // Admin stats should be available
      expect(typeof response.body.postsToday).toBe('number');
      expect(typeof response.body.engagementRate).toBe('number');
      expect(typeof response.body.takedownsFound).toBe('number');
      expect(typeof response.body.estimatedTaxSavings).toBe('number');
    });

    // Note: Database error testing would require mocking the dashboard service
    // which is not easily done in integration tests. This would be better
    // suited for unit tests of the dashboard service itself.
  });

  describe('GET /api/dashboard/activity', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/dashboard/activity')
        .expect(401);
      
      expect(response.body).toHaveProperty('message', 'Authentication required');
    });

    it('should return dashboard activity for authenticated user', async () => {
      const response = await request(app)
        .get('/api/dashboard/activity')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('recentMedia');
      expect(Array.isArray(response.body.recentMedia)).toBe(true);
      
      // If there are media items, check their structure
      if (response.body.recentMedia.length > 0) {
        const mediaItem = response.body.recentMedia[0];
        expect(mediaItem).toHaveProperty('id');
        expect(mediaItem).toHaveProperty('url');
        expect(mediaItem).toHaveProperty('alt');
        expect(mediaItem).toHaveProperty('createdAt');
      }
    });

    it('should return admin activity for admin user', async () => {
      const response = await request(app)
        .get('/api/dashboard/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('recentMedia');
      expect(Array.isArray(response.body.recentMedia)).toBe(true);
      
      // Admin should see more media items (up to 8 vs 4)
      expect(response.body.recentMedia.length).toBeLessThanOrEqual(8);
    });

    // Note: Database error testing would require mocking the dashboard service
    // which is not easily done in integration tests. This would be better
    // suited for unit tests of the dashboard service itself.

    it('should return empty array when no media exists', async () => {
      // This tests the fallback behavior when no media is found
      const response = await request(app)
        .get('/api/dashboard/activity')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('recentMedia');
      expect(Array.isArray(response.body.recentMedia)).toBe(true);
    });
  });

  describe('Dashboard API Security', () => {
    it('should validate JWT token format', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      expect(response.body).toHaveProperty('message');
    });

    it('should reject expired tokens', async () => {
      // Generate an expired token (1 second expiry)
      const expiredToken = jwt.sign({ 
        userId: testUserId, 
        username: 'dashboardtest',
        email: 'dashboard@test.com'
      }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1ms' });
      
      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
      
      expect(response.body).toHaveProperty('message');
    });

    it('should require user ID in token payload', async () => {
      // Generate token without userId field
      const invalidToken = jwt.sign({ 
        username: 'dashboardtest',
        email: 'dashboard@test.com'
        // Missing userId field
      }, process.env.JWT_SECRET || 'test-secret');
      
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
      
      expect(response.body).toHaveProperty('message', 'Authentication required');
    });
  });
});
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../../server/index.ts';
import { storage } from '../../server/storage.ts';

describe('Dashboard API readiness', () => {
  it('registers dashboard endpoints before the server starts handling traffic', async () => {
    const uniqueSuffix = Date.now();
    const username = `dashboardready${uniqueSuffix}`;
    const email = `${username}@test.com`;

    const testUser = await storage.createUser({
      username,
      email,
      password: 'hashedpassword',
      subscriptionTier: 'free'
    });

    const token = jwt.sign({
      userId: testUser.id,
      username,
      email
    }, process.env.JWT_SECRET || 'test-secret');

    const { app } = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false
    });

    try {
      await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app)
        .get('/api/dashboard/activity')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    } finally {
      await storage.deleteUser(testUser.id).catch(() => {});
    }
  });
});

describe('Dashboard API', () => {
  let app: Express;
  let testUserId: number;
  let testUserToken: string;
  let adminUserId: number;
  let adminToken: string;

  beforeAll(async () => {
    const result = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false
    });
    app = result.app;
    
    // Create test users
    const testUser = await storage.createUser({
      username: 'dashboardtest',
      email: 'dashboard@test.com',
      password: 'hashedpassword',
      subscriptionTier: 'free'
    });
    testUserId = testUser.id;
    
    const adminUser = await storage.createUser({
      username: 'dashboardadmin',
      email: 'dashboardadmin@test.com',
      password: 'hashedpassword',
      subscriptionTier: 'premium',
      isAdmin: true
    });
    adminUserId = adminUser.id;

    testUserToken = jwt.sign({
      userId: testUserId,
      username: 'dashboardtest',
      email: 'dashboard@test.com'
    }, process.env.JWT_SECRET || 'test-secret');

    adminToken = jwt.sign({
      userId: adminUserId,
      username: 'dashboardadmin',
      email: 'dashboardadmin@test.com'
    }, process.env.JWT_SECRET || 'test-secret');
  });

  afterAll(async () => {
    await storage.deleteUser(testUserId).catch(() => {});
    await storage.deleteUser(adminUserId).catch(() => {});
  });

  it('should return dashboard stats for authenticated users', async () => {
    await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${testUserToken}`)
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveProperty('totalGenerations');
        expect(res.body).toHaveProperty('totalUploads');
      });
  });

  it('should return dashboard activity for authenticated users', async () => {
    await request(app)
      .get('/api/dashboard/activity')
      .set('Authorization', `Bearer ${testUserToken}`)
      .expect(200)
      .expect(res => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('should reject unauthorized requests', async () => {
    await request(app)
      .get('/api/dashboard/stats')
      .expect(401);
  });
});
